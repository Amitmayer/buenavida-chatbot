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


def _reply(text: str, key: str, sender_name: str = "a teammate") -> str:
    history = _CONV.get(key, [])
    try:
        answer = agent.handle_message(text, sender_name, history=history)
    except Exception as exc:  # never let one bad message kill the listener
        log.exception("agent error")
        return f"Something went wrong: {exc}"
    # Save this exchange for context on the next message.
    _CONV[key] = (history + [
        {"role": "user", "content": text},
        {"role": "assistant", "content": answer},
    ])[-_MAX_TURNS:]
    return answer


@app.event("app_mention")
def handle_mention(event, say, client):
    """Triggered when someone @mentions the bot in a channel."""
    text = _clean(event.get("text", ""))
    if not text:
        say("Tell me what to do — e.g. \"what's due today?\"")
        return
    say(_reply(text, _key(event), _sender_name(client, event)))


@app.event("message")
def handle_message(event, say, client):
    """DMs: respond to everything. Channels: respond only to messages that start
    with a trigger word (see TRIGGER_PREFIXES)."""
    # Ignore the bot's own messages, edits, joins, etc. (prevents loops).
    if event.get("bot_id") or event.get("subtype"):
        return
    text = _clean(event.get("text", ""))
    if not text:
        return

    if event.get("channel_type") == "im":
        command = text  # direct message: no trigger needed
    else:
        # Channel/group. If it's an @mention, let handle_mention own it.
        if _MENTION.search(event.get("text", "")):
            return
        command = _triggered_command(text)
        if command is None:
            return  # not addressed to us — stay silent
        if not command:
            say("Add your request after the trigger, e.g. "
                "`task: Itay take out the trash, Monday, low`")
            return

    say(_reply(command, _key(event), _sender_name(client, event)))


if __name__ == "__main__":
    handler = SocketModeHandler(app, os.environ["SLACK_APP_TOKEN"])
    log.info("Task Bot connecting to Slack via Socket Mode...")
    handler.start()
