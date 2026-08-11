"""
The brain. Takes a natural-language message, lets Claude decide whether to
create or query tasks (via tool use), runs those Notion calls, and returns a
human-readable reply.

Task-creation policy: every new task MUST have a due date, a priority, and
details/notes. If any are missing, the bot asks for them instead of creating an
incomplete task. This is enforced both in Claude's instructions AND by a hard
guard below, so an incomplete task can never reach Notion.
"""
from datetime import date
import json
import requests

import config
import notion_client

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

# Fields that are mandatory when creating a task.
# Only these genuinely can't be inferred and must be supplied by the user.
# (Title and details are always derived from the request, never asked for.)
REQUIRED_FOR_CREATE = {
    "owner": "who it's assigned to",
    "due": "a due date",
    "priority": "a priority (High, Medium, or Low)",
}

# ---------------------------------------------------------------------------
# Tools exposed to Claude
# ---------------------------------------------------------------------------
TOOLS = [
    {
        "name": "create_task",
        "description": (
            "Create a new task in Notion. Always write a concise title yourself "
            "from the request, take the owner from the message, and use the "
            "message itself as the details/notes \u2014 never ask the user for a "
            "title or for details that are already implied. The ONLY things you "
            "must ask the user for (when missing) are the due date and the "
            "priority. Do not invent a due date or priority."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "A concise task name you write yourself from the request."},
                "owner": {"type": "string", "description": "Person responsible, taken from the message, e.g. 'Gally'."},
                "due": {"type": "string", "description": "Due date as YYYY-MM-DD. Resolve relative dates like 'Sunday' yourself. Ask the user if not given."},
                "priority": {"type": "string", "description": "High, Medium, or Low. Ask the user if not given."},
                "notes": {"type": "string", "description": "Details/context, derived from the user's message. Always include."},
                "status": {"type": "string", "description": "Status if stated; otherwise omit to use the default."},
            },
            "required": ["title"],
        },
    },
    {
        "name": "query_tasks",
        "description": (
            "Look up tasks in Notion. Use this whenever the user asks what "
            "exists, what's outstanding, what's due, or before updating a task. "
            "All filters are optional — call it with NO filters (or just "
            "incomplete=true) to list everything; do NOT ask the user for a "
            "filter first. To list every task that isn't finished, set "
            "incomplete=true. Results come back sorted by due date (earliest "
            "first), and each task includes an 'overdue' flag (true if its due "
            "date is before today)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "incomplete": {"type": "boolean", "description": "True to return only tasks that are NOT done (any status other than Done/Complete/Cancelled/Archived). Use this for 'what's left', 'outstanding', 'not completed', 'still open', and for 'all current tasks'."},
                "owner": {"type": "string", "description": "Filter to one person's tasks. Matched fuzzily, so pass the requester's name (e.g. their Slack name) to get their own tasks. Use this when someone asks for 'my tasks' or 'what am I assigned'."},
                "status": {"type": "string", "description": "Filter to an exact status, e.g. 'In progress'."},
                "priority": {"type": "string", "description": "Filter by priority: High, Medium, or Low."},
                "due_on": {"type": "string", "description": "Tasks due on this exact date, YYYY-MM-DD."},
                "due_before": {"type": "string", "description": "Tasks due on or before this date, YYYY-MM-DD."},
                "due_after": {"type": "string", "description": "Tasks due on or after this date, YYYY-MM-DD."},
                "search": {"type": "string", "description": "Keyword to match in the task title."},
                "limit": {"type": "integer", "description": "Max number of tasks to return. Omit to return all."},
            },
            "required": [],
        },
    },
    {
        "name": "update_task",
        "description": (
            "Update an existing task or mark it complete. You must first call "
            "query_tasks to find the task and read its 'id' from the results, "
            "then call update_task with that id. To mark a task complete/done, "
            "set status to 'Done'. Only include the fields you are changing. "
            "If several tasks match, ask the user which one; if none match, say "
            "you couldn't find it. Never guess an id."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "The task's Notion id, taken from query_tasks results. Required."},
                "status": {"type": "string", "description": "New status, e.g. 'Done' to complete it, or 'In progress'."},
                "due": {"type": "string", "description": "New due date as YYYY-MM-DD."},
                "priority": {"type": "string", "description": "New priority: High, Medium, or Low."},
                "owner": {"type": "string", "description": "Reassign the task to this person."},
                "title": {"type": "string", "description": "A new title for the task."},
                "notes": {"type": "string", "description": "New or updated details."},
            },
            "required": ["task_id"],
        },
    },
]


