"""
Slack front end for the Notion task assistant (Socket Mode).

Why Socket Mode: the bot opens an OUTBOUND WebSocket to Slack, so it needs no
public URL, no Cloud Run, and no org-policy exception. Run it as a small
always-on process anywhere with internet access.

It reuses agent.py and notion_client.py unchanged — this file only translates
Slack events into agent.handle_message() calls and posts the reply back.

Environment variables required:
    SLACK_BOT_TOKEN    xoxb-...   (OAuth & Permissions -> Bot User OAuth Token)
    SLACK_APP_TOKEN    xapp-...   (Basic Information -> App-Level Tokens, scope connections:write)
    NOTION_TOKEN, NOTION_DATABASE_ID, ANTHROPIC_API_KEY  (same as before)
"""
import logging
import os
import re
import threading
import time

import requests
from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler

import agent
import config
import digest
import drive_client
import notion_client

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("slack-task-bot")

# Socket Mode opens an OUTBOUND websocket, so Slack never sends us signed HTTP
# requests. Disable request verification so the app doesn't require a signing
# secret (newer slack_sdk raises "signing_secret must not be empty" otherwise).
app = App(
    token=os.environ["SLACK_BOT_TOKEN"],
    request_verification_enabled=False,
)

# Matches the <@U123ABC> mention tokens Slack inserts so we can strip them out.
_MENTION = re.compile(r"<@[A-Z0-9]+>")

# Short-term memory: per conversation (DM or channel thread), keep the last few
# user/assistant text turns so follow-up replies keep their context. In-memory
# only — resets if the process restarts, which is fine for this use.
_CONV: dict[str, list] = {}
_MAX_TURNS = 8  # ~4 back-and-forth exchanges

# The listening window (below) lives only in memory, so a process restart wipes
# it. That used to make the bot go DEAF to an in-flight follow-up: someone answers
# "Susana, mañana, alta" with no trigger word, but the window that told us to read
# untriggered replies is gone, so the message is ignored and the task never gets
# its fields. To survive restarts we can rebuild that state from Slack's own
# history (see _recover_channel_window): if our last message in the channel was an
# unanswered question to this person, we treat their reply as the answer even
# though no window is in memory. These cache the bot's identity so we can tell our
# own messages apart from other people's when reading history.
_BOT_USER_ID = None
_BOT_BOT_ID = None
_BOT_ID_LOCK = threading.Lock()

# Look this many messages back when rebuilding a dropped conversation.
_RECOVERY_LOOKBACK = 15
# After a history check finds nothing pending in a channel, skip re-checking it
# for this long so ordinary chatter doesn't trigger a history call per message.
# (Only ever set for non-conversation chatter; never suppresses a real answer —
# an active window short-circuits before recovery is even attempted.)
_RECOVERY_TTL = 60
_recovery_checked: dict[str, float] = {}  # channel -> last "nothing pending" time

# ---------------------------------------------------------------------------
# Listening windows (channels only)
#
# In a channel the bot normally needs a trigger word. But once it has ASKED a
# follow-up ("what's the due date and priority?"), the person's answer won't
# carry a trigger — so we'd miss it. To fix that, after the bot asks for missing
# info we open a short "listening window" for that person in that channel: their
# next messages are read WITHOUT a trigger, until the task is created or the
# window expires. If they don't answer within FOLLOWUP_SECONDS, the bot @-mentions
# them once and re-asks.
# ---------------------------------------------------------------------------
WINDOW_SECONDS = 300      # 5 min: keep listening (no trigger needed) this long
FOLLOWUP_SECONDS = 120    # 2 min: nudge the person once if still no answer

# window key -> {user, channel, thread_ts, expires_at, question, answered, timer}
_PENDING: dict[str, dict] = {}
_PENDING_LOCK = threading.Lock()


def _window_key(event: dict) -> str:
    """One window per (channel-or-thread, user) so we only listen to the person
    we actually asked, not everyone chatting in the channel."""
    base = event.get("thread_ts") or event.get("channel") or "default"
    return f"{base}:{event.get('user')}"


def _window_active(wkey: str) -> bool:
    """True if we're still within an open listening window for this person.

    Note we do NOT pop an expired window here. The finalize timer (armed for
    WINDOW_SECONDS) is the single owner of closing a window — it pops it AND
    auto-saves the task. If this lazy check popped the window first, a message
    that happened to arrive right at expiry would delete the window before the
    timer fired, and the forgotten task would be lost instead of saved. So past
    expiry we simply report 'not active' (the untriggered reply is ignored) and
    leave the timer to close and save."""
    with _PENDING_LOCK:
        p = _PENDING.get(wkey)
        if not p:
            return False
        return time.time() <= p["expires_at"]


def _clear_pending(wkey: str) -> None:
    """Close a window and cancel BOTH timers (the nudge and the auto-save). Called
    when the task is done or the conversation is over, so nothing fires afterward."""
    with _PENDING_LOCK:
        p = _PENDING.pop(wkey, None)
    if p:
        if p.get("timer"):
            p["timer"].cancel()
        if p.get("finalize_timer"):
            p["finalize_timer"].cancel()


