"""
The brain. Takes a natural-language message, lets Claude decide whether to
create or query tasks (via tool use), runs those Notion calls, and returns a
human-readable reply.

Task-creation policy: every new task MUST have a due date, a priority, and
details/notes. If any are missing, the bot asks for them instead of creating an
incomplete task. This is enforced both in Claude's instructions AND by a hard
guard below, so an incomplete task can never reach Notion.
"""
from datetime import date, timedelta
import json
import re
import threading
import unicodedata

import requests

import config
import notion_client
import drive_client

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

# ---------------------------------------------------------------------------
# File delivery side-channel.
#
# The model never sees material URLs (see _strip_urls), so it can't hand a Drive
# link back to Slack. Instead, when the user asks for a task's file, the model
# calls deliver_material; the tool queues the file (id + name) HERE, on a
# thread-local list, and returns only a url-free confirmation. After
# handle_message finishes, the Slack layer drains this queue with pop_deliveries()
# and re-uploads the bytes into the channel (so people without Drive access still
# get the file). Thread-local because Bolt may handle events concurrently and each
# handle_message runs its whole tool loop in one thread.
# ---------------------------------------------------------------------------
_DELIVERIES = threading.local()


def _queue_delivery(file_id: str, name: str) -> None:
    if not getattr(_DELIVERIES, "items", None):
        _DELIVERIES.items = []
    _DELIVERIES.items.append({"file_id": file_id, "name": name})


def pop_deliveries() -> list:
    """Return and clear any files queued for Slack re-upload this turn."""
    items = getattr(_DELIVERIES, "items", None) or []
    _DELIVERIES.items = []
    return items

# ---------------------------------------------------------------------------
# Share-notification side-channel.
#
# When a Gally-sector task is assigned to a non-member, we create it in the shared
# database and need to DM the assignee that Gally shared a task with them. The
# agent layer can't post to Slack, so (exactly like file delivery above) it QUEUES
# the notification here on a thread-local; after handle_message returns, the Slack
# layer drains it with pop_shares() and opens the DM. Thread-local so concurrent
# conversations never cross-post.
# ---------------------------------------------------------------------------
_SHARES = threading.local()


def _queue_share(assignee_id: str, title: str, assigner: str, due=None,
                 priority=None) -> None:
    if not getattr(_SHARES, "items", None):
        _SHARES.items = []
    _SHARES.items.append({
        "assignee_id": assignee_id, "title": title, "assigner": assigner,
        "due": due, "priority": priority,
    })


def pop_shares() -> list:
    """Return and clear any assignee DMs queued for delivery this turn."""
    items = getattr(_SHARES, "items", None) or []
    _SHARES.items = []
    return items

# ---------------------------------------------------------------------------
# Force / finalize mode.
#
# Normally an incomplete task (missing owner/due/priority) is NOT saved — the bot
# asks for the gaps and waits. But if the person walks away and the listening
# window expires, we don't want to lose the task. finalize_pending_task() flips
# this thread-local flag on and re-runs the conversation with an instruction to
# create the task now; while the flag is on, _create_task_guarded saves the task
# anyway, filling each missing required field with a placeholder instead of
# blocking. Thread-local so a finalize on one conversation never affects another.
# ---------------------------------------------------------------------------
_FORCE = threading.local()


def _allow_partial() -> bool:
    return bool(getattr(_FORCE, "on", False))

# ---------------------------------------------------------------------------
# Sector context (access isolation).
#
# The bot is a superuser across every sector, so isolation MUST live in code,
# keyed to the Slack CHANNEL a message arrived on — never in the prompt (a task
# note could try to talk the model into crossing sectors). handle_message stores
# the caller's sector here, on a thread-local, and the Notion tool wrappers read
# the active/history database ids from it. The MODEL never sees or controls a
# database id: it only ever passes task fields, and the wrapper injects the id.
# That is what stops a person in two sectors from reaching one sector's data
# while acting in the other's channel.
#
# When no sector is set (single-database mode), the ids are None and the Notion
# layer falls back to config.NOTION_DATABASE_ID — i.e. exactly the old behavior.
# ---------------------------------------------------------------------------
_CTX = threading.local()


