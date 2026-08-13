"""
Central configuration.

Everything that changes between workspaces lives here or in environment
variables, so the rest of the code never needs editing.
"""
import json
import os

# ---------------------------------------------------------------------------
# Secrets / connection (set as environment variables)
# ---------------------------------------------------------------------------
NOTION_TOKEN = os.environ.get("NOTION_TOKEN", "")
# Single-database mode (Phase 1). Still used as the default database when no
# sector routing is configured (see SECTORS below), so existing setups keep
# working unchanged.
NOTION_DATABASE_ID = os.environ.get("NOTION_DATABASE_ID", "")
NOTION_VERSION = os.environ.get("NOTION_VERSION", "2022-06-28")

# ---------------------------------------------------------------------------
# Sector routing (multi-sector workspace). Maps a Slack CHANNEL ID to the
# Notion databases and Drive subfolder that channel is allowed to touch. This
# map is the WHOLE access-isolation mechanism: every message is resolved to its
# sector by the channel it arrived on, and the bot can only reach that sector's
# resources. A person in two sectors still can't cross the wall, because the
# resources come from the channel, not from the person.
#
# Set via the SECTORS env var as a JSON object, e.g.:
#   {
#     "C0VENTAS":      {"sector": "Ventas",      "active_db": "...", "history_db": "...", "drive_folder": "..."},
#     "C0MARKETING":   {"sector": "Marketing",   "active_db": "...", "history_db": "...", "drive_folder": "..."},
#     "C0OPERACIONES": {"sector": "Operaciones", "active_db": "...", "history_db": "...", "drive_folder": "..."},
#     "C0GENERAL":     {"sector": "General",     "active_db": "...", "history_db": "...", "drive_folder": "..."}
#   }
#
# Several channels may point at the SAME sector databases and add an optional
# "subsector" label, so their tasks share one database but stay distinguishable:
#     "C0PEDIDOS":  {"sector": "Operaciones", "subsector": "Pedidos",         "active_db": "...(same as Operaciones)", "history_db": "...", "drive_folder": "..."},
#     "C0ROASTING": {"sector": "Operaciones", "subsector": "Roasting Control", "active_db": "...(same as Operaciones)", "history_db": "...", "drive_folder": "..."}
# The subsector is a label only; the access wall is still the database.
#
# When SECTORS is EMPTY (the default), the bot runs in single-database mode and
# behaves exactly as before, using NOTION_DATABASE_ID / GDRIVE_FOLDER_ID.
try:
    SECTORS = json.loads(os.environ.get("SECTORS", "{}") or "{}")
    if not isinstance(SECTORS, dict):
        SECTORS = {}
except (ValueError, TypeError):
    SECTORS = {}


def sectors_enabled() -> bool:
    """True when at least one sector channel is configured."""
    return bool(SECTORS)


def sector_for_channel(channel_id):
    """Return the sector config dict for a Slack channel id, or None if that
    channel isn't a sector channel (or sector routing is off)."""
    if not channel_id:
        return None
    return SECTORS.get(channel_id)

# ---------------------------------------------------------------------------
# Google Drive (Phase 2 materials storage). The bot authenticates as a service
# account; GOOGLE_SERVICE_ACCOUNT_JSON holds the full JSON key (set in Railway,
# never committed). GDRIVE_FOLDER_ID is the Shared Drive folder that owns the
# uploaded bytes. When either is unset, file uploads degrade gracefully.
# ---------------------------------------------------------------------------
GOOGLE_SERVICE_ACCOUNT_JSON = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
GDRIVE_FOLDER_ID = os.environ.get("GDRIVE_FOLDER_ID", "")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
# Default model is now Haiku 4.5 (cheap + fast, great for task routing/queries).
# Override with the ANTHROPIC_MODEL env var to use e.g. claude-sonnet-4-6.
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")

# Google Chat request verification (only used by the old HTTP app.py; ignored
# by the Slack Socket Mode version).
VERIFY_CHAT_TOKENS = os.environ.get("VERIFY_CHAT_TOKENS", "false").lower() == "true"
CHAT_AUDIENCE = os.environ.get("CHAT_AUDIENCE", "")