def _mark_answered(wkey: str) -> None:
    """The person just replied, so cancel the pending nudge. The window itself
    stays open (it's re-armed by _open_window if we still need more info)."""
    with _PENDING_LOCK:
        p = _PENDING.get(wkey)
        if p:
            p["answered"] = True
            if p.get("timer"):
                p["timer"].cancel()
                p["timer"] = None


def _schedule_followup(wkey, client, channel, thread_ts, user, question):
    """Arm a one-shot timer that re-asks (with an @mention) if unanswered."""
    def _fire():
        with _PENDING_LOCK:
            p = _PENDING.get(wkey)
            if not p or p.get("answered"):
                log.info("nudge skipped for %s (answered or window closed)", wkey)
                return  # answered in time, or window already closed
            p["timer"] = None
        text = f"<@{user}> {question}"
        try:
            kwargs = {"channel": channel, "text": text}
            if thread_ts:
                kwargs["thread_ts"] = thread_ts
            client.chat_postMessage(**kwargs)
            log.info("nudge posted to %s for user %s", channel, user)
        except Exception:
            log.exception("follow-up nudge failed for %s", wkey)

    t = threading.Timer(FOLLOWUP_SECONDS, _fire)
    t.daemon = True
    t.start()
    log.info("nudge armed for %s, firing in %ss", wkey, FOLLOWUP_SECONDS)
    return t


def _schedule_finalize(wkey, client, channel, thread_ts, sender_name, sector=None):
    """Arm a one-shot timer that AUTO-SAVES the task if the window closes with no
    completed reply. This is why a forgotten task is never lost: WINDOW_SECONDS
    after the last exchange we write it to Notion, filling any still-missing field
    with a placeholder (owner/priority -> 'Not specified', due date left blank).

    The timer is the single owner of closing an expired window (see the note in
    _window_active): it pops the window, cancels the nudge, then runs finalize.

    `sector` routes the auto-saved task to the right sector database."""
    def _fire():
        with _PENDING_LOCK:
            p = _PENDING.get(wkey)
            if not p:
                return  # already closed (task created, or conversation cleared)
            _PENDING.pop(wkey, None)      # claim + close the window
            if p.get("timer"):
                p["timer"].cancel()        # cancel any still-pending nudge
        key = thread_ts or channel or "default"
        history = _CONV.get(key, [])
        try:
            answer, created = agent.finalize_pending_task(history, sender_name, sector)
            kwargs = {"channel": channel, "text": answer}
            if thread_ts:
                kwargs["thread_ts"] = thread_ts
            client.chat_postMessage(**kwargs)
            _CONV[key] = (history + [
                {"role": "assistant", "content": answer},
            ])[-_MAX_TURNS:]
            log.info("auto-saved abandoned task for %s (created=%s)", wkey, created)
        except Exception:
            log.exception("auto-save on window expiry failed for %s", wkey)

    t = threading.Timer(WINDOW_SECONDS, _fire)
    t.daemon = True
    t.start()
    log.info("auto-save armed for %s, firing in %ss", wkey, WINDOW_SECONDS)
    return t


def _open_window(wkey, client, channel, thread_ts, user, question,
                 sender_name="a teammate", sector=None) -> None:
    """(Re)open a listening window and (re)arm BOTH timers: the 2-minute nudge and
    the 5-minute auto-save. Called every time the bot asks for more info, so the
    timers roll forward each exchange (a fresh reply buys another full window)."""
    with _PENDING_LOCK:
        prev = _PENDING.get(wkey)
        if prev:
            if prev.get("timer"):
                prev["timer"].cancel()
            if prev.get("finalize_timer"):
                prev["finalize_timer"].cancel()
        _PENDING[wkey] = {
            "user": user,
            "channel": channel,
            "thread_ts": thread_ts,
            "expires_at": time.time() + WINDOW_SECONDS,
            "question": question,
            "sender_name": sender_name,
            "answered": False,
            "timer": None,
            "finalize_timer": None,
        }
    timer = _schedule_followup(wkey, client, channel, thread_ts, user, question)
    finalize_timer = _schedule_finalize(wkey, client, channel, thread_ts, sender_name, sector)
    with _PENDING_LOCK:
        p = _PENDING.get(wkey)
        if p is not None:
            p["timer"] = timer
            p["finalize_timer"] = finalize_timer


def _clean(text: str) -> str:
    return _MENTION.sub("", text or "").strip()


def _key(event: dict) -> str:
    # Group by thread when present, otherwise by channel/DM.
    return event.get("thread_ts") or event.get("channel") or "default"