def _set_ctx(sector) -> None:
    """Set (or clear) the active sector for this thread. Always called at the top
    of handle_message so a previous call's sector never leaks into the next.

    Beyond the sector's own databases, the Slack layer may ENRICH the sector dict
    with sharing context (see slack_app._enrich_sector): the global shared-tasks
    database, the set of Slack ids that count as the shared sector's own members
    (so we can tell an assignee from an owner), the requesting user's Slack id, a
    name->Slack-id resolver, and the shared sector's canonical owner label. These
    are all None/empty unless sharing is configured, keeping every other sector
    exactly as before."""
    sector = sector or {}
    _CTX.active_db = sector.get("active_db")
    _CTX.history_db = sector.get("history_db")
    _CTX.sector_name = sector.get("sector")
    _CTX.subsector = sector.get("subsector")
    # Sharing context (all optional; inert when sharing isn't configured).
    _CTX.shared_db = sector.get("shared_db")            # global shared-tasks DB (reads)
    _CTX.can_share = bool(sector.get("can_share"))      # this sector may ASSIGN out
    _CTX.member_ids = set(sector.get("member_ids") or ())  # shared sector's members
    _CTX.is_member = bool(sector.get("is_member"))      # requester is a member
    _CTX.requester_id = sector.get("requester_id")      # requester's Slack id
    _CTX.resolve_owner = sector.get("resolve_owner")    # callable name -> slack id|None
    _CTX.sector_owner = sector.get("owner")             # canonical owner (e.g. "Gally Mayer")


def _ctx_active():
    return getattr(_CTX, "active_db", None)


def _ctx_history():
    return getattr(_CTX, "history_db", None)


def _ctx_subsector():
    return getattr(_CTX, "subsector", None)


def _ctx_shared_db():
    return getattr(_CTX, "shared_db", None)


def _ctx_can_share():
    return bool(getattr(_CTX, "can_share", False))


def _ctx_member_ids():
    return getattr(_CTX, "member_ids", set()) or set()


def _ctx_is_member():
    return bool(getattr(_CTX, "is_member", False))


def _ctx_requester():
    return getattr(_CTX, "requester_id", None)


def _ctx_resolve_owner():
    return getattr(_CTX, "resolve_owner", None)


def _ctx_sector_owner():
    return getattr(_CTX, "sector_owner", None)


