"""
Daily task digest ("Informe Diario").

Every morning this posts a team-wide summary of every OUTSTANDING task, grouped by
owner, to a Slack channel, and (optionally) DMs each person just their own tasks.

It runs on a background thread inside the always-on Socket Mode process: the
thread sleeps until the next configured UTC time, fires the digest, then repeats
the next day. Nothing here needs a public URL or an external cron — the bot is
already a long-lived process, so a timer thread is enough.

Owner -> Slack-user mapping (for the private DMs) is deliberately conservative:
config.OWNER_SLACK_IDS wins; otherwise we match the Notion owner name against the
Slack member list and only DM on a SINGLE confident match. If a name is ambiguous
or unmatched we send NO DM (that person still appears in the channel digest) —
guessing risks handing someone another person's task list.
"""
import logging
import threading
import time
from datetime import datetime, timedelta, timezone

import config
import notion_client

log = logging.getLogger("slack-task-bot.digest")

# Sentinel key for tasks that have no owner set.
_UNASSIGNED = "\x00unassigned"

# ---------------------------------------------------------------------------
# Tiny i18n. Two languages only; picked by config.DIGEST_LANG.
# ---------------------------------------------------------------------------
_TXT = {
    "es": {
        "title": "Informe Diario",
        "none": "No hay tareas pendientes. \U0001F389",
        "unassigned": "Sin asignar",
        "greeting": "Buenos días, {name} \U0001F44B",
        "your_tasks": "Estas son tus tareas pendientes:",
        "overdue": "vencida",
        "no_due": "sin fecha",
        "count_one": "1 tarea",
        "count_many": "{n} tareas",
    },
    "en": {
        "title": "Daily Digest",
        "none": "No outstanding tasks. \U0001F389",
        "unassigned": "Unassigned",
        "greeting": "Good morning, {name} \U0001F44B",
        "your_tasks": "Here are your outstanding tasks:",
        "overdue": "overdue",
        "no_due": "no due date",
        "count_one": "1 task",
        "count_many": "{n} tasks",
    },
}


def _t(key: str) -> str:
    lang = config.DIGEST_LANG if config.DIGEST_LANG in _TXT else "es"
    return _TXT[lang][key]


def _count_label(n: int) -> str:
    return _t("count_one") if n == 1 else _t("count_many").format(n=n)


# ---------------------------------------------------------------------------
# Building the message text
# ---------------------------------------------------------------------------
def _owner_key(task: dict):
    """A hashable owner key. Owner is a select (string) in this schema, but be
    defensive: a people-type owner would arrive as a list."""
    owner = task.get("owner")
    if isinstance(owner, list):
        owner = owner[0] if owner else None
    owner = (owner or "").strip()
    return owner or _UNASSIGNED


def _group_by_owner(tasks: list) -> dict:
    """Group tasks by owner. Returns an ordered dict: named owners alphabetically
    first, the unassigned bucket (if any) last."""
    groups: dict = {}
    for task in tasks:
        groups.setdefault(_owner_key(task), []).append(task)
    ordered = {}
    for key in sorted(k for k in groups if k != _UNASSIGNED):
        ordered[key] = groups[key]
    if _UNASSIGNED in groups:
        ordered[_UNASSIGNED] = groups[_UNASSIGNED]
    return ordered


def _due_label(task: dict) -> str:
    """Human due-date fragment for a task line."""
    if task.get("overdue"):
        disp = task.get("due_display")
        return f"{_t('overdue')} ({disp})" if disp else _t("overdue")
    if task.get("due_display"):
        return task["due_display"]
    return _t("no_due")


def _task_line(task: dict) -> str:
    """One bullet line: '• *Title* — due (Priority)'. Slack mrkdwn bold is single
    asterisks. Empty fields are dropped."""
    title = task.get("title") or "(sin título)"
    bits = [_due_label(task)]
    priority = task.get("priority")
    if priority:
        bits.append(priority)
    return f"• *{title}* — " + " · ".join(bits)


def _today_str() -> str:
    """Today's date in Costa Rica local time (UTC-6, no DST), as d/m/Y. The digest
    fires at 13:00 UTC = 07:00 CR, so the CR date is the right 'today'."""
    now_cr = datetime.now(timezone.utc) - timedelta(hours=6)
    return f"{now_cr.day}/{now_cr.month}/{now_cr.year}"