def _create_task_guarded(title=None, owner=None, due=None, priority=None,
                         status=None, notes=None):
    """Refuse to create a task unless required fields are present."""
    values = {"title": title, "owner": owner, "due": due,
              "priority": priority, "notes": notes}
    missing = [label for field, label in REQUIRED_FOR_CREATE.items() if not values[field]]
    if missing:
        return {
            "created": False,
            "needs_more_info": True,
            "missing": missing,
            "message": (
                "This task can't be created yet. Ask the user to provide: "
                + ", ".join(missing)
                + ". Do not create the task until all are given."
            ),
        }
    return notion_client.create_task(
        title=title, owner=owner, due=due, priority=priority,
        status=status, notes=notes,
    )


TOOL_IMPLS = {
    "create_task": _create_task_guarded,
    "query_tasks": notion_client.query_tasks,
    "update_task": notion_client.update_task,
}


def _system_prompt(sender_name: str) -> str:
    today = date.today().isoformat()
    return (
        "You are the team's task assistant for a Notion-backed task tracker, "
        "operating inside Slack.\n"
        f"Today's date is {today}. The message is from {sender_name}.\n\n"
        "Rules:\n"
        "- LANGUAGE: reply in the SAME language the user wrote in. If a message "
        "is in Spanish, answer entirely in Spanish (including section headings "
        "and any question you ask); if it's in English, answer in English. "
        "Match each message's language independently.\n"
        "- When asked to create/assign a task: write a concise TITLE yourself "
        "and use the message as the DETAILS/notes. Never ask for a title or for "
        "details \u2014 infer them. The ONLY things you may ask the user for are the "
        "OWNER (who it's assigned to), the DUE DATE, and the PRIORITY "
        "(High/Medium/Low), and only when they're missing. Do not invent an "
        "owner, due date, or priority.\n"
        "- ASK FOR EVERYTHING MISSING AT ONCE. Before creating anything, scan "
        "EVERY task in the request and gather ALL missing fields (owner, due "
        "date, priority) across ALL of them. Ask for every gap in ONE "
        "consolidated, numbered message grouped by task, then wait. Never ask in "
        "separate waves, and never create some tasks while others in the same "
        "request are still missing info \u2014 collect all the answers first, then "
        "create every task together.\n"
        "- Use the earlier messages in this conversation for context: if the "
        "user already said who/what in a previous message and is now replying "
        "with the due date or priority, combine them and create the task \u2014 do "
        "not start over or re-ask.\n"
        "- Convert relative dates (e.g. 'Sunday', 'tomorrow', 'next week') into "
        "a concrete YYYY-MM-DD date using today's date.\n"
        "- If create_task returns needs_more_info, ask the user only for the "
        "listed missing fields and try again once they reply.\n"
        "- When asked about existing work, call query_tasks. NEVER refuse or ask "
        "the user for a filter first — if they don't give one, call query_tasks "
        "with no filters. For 'what's left', 'outstanding', 'not completed', "
        "'still open', or 'all current tasks', call query_tasks with "
        "incomplete=true (this excludes tasks marked Done). For 'due today', set "
        "due_on to today's date.\n"
        f"- When someone asks for THEIR OWN tasks ('my tasks', 'what do I have', "
        f"'what am I assigned'), call query_tasks with owner set to the sender's "
        f"name ({sender_name}) and incomplete=true. The owner match is fuzzy, so "
        "pass their name as-is.\n"
        "- ORGANIZE every task listing BY DUE DATE, earliest first (the results "
        "are already in that order). List CURRENT (not-overdue) tasks FIRST "
        "under a bold heading '*Upcoming:*', then list any tasks whose "
        "'overdue' flag is true BELOW them under a bold heading '*Past due:*'. "
        "Upcoming always comes above Past due. Within each section keep "
        "due-date order. Omit the 'Past due' section entirely if nothing is "
        "overdue. Translate the headings to match the user's language (e.g. "
        "'Próximas:' / 'Vencidas:' in Spanish). Never show tasks marked Done "
        "in these listings.\n"
        "- When someone asks what they HAVE TO DO or for their own tasks "
        "(e.g. 'what do I have to do', 'qué tengo que hacer', 'my tasks', "
        "'what's on my plate'), ALWAYS include their overdue tasks in the "
        "'Past due' section — never hide them. If they have any past-due "
        "tasks, end your reply by asking whether they'd like to mark any of "
        "the past-due ones done/resolved (ask this in their language).\n"
        "- To update a task or mark it complete: first call query_tasks to find "
        "it (by keyword and/or owner), take the matching task's 'id' from the "
        "results, then call update_task with that id. To complete a task, set "
        "status to 'Done'. If multiple tasks match, ask the user which one; if "
        "none match, say you couldn't find it. Never guess an id.\n"
        "- After a tool runs, reply concisely using SLACK formatting (mrkdwn). "
        "CRITICAL: Slack bold uses a SINGLE asterisk on each side, like "
        "*bold* \u2014 never use **double** asterisks, which Slack renders "
        "literally. Bold every section heading and every task title. "
        "List each task as a short line: '\u2022 *<task>* \u2014 <owner>, <when> "
        "(<priority>, <status>)'. For <when>, use the task's OWN precomputed "
        "fields and NEVER the raw 'due' field, and NEVER add a word like "
        "'due'/'vence': if 'due_this_week' is true, write 'This <weekday> "
        "<due_display>' and translate 'This' and the weekday into the reply's "
        "language (e.g. English 'This Monday 17/8/2026', Spanish 'este lunes "
        "17/8/2026'); otherwise write just '<due_display>' (e.g. '12/8/2026'). "
        "Use 'due_display' (already day/month/year) and 'weekday' verbatim \u2014 "
        "do not reformat or recompute the date. Skip empty fields. Confirm "
        "creations with the task name only. Do NOT include a Notion link or "
        "URL in any reply — not everyone has Notion access."
    )