def finalize_pending_task(history=None, sender_name: str = "a teammate", sector=None):
    """Force-create the task currently under discussion, filling any still-missing
    required field with a placeholder. Called by the Slack layer when a channel
    listening window expires with no reply, so a forgotten task is saved rather
    than lost. Reuses the conversation history so the task keeps its title, owner,
    and details from the original request. Returns (reply_text, created_bool).

    `sector` routes the auto-saved task to the right sector database (same
    isolation as a live message)."""
    _FORCE.on = True
    try:
        instruction = (
            "[SYSTEM: The person never replied and the waiting window has expired. "
            "Create the task NOW from what was already provided earlier in this "
            "conversation — do not ask any more questions. Any required field "
            "still missing (owner, due date, or priority) will be saved as a "
            "placeholder automatically. After creating it, tell the person, in "
            "their language, that you saved the task with placeholders for the "
            "missing fields, and name which fields those are so they can fill them "
            "in later.]"
        )
        reply, status = handle_message(instruction, sender_name, history=history,
                                       sector=sector)
        return reply, (status == "created")
    finally:
        _FORCE.on = False

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
                "due": {"type": "string", "description": "Due date as YYYY-MM-DD. You may also pass a relative phrase and it will be resolved server-side (e.g. 'mañana', 'hoy', 'lunes', 'tomorrow', 'next week', 'en 3 dias'). Ask the user if not given. If the user explicitly says there is no due date (e.g. 'sin especificar', 'sin fecha', 'not specified', 'no due date'), pass that phrase through as the due value — do NOT invent a date and do NOT keep re-asking; the task will be created with no due date."},
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
                "due": {"type": "string", "description": "New due date as YYYY-MM-DD, or a relative phrase resolved server-side (e.g. 'mañana', 'lunes', 'tomorrow', 'next week')."},
                "priority": {"type": "string", "description": "New priority: High, Medium, or Low."},
                "owner": {"type": "string", "description": "Reassign the task to this person."},
                "title": {"type": "string", "description": "A new title for the task."},
                "notes": {"type": "string", "description": "New or updated details."},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "attach_material",
        "description": (
            "Attach a MATERIAL (a link/URL to a document or file) to an existing "
            "task. Materials are OPTIONAL reference documents — only use this "
            "when the user explicitly wants to attach a link to a task. First "
            "call query_tasks to find the task and read its 'id', then call this "
            "with that id and the URL. If the user gives a name/label for the "
            "link, pass it as 'label'; otherwise omit it. This appends — it "
            "never removes existing materials."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "The task's Notion id, from query_tasks results. Required."},
                "url": {"type": "string", "description": "The link/URL to the document or file. Required."},
                "label": {"type": "string", "description": "Optional human name for the link, e.g. 'LinkedIn Post for Coffee'. Omit if the user didn't give one."},
            },
            "required": ["task_id", "url"],
        },
    },
    {
        "name": "deliver_material",
        "description": (
            "Send a task's attached file(s) to the person in Slack. Use this when "
            "someone asks to GET, SEND, DOWNLOAD, or SHARE a task's file/material "
            "(e.g. 'send me the file for the LinkedIn task'). First call "
            "query_tasks to find the task and read its 'id', then call this with "
            "that id. The file bytes are uploaded straight into the Slack "
            "conversation, so everyone gets the file even without Drive access. "
            "Optionally pass 'name' to send only the material whose name matches; "
            "omit it to send all of the task's files. After calling, just confirm "
            "in words which file(s) you sent — do NOT print any link."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "The task's Notion id, from query_tasks results. Required."},
                "name": {"type": "string", "description": "Optional: send only the material whose name matches this. Omit to send all files on the task."},
            },
            "required": ["task_id"],
        },
    },
]


def _deliver_material(task_id, name=None) -> dict:
    """Queue a task's file(s) for re-upload into Slack. Reads the real Drive
    links from Notion (bypassing the url-stripping the model sees), turns each
    into a Drive file id, and queues it. Returns a url-free summary."""
    if not drive_client.is_configured():
        return {"delivered": False,
                "message": "File delivery isn't set up (Drive not configured)."}
    materials = notion_client.get_materials(task_id) or []
    if name:
        want = str(name).strip().lower()
        materials = [m for m in materials
                     if want in (m.get("name") or "").lower()]
    if not materials:
        return {"delivered": False,
                "message": "No matching file is attached to that task."}
    sent, skipped = [], []
    for m in materials:
        fid = drive_client.extract_file_id(m.get("url"))
        if fid:
            _queue_delivery(fid, m.get("name") or "file")
            sent.append(m.get("name") or "file")
        else:
            # Not a Drive link (e.g. a plain external URL) — can't re-upload bytes.
            skipped.append(m.get("name") or "file")
    return {"delivered": bool(sent), "sent": sent, "skipped": skipped,
            "count": len(sent)}


# ---------------------------------------------------------------------------
# Relative-date resolution.
#
# The model is told to pass ISO dates, but it doesn't always resolve relative
# phrases correctly (e.g. a Spanish "Mañana" answer once landed as a blank due
# date). So we resolve a small, closed set of ES/EN relative phrases in code —
# deterministically — instead of trusting the model as the only line of defense.
# ISO dates pass straight through; anything we don't recognize returns None so
# the existing "missing due date" guard still fires.
# ---------------------------------------------------------------------------
_WEEKDAYS = {
    "lunes": 0, "martes": 1, "miercoles": 2, "jueves": 3, "viernes": 4,
    "sabado": 5, "domingo": 6,
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4,
    "saturday": 5, "sunday": 6,
}
_ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_IN_N_DAYS_RE = re.compile(r"^(?:en|in)\s+(\d{1,3})\s+(?:dias?|days?)$")


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")


