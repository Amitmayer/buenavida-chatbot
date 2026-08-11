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

from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler

import agent

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


def _respond(event, say, client, command, *, manage_window: bool) -> None:
    """Generate a reply, post it, and (in channels) manage the listening window:
    keep listening if the bot asked for more info, stop once the task is made."""
    answer, status = _reply(command, _key(event), _sender_name(client, event))
    say(answer)

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


def _is_asking(status: str, answer: str) -> bool:
    """Decide whether the bot's reply is waiting on the person for info.

    History of this check: it first looked only for a trailing '?', which missed
    'Give me the due date and priority.' Then we added the English words 'due
    date'/'priority'. But in BATCH mode the bot asks WITHOUT calling create_task
    (so status is never 'needs_info'), and a Spanish reply ends on a period and
    uses 'prioridad'/'fecha' — so none of those checks fired and the window never
    opened. The reliable, language-agnostic signal is a question mark ANYWHERE in
    the reply (Spanish opens questions with '¿'), so we key off that."""
    if status == "needs_info":
        return True
    text = (answer or "")
    if "?" in text or "¿" in text:   # '?' or Spanish '¿' anywhere
        return True
    low = text.lower()
    return "due date" in low or "priority" in low


@app.event("app_mention")
def handle_mention(event, say, client):
    """Triggered when someone @mentions the bot in a channel."""
    text = _clean(event.get("text", ""))
    if not text:
        say("Tell me what to do — e.g. \"what's due today?\"")
        return
    _respond(event, say, client, text, manage_window=True)


@app.event("message")
def handle_message(event, say, client):
    """DMs: respond to everything. Channels: respond to a trigger word OR to any
    message from someone we're mid-conversation with (an open listening window)."""
    # Ignore the bot's own messages, edits, joins, etc. (prevents loops).
    if event.get("bot_id") or event.get("subtype"):
        return
    text = _clean(event.get("text", ""))
    if not text:
        return

    if event.get("channel_type") == "im":
        _respond(event, say, client, text, manage_window=False)
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
            return  # not addressed to us — stay silent
        command = text  # read their follow-up answer as-is
    elif not command:
        say("Add your request after the trigger, e.g. "
            "`task: Itay take out the trash, Monday, low`")
        return

    _mark_answered(wkey)  # their message answers any pending nudge
    _respond(event, say, client, command, manage_window=True)


if __name__ == "__main__":
    handler = SocketModeHandler(app, os.environ["SLACK_APP_TOKEN"])
    log.info("Task Bot connecting to Slack via Socket Mode...")
    handler.start()