# ---------------------------------------------------------------------------
# Sector resolution (access isolation)
#
# A message's sector is decided by the CHANNEL it arrived on, via config.SECTORS.
# For DMs (which have no sector channel) we derive the person's sectors from the
# membership of the sector channels themselves (conversations.members) — Slack
# channel membership is the single source of truth, so there's no second
# whitelist to maintain. When config.SECTORS is empty the whole workspace runs in
# single-database mode and these helpers are no-ops.
# ---------------------------------------------------------------------------
_SECTOR_MEMBERS: dict = {}          # channel_id -> (fetched_at, set(user_ids))
_SECTOR_MEMBERS_TTL = 300           # re-list a channel's members at most every 5 min
_SECTOR_MEMBERS_LOCK = threading.Lock()

# When a multi-sector person DMs without naming a sector, we ask which one and
# hold their original message here until they answer. Keyed by user id; holds the
# original Slack event (so any attached files are ingested into the CHOSEN
# sector's Drive folder once picked) and their sector list. Expires so a stale
# question can't reroute a much later, unrelated message.
_DM_PENDING: dict = {}              # user_id -> {"event", "mine", "ts"}
_DM_PENDING_TTL = 600               # 10 min to answer the sector question
_DM_PENDING_LOCK = threading.Lock()


def _dm_pending_set(user_id: str, event: dict, mine: list) -> None:
    with _DM_PENDING_LOCK:
        _DM_PENDING[user_id] = {"event": event, "mine": mine, "ts": time.time()}


def _dm_pending_get(user_id: str):
    with _DM_PENDING_LOCK:
        p = _DM_PENDING.get(user_id)
        if not p:
            return None
        if time.time() - p["ts"] > _DM_PENDING_TTL:
            _DM_PENDING.pop(user_id, None)
            return None
        return p


def _dm_pending_clear(user_id: str) -> None:
    with _DM_PENDING_LOCK:
        _DM_PENDING.pop(user_id, None)


def _sector_channel_members(client, channel_id: str) -> set:
    """Members of a sector channel, cached for a few minutes. On an API failure
    we return the last good set (or empty) rather than crashing a message."""
    now = time.time()
    with _SECTOR_MEMBERS_LOCK:
        cached = _SECTOR_MEMBERS.get(channel_id)
    if cached and now - cached[0] < _SECTOR_MEMBERS_TTL:
        return cached[1]
    ids: set = set()
    try:
        cursor = None
        while True:
            resp = client.conversations_members(channel=channel_id, limit=200, cursor=cursor)
            ids.update(resp.get("members", []))
            cursor = (resp.get("response_metadata") or {}).get("next_cursor")
            if not cursor:
                break
    except Exception:
        log.exception("could not list members of sector channel %s", channel_id)
        if cached:
            return cached[1]  # serve stale rather than lock the person out on a blip
    with _SECTOR_MEMBERS_LOCK:
        _SECTOR_MEMBERS[channel_id] = (now, ids)
    return ids


def _user_sectors(client, user_id: str) -> list:
    """Every sector the user belongs to, as a list of (channel_id, cfg)."""
    out = []
    for cid, cfg in config.SECTORS.items():
        if user_id in _sector_channel_members(client, cid):
            out.append((cid, cfg))
    return out


def _match_sector_prefix(text: str, mine: list):
    """If a multi-sector person prefixed their DM with a sector name they belong
    to ('ventas: ...'), return (cfg, text_without_prefix); else (None, text).
    Only a 'name:' prefix is accepted, to avoid mis-reading normal sentences."""
    stripped = (text or "").lstrip()
    low = stripped.lower()
    for _cid, cfg in mine:
        name = (cfg.get("sector") or "").strip().lower()
        if name and low.startswith(name + ":"):
            return cfg, stripped[len(name) + 1:].strip()
    return None, text


# Sentinel returned by _resolve_dm_sector when the person belongs to more than
# one sector and hasn't named one: the caller should ASK which sector (listing
# the ones they can access) rather than refuse.
_ASK_SECTOR = object()


def _ordered_sectors(mine: list) -> list:
    """The person's sectors in a stable display order (by name)."""
    return sorted(mine, key=lambda cc: (cc[1].get("sector") or "").lower())


def _sector_prompt(mine: list, retry: bool = False) -> str:
    """The message that asks a multi-sector person which sector to use."""
    lines = "\n".join(
        f"{i + 1}. {cfg.get('sector', '?')}"
        for i, (_cid, cfg) in enumerate(_ordered_sectors(mine))
    )
    lead = "No entendí el sector. " if retry else ""
    return (f"{lead}¿En qué sector guardo esto? Responde con el número o el "
            f"nombre:\n{lines}")


def _interpret_sector_pick(text: str, mine: list):
    """Read a reply to the sector question. Accepts the sector's name (with or
    without a trailing ':') or its 1-based number from the prompt. Returns the
    chosen sector cfg, or None if the reply doesn't match one of THEIR sectors."""
    s = (text or "").strip()
    if not s:
        return None
    low = s.lower().rstrip(":").strip()
    for _cid, cfg in mine:
        name = (cfg.get("sector") or "").strip().lower()
        if name and low == name:
            return cfg
    if s.isdigit():
        ordered = _ordered_sectors(mine)
        i = int(s)
        if 1 <= i <= len(ordered):
            return ordered[i - 1][1]
    return None