def build_channel_digest(groups: dict) -> str:
    """The team-wide post: a header, then one bold owner heading per person with
    their task bullets underneath."""
    header = f"*{_t('title')} — {_today_str()}*"
    if not groups:
        return header + "\n\n" + _t("none")
    blocks = [header, ""]
    for key, tasks in groups.items():
        name = _t("unassigned") if key == _UNASSIGNED else key
        blocks.append(f"*{name}* ({_count_label(len(tasks))})")
        blocks.extend(_task_line(t) for t in tasks)
        blocks.append("")  # blank line between people
    return "\n".join(blocks).rstrip()


def build_personal_digest(name: str, tasks: list) -> str:
    """A single person's private DM: greeting, then just their bullets."""
    lines = [_t("greeting").format(name=name), _t("your_tasks"), ""]
    lines.extend(_task_line(t) for t in tasks)
    return "\n".join(lines).rstrip()


# ---------------------------------------------------------------------------
# Resolving a Notion owner name -> a Slack user id (for the DMs)
# ---------------------------------------------------------------------------
def _slack_members(client) -> list:
    """Fetch (uid, [lowercased names]) for every real (non-bot, non-deleted)
    Slack member. Paginated. Returns [] if users.list isn't permitted."""
    members = []
    cursor = None
    try:
        while True:
            resp = client.users_list(limit=200, cursor=cursor)
            for m in resp.get("members", []):
                if m.get("deleted") or m.get("is_bot") or m.get("id") == "USLACKBOT":
                    continue
                prof = m.get("profile", {}) or {}
                names = {
                    m.get("real_name"),
                    m.get("name"),
                    prof.get("real_name"),
                    prof.get("display_name"),
                }
                lowered = [n.strip().lower() for n in names if n and n.strip()]
                if lowered:
                    members.append((m.get("id"), lowered))
            cursor = (resp.get("response_metadata") or {}).get("next_cursor")
            if not cursor:
                break
    except Exception:
        log.exception("could not list Slack members (users:read scope?)")
    return members


def _first_token(name: str) -> str:
    parts = (name or "").strip().lower().split()
    return parts[0] if parts else ""


def resolve_user(owner: str, members: list):
    """Map a Notion owner name onto exactly one Slack user id, or None.

    Order: explicit config override -> exactly-one EXACT full-name match ->
    exactly-one first-name match. Anything ambiguous or unmatched returns None,
    so we never DM a guessed recipient."""
    if not owner:
        return None
    override = config.OWNER_SLACK_IDS.get(owner)
    if override:
        return override

    owner_l = owner.strip().lower()
    owner_first = _first_token(owner)

    exact = {uid for uid, names in members if owner_l in names}
    if len(exact) == 1:
        return next(iter(exact))
    if exact:
        return None  # two people share this exact name -> too risky, skip

    if owner_first:
        first = {uid for uid, names in members
                 if any(_first_token(n) == owner_first for n in names)}
        if len(first) == 1:
            return next(iter(first))
    return None


# ---------------------------------------------------------------------------
# Channel resolution
# ---------------------------------------------------------------------------
def _resolve_channel(client, ref: str):
    """Turn a channel reference into an id. If it already looks like an id
    (C.../G...), use it. Otherwise look it up by name via conversations.list.
    Falls back to the raw value so chat.postMessage can still try."""
    ref = (ref or "").strip()
    if not ref:
        return None
    bare = ref.lstrip("#")
    if ref[:1] in ("C", "G") and ref.replace("_", "").isalnum() and ref.upper() == ref:
        return ref  # already an id
    try:
        cursor = None
        while True:
            resp = client.conversations_list(
                types="public_channel,private_channel", limit=200, cursor=cursor)
            for c in resp.get("channels", []):
                if c.get("name") == bare:
                    return c.get("id")
            cursor = (resp.get("response_metadata") or {}).get("next_cursor")
            if not cursor:
                break
    except Exception:
        log.exception("could not resolve channel %r (channels:read scope?)", ref)
    return bare  # last resort: let postMessage try the name


