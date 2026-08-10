"""
Google Chat HTTP-endpoint app.

Google Chat POSTs an event here whenever the bot is messaged or added to a
space. We reply synchronously with JSON {"text": "..."}.

Event types we handle:
    ADDED_TO_SPACE     -> greeting
    MESSAGE            -> run the agent
    REMOVED_FROM_SPACE -> no response needed
"""
import logging
from flask import Flask, request, jsonify

import agent
from chat_auth import is_valid_chat_request

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("notion-chat-agent")

app = Flask(__name__)

GREETING = (
    "Hi! I'm your task assistant. Try:\n"
    "• \"Assign David to make the slide deck for Buokapi, due Friday\"\n"
    "• \"What does David have to do?\"\n"
    "• \"What's due today?\"\n"
    "• \"Show me all the tasks\""
)


@app.get("/")
def health():
    return "ok", 200


@app.post("/")
def on_event():
    if not is_valid_chat_request(request.headers.get("Authorization")):
        return "Unauthorized", 401

    event = request.get_json(silent=True) or {}
    event_type = event.get("type")

    if event_type == "ADDED_TO_SPACE":
        return jsonify({"text": GREETING})

    if event_type == "REMOVED_FROM_SPACE":
        return ("", 200)

    if event_type == "MESSAGE":
        message = event.get("message", {})
        # argumentText strips the bot @mention in spaces; fall back to text.
        text = (message.get("argumentText") or message.get("text") or "").strip()
        sender = event.get("user", {}).get("displayName") or "a teammate"

        if not text:
            return jsonify({"text": "Tell me what to do — e.g. \"what's due today?\""})

        try:
            reply = agent.handle_message(text, sender)
        except Exception as exc:
            log.exception("agent error")
            reply = f"Something went wrong: {exc}"
        return jsonify({"text": reply})

    # Unknown / unhandled event type.
    return ("", 200)


if __name__ == "__main__":
    import os
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