def _resolve_dm_sector(client, user_id: str, text: str):
    """Decide which sector a DM belongs to. Returns (sector_cfg, cleaned_text,
    refusal_message). refusal_message is None when it's OK to proceed, the
    _ASK_SECTOR sentinel when the caller should ask which sector, or a plain
    string to show and stop.

    - single-database mode: (None, text, None) — behave as before.
    - one sector: use it.
    - several sectors: honor a 'sector:' prefix if present; otherwise signal the
      caller to ASK which sector (never guess across the isolation wall).
    - no sector: decline (nothing to act on)."""
    if not config.sectors_enabled():
        return None, text, None
    mine = _user_sectors(client, user_id)
    if not mine:
        return None, text, (
            "No perteneces a ningún sector todavía, así que no puedo crear ni "
            "consultar tareas por aquí. Pídele a un administrador que te agregue "
            "al canal de tu sector.")
    if len(mine) == 1:
        return mine[0][1], text, None
    picked, cleaned = _match_sector_prefix(text, mine)
    if picked:
        return picked, cleaned, None
    return None, text, _ASK_SECTOR


# ---------------------------------------------------------------------------
# Task sharing (the Gally flow)
#
# A sector with a `shared_db` (Gally) can ASSIGN a task to someone who isn't one
# of its channel members. The decision (is this owner a member?) and the DM to
# the assignee both need the Slack client, which the agent layer doesn't have. So
# the Slack layer ENRICHES the sector dict here with everything the agent needs to
# make the call itself: the global shared database, the shared sector's member
# set, the requester's id, a name->Slack-id resolver, and the sector's owner
# label. When sharing isn't configured this is a no-op and every sector behaves
# exactly as before.
# ---------------------------------------------------------------------------
def _owner_resolver(client):
    """Build a closure that maps an owner NAME to a Slack user id (or None), reusing
    digest.resolve_user (which never guesses on an ambiguous match). The member
    list is fetched ONCE per message here, so the closure itself is cheap; we only
    build it for a sector that can actually assign out."""
    try:
        members = digest._slack_members(client)
    except Exception:
        log.exception("could not list Slack members for owner resolution")
        members = []

    def _resolve(name):
        try:
            return digest.resolve_user(name, members)
        except Exception:
            return None
    return _resolve


def _enrich_sector(client, sector, requester_id):
    """Return a COPY of the sector dict augmented with sharing context, or the
    sector unchanged when sharing isn't configured. Safe to call for every message
    and for every sector — it only adds keys the agent reads when a shared_db
    exists."""
    if not config.sectors_enabled():
        return sector
    shared_db = config.global_shared_db()
    if not shared_db:
        return sector  # no sector has sharing enabled -> leave everything as-is
    gally_cid, gally_cfg = config.shared_channel()
    members = _sector_channel_members(client, gally_cid) if gally_cid else set()
    enriched = dict(sector or {})
    can_share = bool((sector or {}).get("shared_db"))  # only the Gally sector carries this
    enriched["shared_db"] = shared_db
    enriched["member_ids"] = members
    enriched["is_member"] = bool(requester_id and requester_id in members)
    enriched["requester_id"] = requester_id
    enriched["can_share"] = can_share
    enriched["owner"] = (gally_cfg or {}).get("owner") or (gally_cfg or {}).get("sector")
    # The name->id resolver is only needed when this sector can assign out, and it
    # costs a users.list call, so only build it then.
    enriched["resolve_owner"] = _owner_resolver(client) if can_share else None
    return enriched


def _assignee_only_sector(uid):
    """For a DM from someone who belongs to NO sector: if a Gally task has been
    shared with them, hand back a synthetic read/edit context (no active database
    of their own) so they can still see and attach to that task. None if sharing
    isn't configured or nothing is shared with them (so the normal 'you're not in a
    sector' refusal still shows for genuine strangers)."""
    shared_db = config.global_shared_db()
    if not shared_db:
        return None
    try:
        rows = notion_client.query_tasks(database_id=shared_db)
    except Exception:
        log.exception("could not read shared tasks for assignee %s", uid)
        return None
    if not any(uid in (t.get("shared_with") or "") for t in rows):
        return None
    _gally_cid, gally_cfg = config.shared_channel()
    # Files the assignee attaches land in the shared sector's Drive folder.
    return {"sector": "Compartidas", "active_db": None, "history_db": None,
            "drive_folder": (gally_cfg or {}).get("drive_folder")}


def _deliver_shares(client) -> None:
    """After the agent runs, DM each person a Gally task was just assigned to. The
    agent queues these (it can't post to Slack); we drain and send them here, one
    DM per assignee."""
    for s in agent.pop_shares():
        uid = s.get("assignee_id")
        if not uid:
            continue
        bits = []
        if s.get("due"):
            bits.append(f"vence {s['due']}")
        if s.get("priority"):
            bits.append(f"prioridad {s['priority']}")
        extra = (" (" + ", ".join(bits) + ")") if bits else ""
        text = (
            f"{s.get('assigner') or 'Gally'} te asignó una tarea: "
            f"*{s.get('title') or '(sin título)'}*{extra}.\n"
            "Puedes verla y adjuntarle archivos escribiéndome por aquí "
            "(por ejemplo: “¿qué tengo pendiente?”)."
        )
        try:
            opened = client.conversations_open(users=uid)
            dm = opened["channel"]["id"]
            client.chat_postMessage(channel=dm, text=text)
            log.info("notified assignee %s of shared task %r", uid, s.get("title"))
        except Exception:
            log.exception("failed to DM assignee %s about shared task", uid)