# ---------------------------------------------------------------------------
# Notion schema mapping. Property names are CASE-SENSITIVE and must match your
# database exactly. Supported types: title, rich_text, select, status, date, people.
# ---------------------------------------------------------------------------
NOTION_SCHEMA = {
    "title":    {"name": "Task",      "type": "title"},
    "owner":    {"name": "Owner",     "type": "select"},
    "status":   {"name": "Status",    "type": "status"},
    "priority": {"name": "Priority",  "type": "select"},
    "due":      {"name": "Due Date",  "type": "date"},
    "notes":    {"name": "Notes",     "type": "rich_text"},
    # Optional sub-label WITHIN a sector. Some sectors have several Slack channels
    # that all share ONE sector database (e.g. Operaciones: #operaciones-general,
    # #pedidos, #roasting-control). The subsector is stamped on create so those
    # tasks are still distinguishable inside the shared database. It is a LABEL,
    # not an access wall — the wall is the database (sector) itself. A channel
    # whose SECTORS entry has no "subsector" leaves this empty. The Notion column
    # is a select named "Subsector" (must match the DB exactly).
    "subsector": {"name": "Subsector", "type": "select"},
    # Optional per-task attachments. Holds external URLs (e.g. Drive links) as
    # labeled Notion "Files & media" entries. Not every task has materials.
    # NOTE: the Notion column is named "Files" (must match the DB exactly).
    "materials": {"name": "Files", "type": "files"},
    # Optional completion date, written when a task is moved to its sector's
    # Historial (completed) database. Only the history databases need this column
    # to exist; on the active databases it stays empty (and the code never sends
    # it there). If a history DB lacks the column, the completion date is recorded
    # in the task notes instead — see notion_client.move_task_to_history.
    "completed": {"name": "Completed", "type": "date"},
}

# Default status applied to newly created tasks.
DEFAULT_NEW_TASK_STATUS = os.environ.get("DEFAULT_NEW_TASK_STATUS", "Not started")

# The status a task is set to when it is completed / moved to Historial.
DONE_STATUS = os.environ.get("DONE_STATUS", "Done")

# Status a task is auto-moved to when someone adds a note or a file to it — but
# only if it isn't already finished or already in progress (see _should_promote).
IN_PROGRESS_STATUS = os.environ.get("IN_PROGRESS_STATUS", "In progress")

# Placeholder written into an auto-saved task's missing SELECT fields (owner /
# priority) when a listening window expires before the person supplied them, so
# the task is saved rather than lost. The due date is a real Notion date property
# and cannot hold placeholder text, so it is left blank (reads as "no due date");
# what was left unspecified is also recorded in the task's notes.
UNSPECIFIED_LABEL = os.environ.get("UNSPECIFIED_LABEL", "Not specified")

# How many tasks a single query returns at most.
QUERY_PAGE_SIZE = int(os.environ.get("QUERY_PAGE_SIZE", "50"))

# ---------------------------------------------------------------------------
# Daily digest ("Informe Diario"). A scheduled morning post that lists everyone's
# outstanding tasks grouped by owner, plus (optionally) a private DM to each
# person with just their own tasks. Runs on a background thread in the always-on
# Socket Mode process (see digest.py).
# ---------------------------------------------------------------------------
DIGEST_ENABLED = os.environ.get("DIGEST_ENABLED", "true").lower() == "true"

# Channel the team-wide digest posts to. A channel ID (e.g. "C0123ABC") is the
# most reliable; a plain name like "informe-diario" also works (it's resolved to
# an ID at run time). The bot must be a MEMBER of this channel.
DIGEST_CHANNEL = os.environ.get("DIGEST_CHANNEL", "informe-diario")

# When to fire, as UTC 24-hour "HH:MM". Costa Rica is UTC-6 year round (no daylight
# saving), so 7:00 AM Costa Rica = 13:00 UTC.
DIGEST_UTC_TIME = os.environ.get("DIGEST_UTC_TIME", "13:00")

# Which days to run: "daily" (every day, incl. weekends) or "weekdays" (Mon-Fri).
DIGEST_DAYS = os.environ.get("DIGEST_DAYS", "daily")

# Also DM each person their own tasks, on top of the channel post. If the app
# lacks the im:write scope, DM delivery degrades silently to channel-only.
DIGEST_DM_EACH = os.environ.get("DIGEST_DM_EACH", "true").lower() == "true"

# Language for the digest text: "es" (Spanish) or "en" (English).
DIGEST_LANG = os.environ.get("DIGEST_LANG", "es")

# Optional explicit Notion-owner -> Slack user-ID overrides for DM delivery, e.g.
# {"Gally Mayer": "U0123ABC"}. Anyone not listed is auto-matched against the Slack
# member list and only DM'd on a SINGLE confident match (never a guess). Set via
# the OWNER_SLACK_IDS env var as a JSON object.
try:
    OWNER_SLACK_IDS = json.loads(os.environ.get("OWNER_SLACK_IDS", "{}") or "{}")
    if not isinstance(OWNER_SLACK_IDS, dict):
        OWNER_SLACK_IDS = {}
except (ValueError, TypeError):
    OWNER_SLACK_IDS = {}


def require(name: str, value: str) -> str:
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value
