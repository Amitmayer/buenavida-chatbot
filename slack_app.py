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
import drive_client

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
    Expired windows are cleaned up here."""
    with _PENDING_LOCK:
        p = _PENDING.get(wkey)
        if not p:
            return False
        if time.time() > p["expires_at"]:
            if p.get("timer"):
                p["timer"].cancel()
            _PENDING.pop(wkey, None)
            return False
        return True


def _clear_pending(wkey: str) -> None:
    """Close a window and cancel any pending nudge (task done or conversation over)."""
    with _PENDING_LOCK:
        p = _PENDING.pop(wkey, None)
    if p and p.get("timer"):
        p["timer"].cancel()


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


def _open_window(wkey, client, channel, thread_ts, user, question) -> None:
    """(Re)open a listening window and (re)arm the 2-minute nudge. Called every
    time the bot asks for more info, so the timers roll forward each exchange."""
    with _PENDING_LOCK:
        prev = _PENDING.get(wkey)
        if prev and prev.get("timer"):
            prev["timer"].cancel()
        _PENDING[wkey] = {
            "user": user,
            "channel": channel,
            "thread_ts": thread_ts,
            "expires_at": time.time() + WINDOW_SECONDS,
            "question": question,
            "answered": False,
            "timer": None,
        }
    timer = _schedule_followup(wkey, client, channel, thread_ts, user, question)
    with _PENDING_LOCK:
        p = _PENDING.get(wkey)
        if p is not None:
            p["timer"] = timer


def _clean(text: str) -> str:
    return _MENTION.sub("", text or "").strip()


def _key(event: dict) -> str:
    # Group by thread when present, otherwise by channel/DM.
    return event.get("thread_ts") or event.get("channel") or "default"


# In a shared channel the bot stays SILENT unless a message starts with one of
# these trigger prefixes (case-insensitive). This keeps it from reacting to (and
# spending API calls on) every message in a channel with other people. DMs and
# @mentions don't need a trigger.
TRIGGER_PREFIXES = ("task:", "!task", "/task")


def _triggered_command(text: str):
    """If a channel message starts with a trigger prefix, return the command
    text after it; otherwise return None so the bot stays silent."""
    stripped = (text or "").lstrip()
    low = stripped.lower()
    for pfx in TRIGGER_PREFIXES:
        if low.startswith(pfx):
            return stripped[len(pfx):].strip()
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


def _reply(text: str, key: str, sender_name: str = "a teammate"):
    """Run one message through the agent. Returns (answer_text, status) where
    status is 'created' / 'needs_info' / 'other' (see agent.handle_message)."""
    history = _CONV.get(key, [])
    try:
        answer, status = agent.handle_message(text, sender_name, history=history)
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


def _ingest_files(event) -> str:
    """Store any uploaded files in Drive and return a note (to append to the
    command) describing each file's name + Drive link. Empty string if there are
    no files. If Drive isn't configured, returns a note telling the agent to say
    so rather than silently dropping the upload."""
    files = event.get("files") or []
    if not files:
        return ""
    if not drive_client.is_configured():
        log.warning("file uploaded but Drive not configured")
        return ("\n\n[SYSTEM: The user uploaded a file, but file storage isn't "
                "set up yet, so it could not be saved. Tell them file uploads "
                "aren't available yet.]")
    stored = []
    for f in files:
        name = f.get("name") or f.get("title") or "file"
        try:
            data = _download_slack_file(f)
            res = drive_client.upload_bytes(name, data, f.get("mimetype"))
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


def _respond(event, say, client, command, *, manage_window: bool) -> None:
    """Generate a reply, post it, and (in channels) manage the listening window:
    keep listening if the bot asked for more info, stop once the task is made."""
    answer, status = _reply(command, _key(event), _sender_name(client, event))
    say(answer)
    _deliver_queued(event, client)  # re-upload any files the agent queued

    if not manage_window:
        return  # DMs already read every message, so no window is needed

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
            answer,
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


@app.event("app_mention")
def handle_mention(event, say, client):
    """Triggered when someone @mentions the bot in a channel."""
    text = _clean(event.get("text", ""))
    note = _ingest_files(event)  # store any attached file(s) in Drive
    if not text and not note:
        say("Tell me what to do — e.g. \"what's due today?\"")
        return
    _respond(event, say, client, (text + note).strip(), manage_window=True)


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
        note = _ingest_files(event)  # store any attached file(s) in Drive
        _respond(event, say, client, (text + note).strip(), manage_window=False)
        return

    # Channel/group. If it's an @mention, let handle_mention own it.
    if _MENTION.search(event.get("text", "")):
        return
    wkey = _window_key(event)
    command = _triggered_command(text)
    if command is None:
        # No trigger. Engage only if we're already mid-conversation with this
        # person (i.e. we asked them something and are awaiting their answer).
        if not _window_active(wkey):
            if has_files:
                # A file with no trigger/window: we don't know which task it's
                # for. Ask them to re-send with a caption rather than storing an
                # orphan copy in Drive.
                say("Got a file. Add a caption like "
                    "`task: attach to <task name>` so I know where it goes.")
            return  # not addressed to us — stay silent
        command = text  # read their follow-up answer as-is
    elif not command and not has_files:
        say("Add your request after the trigger, e.g. "
            "`task: Itay take out the trash, Monday, low`")
        return

    note = _ingest_files(event)  # store any attached file(s) in Drive
    _mark_answered(wkey)  # their message answers any pending nudge
    _respond(event, say, client, (command + note).strip(), manage_window=True)


if __name__ == "__main__":
    handler = SocketModeHandler(app, os.environ["SLACK_APP_TOKEN"])
    log.info("Task Bot connecting to Slack via Socket Mode...")
    handler.start()