def _resolve_due(value, today=None):
    """Turn a due-date value into an ISO YYYY-MM-DD string, or None.

    - None/empty -> None.
    - A valid ISO date -> passed through (validated).
    - A recognized relative phrase (ES/EN) -> resolved against `today`.
    - Anything else -> None (so the missing-due guard still fires)."""
    if not value:
        return None
    raw = str(value).strip()
    if _ISO_RE.match(raw):
        try:
            date.fromisoformat(raw)
            return raw
        except ValueError:
            return None

    today = today or date.today()
    key = _strip_accents(raw).lower().strip()
    key = re.sub(r"\s+", " ", key)

    if key in ("hoy", "today"):
        return today.isoformat()
    if key in ("manana", "tomorrow"):
        return (today + timedelta(days=1)).isoformat()
    if key in ("pasado manana", "day after tomorrow"):
        return (today + timedelta(days=2)).isoformat()
    if key in ("proxima semana", "la proxima semana", "semana proxima",
               "next week"):
        return (today + timedelta(days=7)).isoformat()
    if key in ("fin de semana", "el fin de semana", "weekend",
               "this weekend"):
        days = (5 - today.weekday()) % 7  # coming Saturday
        return (today + timedelta(days=days)).isoformat()

    m = _IN_N_DAYS_RE.match(key)
    if m:
        return (today + timedelta(days=int(m.group(1)))).isoformat()

    # bare weekday name -> strictly upcoming occurrence
    wd = _WEEKDAYS.get(key)
    if wd is not None:
        days = (wd - today.weekday()) % 7 or 7
        return (today + timedelta(days=days)).isoformat()

    return None


# Phrases that mean "the user deliberately chose no due date." These count as a
# real answer to the due-date question, so the create guard stops blocking on it.
_UNSPECIFIED_DUE = {
    "sin especificar", "no especificar", "no especificada", "no especificado",
    "sin fecha", "sin fecha de vencimiento", "sin plazo", "sin vencimiento",
    "no due date", "no due", "not specified", "unspecified", "no deadline",
    "ninguna", "ninguno", "none", "na", "n/a",
}


def _is_unspecified_due(value):
    """True if the user explicitly declined a due date (ES/EN)."""
    if not value:
        return False
    key = _strip_accents(str(value)).lower().strip()
    key = re.sub(r"[.\s]+$", "", key)      # drop trailing punctuation/space
    key = re.sub(r"\s+", " ", key)
    return key in _UNSPECIFIED_DUE


def _shared_assignee(owner):
    """If THIS create is a shared-sector task (e.g. Gally) assigned to someone who
    is NOT one of that sector's channel members, return the assignee's Slack id;
    otherwise None (create normally in the sector's own database).

    Deterministic given the enriched context: it resolves the owner NAME to a
    Slack id via the injected resolver, then treats it as a shared assignment only
    when the id is real AND not one of the sector's own members (Gally / Naty). No
    resolver, no shared_db, an unresolvable name, or a member -> None, so the task
    stays in the sector's active database exactly as before."""
    if not _ctx_can_share() or not _ctx_shared_db() or not owner:
        return None
    resolver = _ctx_resolve_owner()
    if not resolver:
        return None
    try:
        oid = resolver(owner)
    except Exception:
        oid = None
    if not oid:
        return None                    # unidentifiable person -> keep it local
    if oid in _ctx_member_ids():
        return None                    # assigned to Gally/Naty -> a normal task
    return oid


