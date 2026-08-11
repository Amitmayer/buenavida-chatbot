"""
Thin Notion API wrapper for a task database.

Operations:
    create_task(...)  -> create a page (task)
    query_tasks(...)  -> read tasks back (now includes each task's id + url)
    update_task(...)  -> change fields on an existing task (incl. mark complete)

Everything adapts to the property TYPES declared in config.NOTION_SCHEMA.
"""
from typing import Any, Optional
import requests

import config

API_BASE = "https://api.notion.com/v1"


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


def create_task(title, owner=None, due=None, priority=None, status=None, notes=None) -> dict:
    """Create a task page. Returns {id, url, title}."""
    incoming = {
        "title": title,
        "owner": owner,
        "due": due,
        "priority": priority,
        "status": status if status is not None else config.DEFAULT_NEW_TASK_STATUS,
        "notes": notes,
    }
    payload = {
        "parent": {"database_id": config.require("NOTION_DATABASE_ID", config.NOTION_DATABASE_ID)},
        "properties": _properties_from(incoming),
    }
    resp = requests.post(f"{API_BASE}/pages", headers=_headers(), json=payload, timeout=30)
    if resp.status_code >= 400:
        raise RuntimeError(f"Notion create failed ({resp.status_code}): {resp.text}")
    data = resp.json()
    return {"created": True, "id": data.get("id"), "url": data.get("url"), "title": title}


def update_task(task_id, title=None, owner=None, due=None, priority=None,
                status=None, notes=None) -> dict:
    """Update fields on an existing task. Only the fields you pass are changed.
    To mark a task complete, pass status='Done'."""
    properties = _properties_from({
        "title": title, "owner": owner, "due": due,
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
            "changed": list(properties.keys())}


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


def _owner_sort_key(task: dict):
    """Sort by owner name; put tasks with no owner last."""
    owner = task.get("owner")
    if isinstance(owner, list):
        owner = ", ".join(owner)
    owner = (owner or "").strip()
    return (owner == "", owner.lower())


def query_tasks(owner=None, status=None, priority=None, due_on=None,
                due_before=None, due_after=None, search=None, limit=None,
                incomplete=False) -> list[dict]:
    """Query tasks with optional filters. Returns plain task dicts incl. id,
    sorted by owner. Pass incomplete=True to return every task that is NOT
    finished (any status other than Done/Complete/Cancelled/Archived)."""
    conditions = []
    for field, val in (("owner", owner), ("status", status), ("priority", priority)):
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

    # When asking for incomplete tasks, page through everything so the
    # client-side "not done" filter sees the full database, not just one page.
    body: dict = {"page_size": limit or config.QUERY_PAGE_SIZE}
    if conditions:
        body["filter"] = {"and": conditions} if len(conditions) > 1 else conditions[0]

    db_id = config.require("NOTION_DATABASE_ID", config.NOTION_DATABASE_ID)
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
        # Only paginate when we need the whole DB (incomplete) and no explicit limit.
        if incomplete and not limit and data.get("has_more"):
            cursor = data.get("next_cursor")
            continue
        break

    if incomplete:
        tasks = [t for t in tasks if not _is_done(t)]

    tasks.sort(key=_owner_sort_key)
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
