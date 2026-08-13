"""
Thin Notion API wrapper for a task database.

Operations:
    create_task(...)  -> create a page (task)
    query_tasks(...)  -> read tasks back (now includes each task's id + url)
    update_task(...)  -> change fields on an existing task (incl. mark complete)

Everything adapts to the property TYPES declared in config.NOTION_SCHEMA.

Multi-sector note: every read/write takes an optional `database_id`. When it is
None the module falls back to config.NOTION_DATABASE_ID (single-database mode),
so existing callers keep working. The sector layer (agent.py) passes the caller's
sector database explicitly, which is how access isolation is enforced.
"""
from datetime import date, timedelta
from typing import Any, Optional
import requests

import config

API_BASE = "https://api.notion.com/v1"


def _db(database_id: Optional[str]) -> str:
    """Resolve the database id to use: the explicit one if given, else the
    single-database default. Errors if neither is set."""
    if database_id:
        return database_id
    return config.require("NOTION_DATABASE_ID", config.NOTION_DATABASE_ID)


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {config.require('NOTION_TOKEN', config.NOTION_TOKEN)}",
        "Notion-Version": config.NOTION_VERSION,
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# Writing: build a Notion property value for a given type
# ---------------------------------------------------------------------------
def _build_value(prop_type: str, value: Any) -> Optional[dict]:
    if value is None or value == "":
        return None
    if prop_type == "title":
        return {"title": [{"text": {"content": str(value)}}]}
    if prop_type == "rich_text":
        return {"rich_text": [{"text": {"content": str(value)}}]}
    if prop_type == "select":
        return {"select": {"name": str(value)}}
    if prop_type == "status":
        return {"status": {"name": str(value)}}
    if prop_type == "date":
        return {"date": {"start": str(value)}}
    if prop_type == "people":
        ids = value if isinstance(value, list) else [value]
        return {"people": [{"id": uid} for uid in ids]}
    if prop_type == "files":
        # value is a list of {name, url} dicts (or bare url strings). We store
        # them as EXTERNAL files so Notion just holds the link, not a copy.
        items = value if isinstance(value, list) else [value]
        files = []
        for it in items:
            if isinstance(it, dict):
                url = it.get("url")
                name = it.get("name") or url
            else:
                url = str(it)
                name = url
            if url:
                # Notion caps a file entry's name at 100 chars.
                files.append({
                    "name": str(name)[:100],
                    "type": "external",
                    "external": {"url": url},
                })
        return {"files": files}  # empty list is valid: it clears the property
    raise ValueError(f"Unsupported property type: {prop_type}")


def _properties_from(incoming: dict) -> dict:
    """Turn {logical_field: value} into a Notion properties payload."""
    properties: dict = {}
    for field, raw in incoming.items():
        if raw is None:
            continue
        meta = config.NOTION_SCHEMA.get(field)
        if not meta:
            continue
        built = _build_value(meta["type"], raw)
        if built is not None:
            properties[meta["name"]] = built
    return properties


# Cache of each database's Owner-select option names, so we don't re-fetch the
# schema on every write. Keyed by database id (sectors each have their own Owner
# options). Owners rarely change; it refreshes on restart.
_OWNER_OPTIONS_CACHE: dict = {}


def _owner_options(database_id: Optional[str] = None) -> list:
    """Return the option names already defined on the Owner property (a Notion
    select) FOR THIS DATABASE. We use these to map a first name like 'Gally' onto
    the canonical 'Gally Mayer' option instead of creating a duplicate one."""
    db_id = _db(database_id)
    if db_id in _OWNER_OPTIONS_CACHE:
        return _OWNER_OPTIONS_CACHE[db_id]
    meta = config.NOTION_SCHEMA.get("owner")
    if not meta or meta["type"] != "select":
        _OWNER_OPTIONS_CACHE[db_id] = []
        return _OWNER_OPTIONS_CACHE[db_id]
    try:
        resp = requests.get(f"{API_BASE}/databases/{db_id}",
                            headers=_headers(), timeout=30)
        if resp.status_code >= 400:
            _OWNER_OPTIONS_CACHE[db_id] = []
        else:
            prop = resp.json().get("properties", {}).get(meta["name"], {})
            opts = prop.get("select", {}).get("options", [])
            _OWNER_OPTIONS_CACHE[db_id] = [o.get("name", "") for o in opts if o.get("name")]
    except requests.RequestException:
        _OWNER_OPTIONS_CACHE[db_id] = []
    return _OWNER_OPTIONS_CACHE[db_id]