def _create_task_guarded(title=None, owner=None, due=None, priority=None,
                         status=None, notes=None):
    """Refuse to create a task unless required fields are present — UNLESS we're
    in finalize mode (a listening window expired), in which case we save the task
    anyway and fill each missing required field with a placeholder so the task is
    never lost."""
    # A user can explicitly decline a due date ("sin especificar" / "not
    # specified"). That is a valid answer: we create the task with no due date
    # rather than blocking on it.
    due_declined = _is_unspecified_due(due)
    due = None if due_declined else _resolve_due(due)  # ISO/relative -> ISO; else None
    values = {"title": title, "owner": owner, "due": due,
              "priority": priority, "notes": notes}
    missing = [field for field in REQUIRED_FOR_CREATE if not values.get(field)]
    if due_declined and "due" in missing:
        missing.remove("due")  # deliberately blank, not missing

    if missing and not _allow_partial():
        labels = [REQUIRED_FOR_CREATE[f] for f in missing]
        return {
            "created": False,
            "needs_more_info": True,
            "missing": labels,
            "message": (
                "This task can't be created yet. Ask the user to provide: "
                + ", ".join(labels)
                + ". Do not create the task until all are given."
            ),
        }

    placeholders = []
    if missing:  # finalize mode: save with placeholders instead of blocking
        if not title:
            title = "Untitled task"
        if "owner" in missing:
            owner = config.UNSPECIFIED_LABEL
        if "priority" in missing:
            priority = config.UNSPECIFIED_LABEL
        # 'due' is a real date property and cannot hold placeholder text, so we
        # leave it blank (which reads as "no due date").
        placeholders = [REQUIRED_FOR_CREATE[f] for f in missing]
        flag = "[Auto-saved without a reply. Unspecified: " + ", ".join(placeholders) + ".]"
        notes = (notes + "\n\n" + flag) if notes else flag

    # Sharing: if this sector may assign out (Gally) and the owner resolves to a
    # non-member, the task is created in the SHARED database instead of the
    # sector's own one. It stays under the sector principal's ownership (owner ->
    # the sector owner, e.g. "Gally Mayer"); the assignee is recorded in the
    # "Shared with" column (their Slack id) and in a notes marker, and gets a DM.
    assignee_id = _shared_assignee(owner)
    if assignee_id:
        assignee_name = owner                       # the name the assigner used
        task_owner = _ctx_sector_owner() or owner   # ownership stays with the principal
        marker = f"[Asignado a: {assignee_name}]"
        notes = (notes + "\n\n" + marker) if notes else marker
        result = notion_client.create_task(
            title=title, owner=task_owner, due=due, priority=priority,
            status=status, notes=notes, database_id=_ctx_shared_db(),
            subsector=_ctx_subsector(), shared_with=assignee_id,
        )
        if isinstance(result, dict):
            if result.get("created"):
                _queue_share(assignee_id, title, task_owner, due=due,
                             priority=priority)
                result["shared_with_assignee"] = assignee_name
            if placeholders:
                result["placeholders"] = placeholders
        return result

    result = notion_client.create_task(
        title=title, owner=owner, due=due, priority=priority,
        status=status, notes=notes, database_id=_ctx_active(),
        subsector=_ctx_subsector(),
    )
    if placeholders and isinstance(result, dict):
        result["placeholders"] = placeholders
    return result


def _shared_rows(**kwargs):
    """Read the shared-tasks database for this turn, scoped by who is asking.

    - A shared-sector MEMBER (Gally / Naty) sees EVERY shared row (their view is
      the union of their own table and the shared table).
    - Anyone else (an assignee) sees ONLY the rows whose "Shared with" contains
      THEIR Slack id — never all shared tasks. This is the one, deliberate,
      per-row read across the channel-is-the-wall isolation.

    Returns [] on any error or when there's nothing to add, so a shared-table
    hiccup never breaks a normal listing."""
    shared_db = _ctx_shared_db()
    if not shared_db:
        return []
    shared_kwargs = dict(kwargs)
    shared_kwargs.pop("owner", None)  # shared rows are keyed by Shared with, not Owner
    try:
        rows = notion_client.query_tasks(database_id=shared_db, **shared_kwargs)
    except Exception:
        return []
    if _ctx_is_member():
        return rows
    rid = _ctx_requester()
    if not rid:
        return []
    return [t for t in rows if rid in (t.get("shared_with") or "")]