# In a shared channel the bot stays SILENT unless a message starts with one of
# these trigger prefixes (case-insensitive). This keeps it from reacting to (and
# spending API calls on) every message in a channel with other people. DMs and
# @mentions don't need a trigger.
TRIGGER_PREFIXES = (
    "task:", "!task", "/task",
    # Spanish — Gally and team write in Spanish, so accept the natural phrasings.
    "tarea:", "!tarea", "/tarea",
    "crear tarea", "nueva tarea", "agregar tarea", "añadir tarea",
)


def _triggered_command(text: str):
    """If a channel message starts with a trigger prefix, return the command
    text after it; otherwise return None so the bot stays silent."""
    stripped = (text or "").lstrip()
    low = stripped.lower()
    for pfx in TRIGGER_PREFIXES:
        if low.startswith(pfx):
            # Strip the prefix, then any leftover ":" — e.g. "crear tarea: X" -> "X".
            return stripped[len(pfx):].lstrip(" :").strip()
    return None


def _sender_name(client, event) -> str:
    """Resolve the Slack user id to a human name so the bot knows who is asking
    (used to show someone their own tasks). Requires the users:read scope; falls
    back to a generic label if unavailable."""
    uid = event.get("user")
    if not uid:
        return "a teammate"
    try:
        prof = client.users_info(user=uid)["user"]
        return (
            prof.get("real_name")
            or prof.get("profile", {}).get("display_name")
            or prof.get("name")
            or "a teammate"
        )
    except Exception:
        log.warning("could not resolve user name for %s", uid)
        return "a teammate"


def _reply(text: str, key: str, sender_name: str = "a teammate", sector=None):
    """Run one message through the agent. Returns (answer_text, status) where
    status is 'created' / 'needs_info' / 'other' (see agent.handle_message)."""
    history = _CONV.get(key, [])
    try:
        answer, status = agent.handle_message(text, sender_name, history=history,
                                              sector=sector)
    except Exception as exc:  # never let one bad message kill the listener
        log.exception("agent error")
        return f"Something went wrong: {exc}", "other"
    # Save this exchange for context on the next message.
    _CONV[key] = (history + [
        {"role": "user", "content": text},
        {"role": "assistant", "content": answer},
    ])[-_MAX_TURNS:]
    return answer, status


# ---------------------------------------------------------------------------
# File uploads (Phase 2 materials)
#
# When someone drops a file into Slack, Slack sends a message with subtype
# 'file_share' and a `files` array. We download each file's bytes (bot token
# auth), store the single canonical copy in the Shared Drive, and append a note
# to the command text telling the agent the file's name + Drive link so it can
# attach it to the task the caption names, via the existing attach_material tool.
# Slack link URLs in the user's MESSAGE are fine — only tool RESULT urls are
# stripped — so the model can pass the Drive link straight to attach_material.
# ---------------------------------------------------------------------------
def _download_slack_file(f: dict) -> bytes:
    """Fetch a Slack-hosted file's bytes. Slack's private file URLs require the
    bot token as a Bearer header (and the files:read scope)."""
    url = f.get("url_private_download") or f.get("url_private")
    if not url:
        raise RuntimeError("file has no download url")
    token = os.environ["SLACK_BOT_TOKEN"]
    r = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=60)
    if r.status_code >= 400:
        raise RuntimeError(f"slack download failed ({r.status_code})")
    return r.content


def _ingest_files(event, sector=None) -> str:
    """Store any uploaded files in Drive and return a note (to append to the
    command) describing each file's name + Drive link. Empty string if there are
    no files. If Drive isn't configured, returns a note telling the agent to say
    so rather than silently dropping the upload.

    In sector mode the file goes into that sector's Drive subfolder, so a channel
    only ever writes into its own folder."""
    files = event.get("files") or []
    if not files:
        return ""
    if not drive_client.is_configured():
        log.warning("file uploaded but Drive not configured")
        return ("\n\n[SYSTEM: The user uploaded a file, but file storage isn't "
                "set up yet, so it could not be saved. Tell them file uploads "
                "aren't available yet.]")
    folder_id = (sector or {}).get("drive_folder")
    stored = []
    for f in files:
        name = f.get("name") or f.get("title") or "file"
        try:
            data = _download_slack_file(f)
            res = drive_client.upload_bytes(name, data, f.get("mimetype"),
                                            folder_id=folder_id)
            stored.append((name, res.get("link")))
            log.info("stored upload %r in Drive (%s)", name, res.get("id"))
        except Exception:
            log.exception("failed to store upload %r", name)
    if not stored:
        return ("\n\n[SYSTEM: A file upload failed to save. Tell the user the "
                "upload didn't go through and to try again.]")
    lines = "\n".join(f'- "{n}" -> {link}' for n, link in stored)
    return (
        "\n\n[SYSTEM: The user just uploaded the following file(s), now stored at "
        "these Drive links. Attach each to the task the message refers to using "
        "attach_material (find the task id with query_tasks first), passing the "
        "file name as the label. If the message doesn't say which task, ask which "
        "task to attach it to. Do not print these links in your reply.\n"
        f"{lines}\n]"
    )