def _canonical_owner(owner, database_id: Optional[str] = None):
    """Map an owner reference onto the EXISTING Notion option (in THIS database)
    that means the same person — matched case-insensitively by exact name, first
    name, or substring (via _owner_matches). So 'Gally' becomes the stored
    'Gally Mayer' rather than a new, separate option. Returns the input unchanged
    if nobody matches (a genuinely new person, whose name becomes the new option)."""
    if not owner:
        return owner
    want = str(owner).strip()
    for opt in _owner_options(database_id):
        if _owner_matches(opt, want):
            return opt
    return want


# Cache of "does database X have property Y" checks, so move_task_to_history can
# decide whether to write the Completed column without a schema read every time.
_DB_PROPS_CACHE: dict = {}


def _db_has_property(database_id: str, prop_name: str) -> bool:
    """True if the database defines a property with this exact name. Cached."""
    db_id = _db(database_id)
    key = f"{db_id}:{prop_name}"
    if key in _DB_PROPS_CACHE:
        return _DB_PROPS_CACHE[key]
    present = False
    try:
        resp = requests.get(f"{API_BASE}/databases/{db_id}",
                            headers=_headers(), timeout=30)
        if resp.status_code < 400:
            present = prop_name in (resp.json().get("properties", {}) or {})
    except requests.RequestException:
        present = False
    _DB_PROPS_CACHE[key] = present
    return present


def create_task(title, owner=None, due=None, priority=None, status=None,
                notes=None, completed=None, materials=None, subsector=None,
                database_id=None) -> dict:
    """Create a task page in the given database (or the default one). Returns
    {id, url, title}. `completed` and `materials` are used when recreating a task
    in a Historial database; normal task creation omits them. `subsector` is an
    optional label stamped into the Subsector column when the caller's channel
    belongs to a sub-labelled channel (e.g. Operaciones/Pedidos); a Notion select
    write auto-creates the option if it doesn't exist yet."""
    db_id = _db(database_id)
    incoming = {
        "title": title,
        "owner": _canonical_owner(owner, db_id),
        "due": due,
        "priority": priority,
        "status": status if status is not None else config.DEFAULT_NEW_TASK_STATUS,
        "notes": notes,
        "completed": completed,
        "materials": materials,
        "subsector": subsector,
    }
    payload = {
        "parent": {"database_id": db_id},
        "properties": _properties_from(incoming),
    }
    resp = requests.post(f"{API_BASE}/pages", headers=_headers(), json=payload, timeout=30)
    if resp.status_code >= 400:
        raise RuntimeError(f"Notion create failed ({resp.status_code}): {resp.text}")
    data = resp.json()
    return {"created": True, "id": data.get("id"), "url": data.get("url"), "title": title}


def _should_promote(current_status) -> bool:
    """Adding a note or a file means work has started, so we bump the task to
    'In progress' — but NOT if it's already finished (don't reopen a Done task)
    or already in progress (nothing to change)."""
    st = (current_status or "").strip().lower()
    if st in DONE_STATUSES:
        return False
    if st == (config.IN_PROGRESS_STATUS or "").strip().lower():
        return False
    return True


def _current_status(task_id) -> Optional[str]:
    """Read just a task's current status (small GET), so promotion can be guarded
    without clobbering a Done/manual status."""
    meta = config.NOTION_SCHEMA.get("status")
    if not meta:
        return None
    resp = requests.get(f"{API_BASE}/pages/{task_id}", headers=_headers(), timeout=30)
    if resp.status_code >= 400:
        return None
    prop = resp.json().get("properties", {}).get(meta["name"])
    return _read_property(prop) if prop else None