def _query_tasks(**kwargs):
    """Query wrapper that pins the read to the caller's sector database. The model
    never passes a database id; we inject the active one from the sector context.

    When sharing is configured, a broad/own-tasks listing ALSO folds in the
    caller's shared tasks (all of them for a member, only their own for an
    assignee) so an assigned task shows up in the assignee's 'what's pending' from
    any channel or DM. Narrow lookups (a keyword search or a specific date) are
    left untouched so they stay a precise, single-table query."""
    active_db = _ctx_active()
    # active_db may be None for a pure assignee (no sector of their own); in that
    # case skip the active read entirely rather than fall back to a default DB.
    active = notion_client.query_tasks(database_id=active_db, **kwargs) if active_db else []

    if not _ctx_shared_db():
        return active

    # Only fold shared rows into broad listings: an explicit 'incomplete' or
    # 'owner' filter, or a bare call with no narrowing filter at all.
    narrow_keys = ("search", "due_on", "due_before", "due_after", "status", "priority")
    broad = bool(kwargs.get("incomplete") or kwargs.get("owner")) or not any(
        kwargs.get(k) for k in narrow_keys)
    if not broad:
        return active

    keep = _shared_rows(**kwargs)
    if not keep:
        return active
    seen = {t.get("id") for t in active}
    merged = active + [t for t in keep if t.get("id") not in seen]
    # Re-sort by due date ascending, no-due last (mirrors notion_client._due_sort_key).
    merged.sort(key=lambda t: ((t.get("due") or "").strip() == "", (t.get("due") or "")))
    return merged


def _update_task(task_id=None, **kwargs):
    """Update wrapper that pins the write to the caller's sector database and, when
    a task is marked done, moves it into that sector's Historial (completed)
    database. The active/history ids come from the sector context, not the model."""
    if kwargs.get("due"):
        resolved = _resolve_due(kwargs["due"])
        if resolved:
            kwargs["due"] = resolved
        else:
            kwargs.pop("due")  # unrecognized phrase: don't overwrite with junk
    result = notion_client.update_task(task_id, database_id=_ctx_active(), **kwargs)
    new_status = (kwargs.get("status") or "").strip().lower()
    history_db = _ctx_history()
    if history_db and new_status in notion_client.DONE_STATUSES:
        try:
            moved = notion_client.move_task_to_history(task_id, history_db)
            if isinstance(result, dict) and isinstance(moved, dict):
                result["moved_to_history"] = moved.get("moved")
        except Exception as exc:  # keep the completion; report the move failure
            if isinstance(result, dict):
                result["history_error"] = str(exc)
    return result