def _call_claude(messages: list, system: str) -> dict:
    headers = {
        "x-api-key": config.require("ANTHROPIC_API_KEY", config.ANTHROPIC_API_KEY),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": config.ANTHROPIC_MODEL,
        "max_tokens": 1024,
        "system": system,
        "tools": TOOLS,
        "messages": messages,
    }
    resp = requests.post(ANTHROPIC_URL, headers=headers, json=body, timeout=60)
    if resp.status_code >= 400:
        raise RuntimeError(f"Anthropic call failed ({resp.status_code}): {resp.text}")
    return resp.json()


def _strip_urls(obj):
    """Recursively drop any 'url' keys so Notion links never reach Claude
    (and therefore never reach the chat reply). Not everyone has Notion access."""
    if isinstance(obj, dict):
        return {k: _strip_urls(v) for k, v in obj.items() if k != "url"}
    if isinstance(obj, list):
        return [_strip_urls(v) for v in obj]
    return obj


def _run_tool(name: str, args: dict):
    impl = TOOL_IMPLS.get(name)
    if not impl:
        return {"error": f"Unknown tool: {name}"}
    try:
        return _strip_urls(impl(**args))
    except Exception as exc:
        return {"error": str(exc)}


def handle_message(text: str, sender_name: str = "a teammate", history=None):
    """Main entry point. `history` is a list of prior {role, content} text turns
    (oldest first) that gives the bot short-term memory across messages.

    Returns a (reply_text, status) tuple. `status` lets the Slack layer know
    whether it should keep listening for a follow-up:
        "created"    - a task was successfully created this turn (done)
        "needs_info" - create_task was blocked waiting on due date / priority
        "other"      - anything else (a listing, a plain answer, etc.)
    """
    system = _system_prompt(sender_name)
    messages = list(history or []) + [{"role": "user", "content": text}]

    created = False       # a task reached Notion this turn
    needs_info = False    # create was blocked waiting on due date / priority

    for _ in range(6):  # safety cap on tool round-trips
        data = _call_claude(messages, system)
        content = data.get("content", [])
        stop = data.get("stop_reason")
        messages.append({"role": "assistant", "content": content})

        if stop != "tool_use":
            texts = [b["text"] for b in content if b.get("type") == "text"]
            reply = "\n".join(texts).strip() or "Done."
            status = "created" if created else ("needs_info" if needs_info else "other")
            return reply, status

        tool_results = []
        for block in content:
            if block.get("type") != "tool_use":
                continue
            result = _run_tool(block["name"], block.get("input", {}))
            if block["name"] == "create_task" and isinstance(result, dict):
                if result.get("created"):
                    created = True
                if result.get("needs_more_info"):
                    needs_info = True
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block["id"],
                "content": json.dumps(result, default=str),
            })
        messages.append({"role": "user", "content": tool_results})

    return "Sorry — I got stuck working on that. Mind rephrasing?", "other"