def _deliver_queued(event, client) -> None:
    """After the agent runs, re-upload into Slack any files it queued for
    delivery (download the bytes from Drive, upload straight into the channel so
    people without Drive access still get them)."""
    deliveries = agent.pop_deliveries()
    if not deliveries:
        return
    channel = event.get("channel")
    thread_ts = event.get("thread_ts")
    for d in deliveries:
        try:
            name, data, _mime = drive_client.download_bytes(d["file_id"])
            kwargs = {
                "channel": channel,
                "file": data,
                "filename": name or d.get("name") or "file",
            }
            if thread_ts:
                kwargs["thread_ts"] = thread_ts
            client.files_upload_v2(**kwargs)
            log.info("delivered file %r into %s", name, channel)
        except Exception:
            log.exception("failed to deliver file %s", d.get("file_id"))
            try:
                client.chat_postMessage(
                    channel=channel,
                    text=f"Couldn't send *{d.get('name') or 'the file'}* — sorry.",
                    **({"thread_ts": thread_ts} if thread_ts else {}),
                )
            except Exception:
                log.exception("failed to post delivery-failure notice")


# A manual escape hatch for the daily digest. Normally the digest fires on its
# own schedule (see digest.py), but typing one of these words lets you fire it
# on demand to test it without waiting until the morning. Matched only when it's
# the WHOLE command (so a real task like "informe for the client" isn't caught).
_DIGEST_TRIGGERS = {"digest", "informe", "informe diario"}


def _maybe_run_digest(command, say, client) -> bool:
    """If the command is a bare digest trigger, run the digest now and report a
    one-line summary. Returns True if it handled the message (caller should stop)."""
    if (command or "").strip().lower().rstrip("!.") not in _DIGEST_TRIGGERS:
        return False
    try:
        res = digest.run_digest(client)
        say("Digest sent — channel posted: {channel_posted}, DMs: {dmed}, "
            "skipped: {skipped}, people: {people}.".format(**res))
    except Exception as exc:
        log.exception("manual digest run failed")
        say(f"Couldn't run the digest: {exc}")
    return True


def _respond(event, say, client, command, *, manage_window: bool, sector=None) -> None:
    """Generate a reply, post it, and (in channels) manage the listening window:
    keep listening if the bot asked for more info, stop once the task is made."""
    sender_name = _sender_name(client, event)
    # Augment the sector with sharing context (global shared DB, member set,
    # requester id, resolver, owner). No-op unless sharing is configured. Done
    # here so every caller of _respond — and the finalize timer, which inherits
    # this sector via _open_window — sees the same enriched context.
    sector = _enrich_sector(client, sector, event.get("user"))
    answer, status = _reply(command, _key(event), sender_name, sector)
    say(answer)
    _deliver_queued(event, client)  # re-upload any files the agent queued
    _deliver_shares(client)         # DM anyone a task was just assigned to

    if not manage_window:
        return  # caller opted out of window management

    wkey = _window_key(event)
    if _is_asking(status, answer):
        # Bot is still waiting on the person — keep listening for their next
        # (untriggered) reply and nudge if they go quiet. Checked BEFORE the
        # 'created' case ON PURPOSE: one turn can BOTH create some tasks and still
        # ask about others (e.g. a batch where only a few were complete), in which
        # case status collapses to 'created'. If we checked 'created' first we'd
        # close the window while the bot is still asking, and the person's next
        # answer would go unheard.
        _open_window(
            wkey, client,
            event.get("channel"), event.get("thread_ts"), event.get("user"),
            answer, sender_name, sector,
        )
    elif status == "created":
        _clear_pending(wkey)  # done — task made and nothing left to ask
        log.info("window cleared for %s (task created)", wkey)
    else:
        _clear_pending(wkey)  # a plain answer, nothing to wait for
        log.info("window cleared for %s (plain reply, status=%s)", wkey, status)


# Task-creation fields the bot asks about when a new task is missing info. If a
# reply is a QUESTION mentioning one of these, it's almost certainly waiting on
# the person to fill a gap (due date / priority / owner). Kept tight on purpose.
_ASK_FIELD_HINTS = (
    "due date", "priority", "when should", "when is",
    "who ", "who's", "whom", "assign", "owner",
    # Spanish
    "fecha", "prioridad", "quién", "quien", "cuándo", "cuando", "responsable",
)