# ---------------------------------------------------------------------------
# Running the digest
# ---------------------------------------------------------------------------
def _deliver_digest(client, channel_ref, tasks, members) -> tuple:
    """Post one channel digest and (optionally) DM each matched person. Returns
    (posted, dmed, skipped, people). `members` is the pre-fetched Slack member
    list (or None to skip DMs)."""
    groups = _group_by_owner(tasks)

    posted = False
    channel_id = _resolve_channel(client, channel_ref)
    if channel_id:
        try:
            client.chat_postMessage(channel=channel_id, text=build_channel_digest(groups))
            posted = True
        except Exception:
            log.exception("failed to post channel digest to %r", channel_ref)

    dmed, skipped = 0, 0
    if config.DIGEST_DM_EACH and groups and members is not None:
        for key, owner_tasks in groups.items():
            if key == _UNASSIGNED:
                continue
            uid = resolve_user(key, members)
            if not uid:
                skipped += 1
                log.info("no confident Slack match for %r; channel-only", key)
                continue
            try:
                opened = client.conversations_open(users=uid)
                dm_channel = opened["channel"]["id"]
                client.chat_postMessage(
                    channel=dm_channel, text=build_personal_digest(key, owner_tasks))
                dmed += 1
            except Exception:
                skipped += 1
                log.exception("could not DM %r (%s) — im:write scope?", key, uid)
    return posted, dmed, skipped, len(groups)


def run_digest(client) -> dict:
    """Post the digest(s) and (optionally) DM each matched person. In sector mode
    this runs ONE digest per sector — each sector's outstanding tasks posted to
    that sector's channel, so no channel ever sees another sector's work. In
    single-database mode it posts the one team-wide digest as before. Returns a
    small summary dict (handy for the manual test trigger)."""
    members = _slack_members(client) if config.DIGEST_DM_EACH else None

    if config.sectors_enabled():
        total = {"channel_posted": 0, "dmed": 0, "skipped": 0,
                 "people": 0, "sectors": 0}
        for channel_id, cfg in config.SECTORS.items():
            # When several channels share one sector database via a subsector
            # label (e.g. Operaciones: #pedidos, #roasting-control), a sub-channel
            # digest shows ONLY its own label's tasks, so it doesn't echo the
            # whole sector. The plain sector channel (no subsector) still shows the
            # full rollup.
            tasks = notion_client.query_tasks(
                incomplete=True, database_id=cfg.get("active_db"),
                subsector=cfg.get("subsector"))
            posted, dmed, skipped, people = _deliver_digest(
                client, channel_id, tasks, members)
            total["channel_posted"] += int(posted)
            total["dmed"] += dmed
            total["skipped"] += skipped
            total["people"] += people
            total["sectors"] += 1
            log.info("sector digest %s: posted=%s dmed=%s skipped=%s people=%s",
                     cfg.get("sector"), posted, dmed, skipped, people)
        log.info("all sector digests done: %s", total)
        return total

    tasks = notion_client.query_tasks(incomplete=True)
    posted, dmed, skipped, people = _deliver_digest(
        client, config.DIGEST_CHANNEL, tasks, members)
    log.info("digest done: channel_posted=%s dmed=%s skipped=%s people=%s",
             posted, dmed, skipped, people)
    return {"channel_posted": posted, "dmed": dmed, "skipped": skipped,
            "people": people}


# ---------------------------------------------------------------------------
# Scheduling
# ---------------------------------------------------------------------------
def _parse_hhmm(value: str):
    try:
        hh, mm = value.strip().split(":")
        return int(hh), int(mm)
    except (ValueError, AttributeError):
        return 13, 0  # safe default: 13:00 UTC = 07:00 Costa Rica


def _seconds_until_next_run(now: datetime = None) -> float:
    """Seconds from now until the next fire time (UTC). Respects weekdays-only."""
    now = now or datetime.now(timezone.utc)
    hh, mm = _parse_hhmm(config.DIGEST_UTC_TIME)
    target = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    if config.DIGEST_DAYS == "weekdays":
        while target.weekday() >= 5:  # 5=Sat, 6=Sun
            target += timedelta(days=1)
    return (target - now).total_seconds()


def _run_loop(client) -> None:
    while True:
        secs = _seconds_until_next_run()
        log.info("next digest in %.0f min", secs / 60)
        time.sleep(max(secs, 1))
        try:
            run_digest(client)
        except Exception:
            log.exception("digest run failed")
        time.sleep(60)  # ensure we roll past the fire minute before recomputing


def start(client) -> None:
    """Launch the digest scheduler on a daemon thread. No-op if disabled."""
    if not config.DIGEST_ENABLED:
        log.info("daily digest disabled (DIGEST_ENABLED=false)")
        return
    t = threading.Thread(target=_run_loop, args=(client,), daemon=True)
    t.start()
    target = (f"{len(config.SECTORS)} sector channels"
              if config.sectors_enabled() else f"#{config.DIGEST_CHANNEL}")
    log.info("daily digest scheduled at %s UTC (%s) -> %s",
             config.DIGEST_UTC_TIME, config.DIGEST_DAYS, target)