def update_task(task_id, title=None, owner=None, due=None, priority=None,
                status=None, notes=None, database_id=None) -> dict:
    """Update fields on an existing task. Only the fields you pass are changed.
    To mark a task complete, pass status='Done'.

    Adding a NOTE auto-promotes the task to 'In progress' (unless it's Done or
    already in progress, and unless the caller set a status explicitly).

    `database_id` is only used to canonicalize the owner against the right
    database's Owner options; the page itself is targeted by its global id."""
    promoted = False
    if notes and status is None and config.NOTION_SCHEMA.get("status"):
        if _should_promote(_current_status(task_id)):
            status = config.IN_PROGRESS_STATUS
            promoted = True
    properties = _properties_from({
        "title": title, "owner": _canonical_owner(owner, database_id), "due": due,
        "priority": priority, "status": status, "notes": notes,
    })
    if not properties:
        return {"updated": False, "error": "No fields given to update."}
    resp = requests.patch(
        f"{API_BASE}/pages/{task_id}",
        headers=_headers(),
        json={"properties": properties},
        timeout=30,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"Notion update failed ({resp.status_code}): {resp.text}")
    data = resp.json()
    return {"updated": True, "id": data.get("id"), "url": data.get("url"),
            "changed": list(properties.keys()), "status_promoted": promoted}


def _read_task(task_id) -> Optional[dict]:
    """Read a task page and return the parsed {id, title, owner, ...} dict, or
    None if the read fails."""
    resp = requests.get(f"{API_BASE}/pages/{task_id}", headers=_headers(), timeout=30)
    if resp.status_code >= 400:
        return None
    return _parse_page(resp.json())


def move_task_to_history(task_id, history_db_id) -> dict:
    """Move a completed task into its sector's Historial (completed) database:
    recreate it there with a completion date, then archive the original.

    Notion has no cross-database 'move', so this is a recreate-then-archive. The
    completion date goes into the history DB's 'Completed' column if that column
    exists; either way it is also recorded in the task notes so the information is
    never lost. Returns a small summary dict."""
    if not history_db_id:
        return {"moved": False, "error": "No history database configured."}
    parsed = _read_task(task_id)
    if not parsed:
        return {"moved": False, "error": "Could not read the task to move it."}

    today = date.today().isoformat()
    notes = parsed.get("notes") or ""
    stamp = f"[Completado: {today}]"
    notes = (notes + "\n\n" + stamp) if notes else stamp

    # Only send the Completed date property if the history DB actually has that
    # column, so a DB created without it doesn't 400 the whole move.
    completed = today if _db_has_property(history_db_id, config.NOTION_SCHEMA["completed"]["name"]) else None

    new = create_task(
        title=parsed.get("title") or "Untitled task",
        owner=parsed.get("owner"),
        due=parsed.get("due"),
        priority=parsed.get("priority"),
        status=config.DONE_STATUS,
        notes=notes,
        completed=completed,
        materials=parsed.get("materials") or None,
        subsector=parsed.get("subsector"),
        database_id=history_db_id,
    )

    # Archive the original in the active database (removes it from the active
    # views without hard-deleting it).
    try:
        requests.patch(f"{API_BASE}/pages/{task_id}", headers=_headers(),
                       json={"archived": True}, timeout=30)
    except requests.RequestException:
        pass  # the copy already exists in Historial; leave the original if this fails

    return {"moved": True, "history_id": new.get("id"), "completed": today,
            "title": parsed.get("title")}


def add_material(task_id, url, label=None) -> dict:
    """Attach a material (an external link) to a task's Materials property.

    APPENDS: reads the task's current materials, adds the new link if it isn't
    already there (deduped by URL), then writes the merged list back. A Notion
    files property write REPLACES the whole property, so we must read-merge-write
    rather than blind-set, or we'd wipe existing attachments."""
    if not url:
        return {"added": False, "error": "No URL given."}
    meta = config.NOTION_SCHEMA.get("materials")
    if not meta:
        return {"added": False, "error": "Materials property is not configured."}

    resp = requests.get(f"{API_BASE}/pages/{task_id}", headers=_headers(), timeout=30)
    if resp.status_code >= 400:
        raise RuntimeError(f"Notion read failed ({resp.status_code}): {resp.text}")
    props = resp.json().get("properties", {})
    current = _read_property(props.get(meta["name"])) if props.get(meta["name"]) else []
    entries = [{"name": e["name"], "url": e["url"]} for e in (current or [])]

    if any(e["url"] == url for e in entries):
        return {"added": False, "already_present": True, "count": len(entries),
                "materials": entries}
    entries.append({"name": label or url, "url": url})

    built = _build_value("files", entries)
    patch_props = {meta["name"]: built}

    # Adding a file means work has started -> promote to 'In progress' (guarded so
    # we never reopen a Done task or clobber a manual status). We already have the
    # page's props from the read above, so no extra request is needed.
    promoted = False
    status_meta = config.NOTION_SCHEMA.get("status")
    if status_meta:
        current_status = (_read_property(props.get(status_meta["name"]))
                          if props.get(status_meta["name"]) else None)
        if _should_promote(current_status):
            patch_props[status_meta["name"]] = _build_value("status", config.IN_PROGRESS_STATUS)
            promoted = True

    resp2 = requests.patch(
        f"{API_BASE}/pages/{task_id}",
        headers=_headers(),
        json={"properties": patch_props},
        timeout=30,
    )
    if resp2.status_code >= 400:
        raise RuntimeError(f"Notion update failed ({resp2.status_code}): {resp2.text}")
    return {"added": True, "id": task_id, "count": len(entries),
            "materials": entries, "status_promoted": promoted}