def _looks_like_listing(text: str) -> bool:
    """A task listing has bullet/day-group structure. We must NOT treat its
    trailing '...mark it done?' as an info request, or we'd re-open a window and
    nudge someone on a reply they never owed."""
    t = text or ""
    return t.count("•") >= 2 or "Past due" in t or "Vencidas" in t


def _is_asking(status: str, answer: str) -> bool:
    """Decide whether the bot's reply is waiting on the person for info.

    Primary signal is STRUCTURAL: 'needs_info' is set when create_task returns
    needs_more_info, so we're provably blocked on a task field. But that depends
    on the model calling create_task BEFORE it asks — Haiku sometimes just asks
    the question in text and skips the tool call, leaving status='other'. In a
    channel that meant no listening window opened and the person's untriggered
    answer ('today high') went unheard.

    So we ADD a narrow text fallback: if the reply is a question that mentions a
    task-creation field (due date / priority / owner) and is NOT a task listing,
    treat it as waiting too. The listing guard is what kept the old text-scan from
    over-firing; we keep it, and require an actual field hint (not just any '?')."""
    if status == "needs_info":
        return True
    if status == "created":
        return False  # a task was made; don't re-open on a confirmation
    text = answer or ""
    if "?" not in text and "¿" not in text:
        return False
    if _looks_like_listing(text):
        return False
    low = text.lower()
    return any(h in low for h in _ASK_FIELD_HINTS)


def _bot_identity(client):
    """The bot's own user id (and bot_id) so we can recognise our own messages
    when reading channel history. Cached — resolved once per process."""
    global _BOT_USER_ID, _BOT_BOT_ID
    if _BOT_USER_ID is None:
        with _BOT_ID_LOCK:
            if _BOT_USER_ID is None:
                try:
                    a = client.auth_test()
                    _BOT_USER_ID = a.get("user_id")
                    _BOT_BOT_ID = a.get("bot_id")
                except Exception:
                    log.exception("auth_test failed; cannot resolve bot identity")
    return _BOT_USER_ID, _BOT_BOT_ID


def _is_ours(msg, uid, bid) -> bool:
    """True if a history message was posted by THIS bot (not another app)."""
    if uid and msg.get("user") == uid:
        return True
    return bool(bid and msg.get("bot_id") == bid)


def _dialogue_from_history(msgs, uid, bid, user):
    """Turn raw Slack messages (oldest->newest) into agent history turns: our
    messages -> assistant, this person's -> user. Everyone else's chatter is
    skipped so the rebuilt context is just their exchange with us."""
    out = []
    for m in msgs:
        text = _clean(m.get("text", ""))
        if not text:
            continue
        if _is_ours(m, uid, bid):
            out.append({"role": "assistant", "content": text})
        elif m.get("user") == user:
            out.append({"role": "user", "content": text})
    return out[-_MAX_TURNS:]


def _recover_channel_window(client, event):
    """Rebuild a dropped listening window from Slack history (see the note by
    _CONV). Returns reconstructed history to reseed _CONV if our most recent
    message in this channel was an unanswered question to THIS person and we
    haven't since confirmed a save; otherwise None (stay silent, as before)."""
    user = event.get("user")
    channel = event.get("channel")
    uid, bid = _bot_identity(client)
    if not uid and not bid:
        return None
    try:
        resp = client.conversations_history(channel=channel, limit=_RECOVERY_LOOKBACK)
    except Exception:
        log.exception("history fetch failed during recovery for %s", channel)
        return None
    msgs = list(reversed(resp.get("messages", [])))  # oldest -> newest
    # Index of the last message WE posted.
    last_bot_idx = None
    for i in range(len(msgs) - 1, -1, -1):
        if _is_ours(msgs[i], uid, bid):
            last_bot_idx = i
            break
    if last_bot_idx is None:
        return None
    # Was our last message a question waiting on a task field? (status unknown
    # from history, so lean on the same text heuristic used for live windows.)
    if not _is_asking("other", _clean(msgs[last_bot_idx].get("text", ""))):
        return None
    # The person answering must be the one we were building a task for: require an
    # earlier message from THIS user before our question, so we don't answer on a
    # bystander's behalf.
    if not any(m.get("user") == user for m in msgs[:last_bot_idx]):
        return None
    return _dialogue_from_history(msgs[:last_bot_idx + 1], uid, bid, user)


@app.event("app_mention")
def handle_mention(event, say, client):
    """Triggered when someone @mentions the bot in a channel."""
    text = _clean(event.get("text", ""))
    sector = config.sector_for_channel(event.get("channel"))
    if config.sectors_enabled() and sector is None:
        return  # sector mode on, but this isn't a sector channel — stay silent
    note = _ingest_files(event, sector)  # store any attached file(s) in Drive
    if not text and not note:
        say("Tell me what to do — e.g. \"what's due today?\"")
        return
    if _maybe_run_digest(text, say, client):
        return
    _respond(event, say, client, (text + note).strip(), manage_window=True, sector=sector)