TOOL_IMPLS = {
    "create_task": _create_task_guarded,
    "query_tasks": _query_tasks,
    "update_task": _update_task,
    "attach_material": notion_client.add_material,
    "deliver_material": _deliver_material,
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
        "create every task together. Immediately BEFORE you send that "
        "consolidated question, call create_task once for one of the "
        "still-incomplete tasks: it will come back as needs_more_info without "
        "saving anything, which is expected and is how the app knows you are "
        "waiting on the person's reply. Then send your single question.\n"
        "- When asking for missing info, LIST ONLY the tasks that have gaps. Do "
        "NOT list, number, or mention the tasks that are already complete (no "
        "'Complete \u2713' lines) \u2014 the person only wants to see what still needs "
        "input. Once they reply, create every task (complete and newly-completed) "
        "together.\n"
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
        "are already in that order). Show CURRENT (not-overdue) tasks FIRST, "
        "GROUPED BY DAY: for each distinct due date, print a bold date header "
        "on its own line, then the tasks due that day, then a BLANK LINE before "
        "the next day's group. The header is the task's own precomputed date: "
        "if 'due_this_week' is true write '*This <weekday> <due_display>*' "
        "(translate 'This' and the weekday into the reply's language, e.g. "
        "Spanish '*este lunes 17/8/2026*'); otherwise write '*<weekday> "
        "<due_display>*'. Do NOT repeat the date on the individual task lines "
        "inside these day groups. AFTER all upcoming day groups, if any task's "
        "'overdue' flag is true, add a bold '*Past due:*' heading (translate, "
        "e.g. '*Vencidas:*') with a FLAT list below it (no day grouping) where "
        "each line DOES include the date. Omit the 'Past due' section entirely "
        "if nothing is overdue. Never show tasks marked Done in these "
        "listings.\n"
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
        "- MATERIALS are optional reference links attached to a task. To attach "
        "one, call query_tasks to find the task's 'id', then call "
        "attach_material with that id, the url, and (if the user named it) a "
        "label. To SHOW a task's materials, read the 'materials' list already "
        "included in query_tasks results (each entry is {name, url}); present "
        "them as a short bullet list of labeled links. Only mention materials "
        "when the user asks about them or asks to attach one — most tasks have "
        "none. In a normal task listing, do NOT print the links inline; instead, "
        "if a task's 'materials' list is non-empty, add a paperclip \U0001F4CE at "
        "the very end of that task's line so people know materials exist.\n"
        "- DELIVERING FILES: when someone asks to GET, SEND, DOWNLOAD, or SHARE a "
        "task's file/material (e.g. 'send me the file for the LinkedIn task'), "
        "call query_tasks to find the task's 'id', then call deliver_material "
        "with that id. The file's bytes are uploaded straight into Slack, so "
        "everyone gets it even without Drive access. Do NOT print any link — "
        "just confirm in words which file you sent. If a file was uploaded to a "
        "task in this same conversation, you may already have its id from the "
        "earlier query.\n"
        "- AUTO-STATUS: adding a note or a file to a task automatically moves it "
        "to 'In progress' (unless it was already Done or already in progress). "
        "When a tool result comes back with status_promoted (or promoted) = true, "
        "briefly tell the user you also moved the task to In progress, in their "
        "language.\n"
        "- SHARED ASSIGNMENT: if a create_task result includes "
        "'shared_with_assignee', the task was assigned to that person, who has "
        "been notified by DM and can now see it and attach files to it. Briefly "
        "tell the person you shared/assigned the task with that name, in their "
        "language. Do not expose any database or Slack id.\n"
        "- After a tool runs, reply concisely using SLACK formatting (mrkdwn). "
        "CRITICAL: Slack bold uses a SINGLE asterisk on each side, like "
        "*bold* \u2014 never use **double** asterisks, which Slack renders "
        "literally. Bold every date header and every task title. For tasks in "
        "a day group (upcoming), write each as: '\u2022 *<task title>* \u2014 "
        "<owner> (Priority: <priority>, Status: <status>)' with NO date on the "
        "line \u2014 the date is the group header above it. Translate the "
        "'Priority' and 'Status' labels into the reply's language (Spanish "
        "'Prioridad'/'Estado'). For Past due lines ONLY, include the date: "
        "'\u2022 *<task>* \u2014 <owner>, <due_display> (<priority>, <status>)'. "
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
        # Generous ceiling so a batch of tool calls (e.g. someone pastes a 10-item
        # to-do list and we emit one create_task per item) isn't truncated
        # mid-response. Truncation is now handled safely either way (see the
        # tool_use handling in handle_message), but a higher ceiling avoids the
        # extra round-trips entirely.
        "max_tokens": 4096,
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


# Field words that mark a message as the bot asking for a missing task field.
# Used to detect that we're mid-collection (the bot asked owner/due/priority and
# is awaiting the person's answer), in English and Spanish.
_ASK_HINTS = (
    "owner", "assign", "due", "priority", "when ", "who ", "who's", "whom",
    "responsable", "prioridad", "fecha", "quién", "quien", "cuándo", "cuando",
)


def _mid_task_collection(history) -> bool:
    """True if the MOST RECENT assistant turn in the prior history was the bot
    asking the person for a missing task field (owner / due date / priority).

    This is the signal that we're waiting on a follow-up answer. We use it to
    catch Haiku's failure mode: on a terse reply ('Deybid', 'ok') it sometimes
    forgets to actually call create_task and instead narrates a success it never
    performed ('Done.', 'He creado...') or returns an empty turn. When we know we
    were mid-collection, an assistant turn that creates nothing and isn't blocked
    on a field is suspect, and we nudge the model to really create (or to ask for
    whatever field is still genuinely missing)."""
    for m in reversed(history or []):
        if m.get("role") != "assistant":
            continue
        content = m.get("content")
        if isinstance(content, str):
            text = content
        elif isinstance(content, list):
            text = " ".join(b.get("text", "") for b in content
                            if isinstance(b, dict) and b.get("type") == "text")
        else:
            text = ""
        low = text.lower()
        asked = ("?" in text or "¿" in text) and any(h in low for h in _ASK_HINTS)
        return asked  # only the most recent assistant turn matters
    return False


def handle_message(text: str, sender_name: str = "a teammate", history=None,
                   sector=None):
    """Main entry point. `history` is a list of prior {role, content} text turns
    (oldest first) that gives the bot short-term memory across messages.

    `sector` is the caller's sector config ({sector, active_db, history_db, ...})
    or None for single-database mode. It pins every Notion tool call to that
    sector's databases — the access-isolation boundary.

    Returns a (reply_text, status) tuple. `status` lets the Slack layer know
    whether it should keep listening for a follow-up:
        "created"    - a task was successfully created this turn (done)
        "needs_info" - create_task was blocked waiting on due date / priority
        "other"      - anything else (a listing, a plain answer, etc.)
    """
    _set_ctx(sector)  # pin all tool calls this turn to the caller's sector
    system = _system_prompt(sender_name)
    messages = list(history or []) + [{"role": "user", "content": text}]

    created = False       # a task reached Notion this turn
    needs_info = False    # create was blocked waiting on due date / priority
    corrected = False     # whether we've already issued the one recovery nudge
    asked_before = _mid_task_collection(history)  # were we mid-collection?

    for _ in range(6):  # safety cap on tool round-trips
        data = _call_claude(messages, system)
        content = data.get("content", [])
        stop = data.get("stop_reason")
        messages.append({"role": "assistant", "content": content})

        # Decide the next step by what the model ACTUALLY emitted, not by
        # stop_reason. A truncated turn (stop_reason 'max_tokens') can still carry
        # tool_use blocks; if we treated that as a text turn we'd skip running the
        # tools, never append their tool_result blocks, and the next API call would
        # 400 with "tool_use ids without tool_result". So: if there are any
        # tool_use blocks, run them and answer each one before looping.
        has_tool_use = any(b.get("type") == "tool_use" for b in content)

        if not has_tool_use:
            texts = [b["text"] for b in content if b.get("type") == "text"]
            reply = "\n".join(texts).strip()

            # RECOVERY: we were mid-collection (the bot had asked for a missing
            # owner/due/priority), yet the model ended its turn without creating
            # anything AND without being blocked on a field — i.e. it silently
            # skipped create_task and is about to fabricate a 'Done.'/'He creado'
            # that never happened. Don't trust it: nudge ONCE to actually create
            # each pending task, or to ask for whatever field is still missing.
            if asked_before and not created and not needs_info and not corrected:
                corrected = True
                messages.append({"role": "user", "content": (
                    "[SYSTEM: You have not created any task this turn and you did "
                    "not call create_task. Do NOT claim a task was created. If "
                    "every required field (owner, due date, priority) for each "
                    "pending task is now known from this conversation, call "
                    "create_task for EACH pending task NOW. If any required field "
                    "is still missing, ask the person for ONLY those fields — never "
                    "invent an owner, due date, or priority.]"
                )})
                continue

            # Only say a bare 'Done.' when a task actually reached Notion; never
            # fabricate success for an empty model turn.
            if not reply:
                reply = "Done." if created else (
                    "Sorry, I didn't catch that — could you say it again?")
            status = "needs_info" if needs_info else ("created" if created else "other")
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