def get_materials(task_id) -> list[dict]:
    """Read a task's materials as [{name, url}] WITH the urls intact.

    Used for Slack delivery: the agent's normal tool results have urls stripped
    before the model sees them, but to re-upload a file's bytes into Slack we
    need the real Drive link. This bypasses that path and reads Notion directly."""
    meta = config.NOTION_SCHEMA.get("materials")
    if not meta:
        return []
    resp = requests.get(f"{API_BASE}/pages/{task_id}", headers=_headers(), timeout=30)
    if resp.status_code >= 400:
        raise RuntimeError(f"Notion read failed ({resp.status_code}): {resp.text}")
    props = resp.json().get("properties", {})
    prop = props.get(meta["name"])
    return _read_property(prop) if prop else []


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------
def _equals_filter(field: str, value: str) -> Optional[dict]:
    meta = config.NOTION_SCHEMA.get(field)
    if not meta:
        return None
    name, ptype = meta["name"], meta["type"]
    if ptype == "select":
        return {"property": name, "select": {"equals": value}}
    if ptype == "status":
        return {"property": name, "status": {"equals": value}}
    if ptype == "rich_text":
        return {"property": name, "rich_text": {"contains": value}}
    if ptype == "title":
        return {"property": name, "title": {"contains": value}}
    return None


def _date_filter(condition: str, value: str) -> Optional[dict]:
    meta = config.NOTION_SCHEMA.get("due")
    if not meta:
        return None
    return {"property": meta["name"], "date": {condition: value}}


# Statuses that count as "finished". Anything whose status matches one of these
# (case-insensitive) is treated as complete and excluded when incomplete=True.
DONE_STATUSES = {"done", "complete", "completed", "cancelled", "canceled", "archived"}


def _is_done(task: dict) -> bool:
    st = (task.get("status") or "").strip().lower()
    return st in DONE_STATUSES


def _first_token(name: str) -> str:
    name = (name or "").strip().lower()
    return name.split()[0] if name else ""


def _owner_matches(task_owner, requested: str) -> bool:
    """Fuzzy-match a Notion owner against a requester name (e.g. a Slack
    username). Matches on exact (case-insensitive), first-name, or substring, so
    'Amit Mayer' from Slack still matches a Notion owner of 'Amit'."""
    if not requested:
        return True
    owners = task_owner if isinstance(task_owner, list) else [task_owner]
    r = requested.strip().lower()
    r0 = _first_token(requested)
    for o in owners:
        a = str(o or "").strip().lower()
        if not a:
            continue
        if a == r or r in a or a in r:
            return True
        if r0 and r0 == _first_token(a):
            return True
    return False


def _due_sort_key(task: dict):
    """Sort by due date ascending; tasks with no due date go last."""
    due = (task.get("due") or "").strip()
    return (due == "", due)