@app.event("message")
def handle_message(event, say, client):
    """DMs: respond to everything. Channels: respond to a trigger word OR to any
    message from someone we're mid-conversation with (an open listening window)."""
    # Ignore the bot's own messages, edits, joins, etc. (prevents loops) — but
    # DO let file uploads through: those arrive as subtype 'file_share' and are
    # the whole point of Phase 2.
    subtype = event.get("subtype")
    if event.get("bot_id") or (subtype and subtype != "file_share"):
        return
    text = _clean(event.get("text", ""))
    has_files = bool(event.get("files"))
    if not text and not has_files:
        return

    if event.get("channel_type") == "im":
        if _maybe_run_digest(text, say, client):
            return
        uid = event.get("user")
        # Are we waiting for this person to say which sector a queued DM goes to?
        pending = _dm_pending_get(uid)
        if pending:
            picked = _interpret_sector_pick(text, pending["mine"])
            if picked is None:
                # Couldn't read the reply as a sector — ask again, keep the task.
                say(_sector_prompt(pending["mine"], retry=True))
                return
            # They named a sector: run their ORIGINAL message in it (files and
            # all), not this one-word reply.
            _dm_pending_clear(uid)
            orig = pending["event"]
            orig_text = _clean(orig.get("text", ""))
            note = _ingest_files(orig, picked)
            _mark_answered(_window_key(orig))
            _respond(orig, say, client, (orig_text + note).strip(),
                     manage_window=True, sector=picked)
            return
        # A DM has no sector channel, so derive the person's sector from their
        # channel memberships. One sector -> use it; several -> ask which one
        # (never guess across the wall); none -> decline.
        sector, command_text, refusal = _resolve_dm_sector(client, uid, text)
        if refusal is _ASK_SECTOR:
            # Multi-sector and they didn't name one: hold this message and ask.
            mine = _user_sectors(client, uid)
            _dm_pending_set(uid, event, mine)
            say(_sector_prompt(mine))
            return
        if refusal:
            # Not in any sector — but a Gally task may have been shared with them.
            # If so, give them a read/attach-only context for just their shared
            # task(s); otherwise show the normal 'not in a sector' refusal.
            syn = _assignee_only_sector(uid)
            if syn is None:
                say(refusal)
                return
            sector, command_text = syn, text
        note = _ingest_files(event, sector)  # store any attached file(s) in Drive
        # DMs read every message (no trigger needed), so the window's READ-gating
        # is moot here — but the nudge and auto-save TIMERS still matter: if the
        # bot asks for a missing field in a DM and the person never answers, we
        # still want to nudge once and then auto-save with placeholders. So manage
        # the window in DMs too, and mark their reply as answering any pending nudge.
        _mark_answered(_window_key(event))
        _respond(event, say, client, (command_text + note).strip(),
                 manage_window=True, sector=sector)
        return

    # Channel/group. If it's an @mention, let handle_mention own it.
    if _MENTION.search(event.get("text", "")):
        return
    sector = config.sector_for_channel(event.get("channel"))
    if config.sectors_enabled() and sector is None:
        return  # sector mode on, but this isn't a sector channel — stay silent
    wkey = _window_key(event)
    command = _triggered_command(text)
    if command is None:
        # No trigger. Engage only if we're already mid-conversation with this
        # person (i.e. we asked them something and are awaiting their answer).
        if not _window_active(wkey):
            # The in-memory window may simply have been wiped by a restart. Before
            # going silent, ask Slack's history whether we're still waiting on this
            # person, and if so rebuild the lost context and read their reply.
            channel = event.get("channel")
            recovered = None
            if time.time() - _recovery_checked.get(channel, 0) >= _RECOVERY_TTL:
                recovered = _recover_channel_window(client, event)
                if recovered is None:
                    _recovery_checked[channel] = time.time()  # nothing pending; back off
            if recovered is None:
                if has_files:
                    # A file with no trigger/window: we don't know which task it's
                    # for. Ask them to re-send with a caption rather than storing an
                    # orphan copy in Drive.
                    say("Got a file. Add a caption like "
                        "`task: attach to <task name>` so I know where it goes.")
                return  # not addressed to us — stay silent
            _CONV[_key(event)] = recovered  # reseed the context lost on restart
            log.info("recovered mid-conversation with %s from channel history", wkey)
        command = text  # read their follow-up answer as-is
    elif not command and not has_files:
        say("Add your request after the trigger, e.g. "
            "`task: Itay take out the trash, Monday, low`")
        return

    if _maybe_run_digest(command, say, client):
        return
    note = _ingest_files(event, sector)  # store any attached file(s) in Drive
    _mark_answered(wkey)  # their message answers any pending nudge
    _respond(event, say, client, (command + note).strip(),
             manage_window=True, sector=sector)


if __name__ == "__main__":
    digest.start(app.client)  # launch the daily digest scheduler (no-op if disabled)
    handler = SocketModeHandler(app, os.environ["SLACK_APP_TOKEN"])
    log.info("Task Bot connecting to Slack via Socket Mode...")
    handler.start()