def query_tasks(owner=None, status=None, priority=None, due_on=None,
                due_before=None, due_after=None, search=None, limit=None,
                incomplete=False, subsector=None, database_id=None) -> list[dict]:
    """Query tasks with optional filters. Returns plain task dicts (each incl.
    its id and a computed `overdue` flag), sorted by due date (earliest first,
    no-due last).

    - incomplete=True returns every task that is NOT finished (any status other
      than Done/Complete/Cancelled/Archived).
    - `owner` is matched fuzzily (case-insensitive, first-name or substring) so a
      Slack username like 'Amit Mayer' matches a Notion owner of 'Amit'.
    - `subsector` narrows a shared sector database to one sub-label (e.g. only the
      'Pedidos' tasks inside the Operaciones database). Omit it to see the whole
      database.
    """
    conditions = []
    # owner is filtered client-side (fuzzy) below, NOT here, so Slack usernames
    # that don't exactly equal the Notion owner value still match.
    for field, val in (("status", status), ("priority", priority),
                       ("subsector", subsector)):
        if val:
            f = _equals_filter(field, val)
            if f:
                conditions.append(f)
    if due_on:
        conditions.append(_date_filter("equals", due_on))
    if due_before:
        conditions.append(_date_filter("on_or_before", due_before))
    if due_after:
        conditions.append(_date_filter("on_or_after", due_after))
    if search:
        f = _equals_filter("title", search)
        if f:
            conditions.append(f)
    conditions = [c for c in conditions if c]

    body: dict = {"page_size": limit or config.QUERY_PAGE_SIZE}
    if conditions:
        body["filter"] = {"and": conditions} if len(conditions) > 1 else conditions[0]

    # Page through the whole DB when we filter client-side (incomplete/owner) and
    # the caller didn't cap the result, so those filters see every task.
    fetch_all = bool(incomplete or owner) and not limit

    db_id = _db(database_id)
    tasks: list[dict] = []
    cursor = None
    while True:
        if cursor:
            body["start_cursor"] = cursor
        resp = requests.post(f"{API_BASE}/databases/{db_id}/query",
                             headers=_headers(), json=body, timeout=30)
        if resp.status_code >= 400:
            raise RuntimeError(f"Notion query failed ({resp.status_code}): {resp.text}")
        data = resp.json()
        tasks.extend(_parse_page(p) for p in data.get("results", []))
        if fetch_all and data.get("has_more"):
            cursor = data.get("next_cursor")
            continue
        break

    if incomplete:
        tasks = [t for t in tasks if not _is_done(t)]
    if owner:
        tasks = [t for t in tasks if _owner_matches(t.get("owner"), owner)]

    # Flag past-due tasks (due date strictly before today) so the caller can put
    # them in their own section without redoing date math. Notion dates may be
    # 'YYYY-MM-DD' or a full ISO timestamp, so compare only the date part.
    today = date.today()
    today_iso = today.isoformat()
    week_end = today + timedelta(days=6)  # "this week" = today .. next 6 days
    weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday",
                "Friday", "Saturday", "Sunday"]
    for t in tasks:
        due = (t.get("due") or "").strip()
        t["overdue"] = bool(due) and due[:10] < today_iso
        # Precompute display fields so the model never does date math itself:
        #   due_display   -> day/month/year, e.g. "17/8/2026"
        #   weekday       -> English name, e.g. "Monday" (model translates it)
        #   due_this_week -> due within today..+6 days (show the weekday then)
        t["due_display"] = None
        t["weekday"] = None
        t["due_this_week"] = False
        if due:
            try:
                d = date.fromisoformat(due[:10])
                t["due_display"] = f"{d.day}/{d.month}/{d.year}"
                t["weekday"] = weekdays[d.weekday()]
                t["due_this_week"] = today <= d <= week_end
            except ValueError:
                pass

    tasks.sort(key=_due_sort_key)
    return tasks


def _read_property(prop: dict) -> Any:
    ptype = prop.get("type")
    if ptype == "title":
        return "".join(t.get("plain_text", "") for t in prop.get("title", []))
    if ptype == "rich_text":
        return "".join(t.get("plain_text", "") for t in prop.get("rich_text", []))
    if ptype == "select":
        sel = prop.get("select")
        return sel.get("name") if sel else None
    if ptype == "status":
        st = prop.get("status")
        return st.get("name") if st else None
    if ptype == "date":
        d = prop.get("date")
        return d.get("start") if d else None
    if ptype == "people":
        return [p.get("name") for p in prop.get("people", [])]
    if ptype == "files":
        out = []
        for f in prop.get("files", []):
            if f.get("type") == "external":
                url = (f.get("external") or {}).get("url")
            else:  # Notion-hosted upload
                url = (f.get("file") or {}).get("url")
            if url:
                out.append({"name": f.get("name") or url, "url": url})
        return out
    return None


def _parse_page(page: dict) -> dict:
    """Turn a Notion page into {id, title, owner, status, priority, due, notes, url}.
    The id is what update_task needs to target this specific task."""
    props = page.get("properties", {})
    out = {"id": page.get("id"), "url": page.get("url")}
    for field, meta in config.NOTION_SCHEMA.items():
        prop = props.get(meta["name"])
        out[field] = _read_property(prop) if prop else None
    return out
