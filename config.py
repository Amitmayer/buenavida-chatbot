"""
Central configuration.

Everything that changes between workspaces lives here or in environment
variables, so the rest of the code never needs editing.
"""
import os

# ---------------------------------------------------------------------------
# Secrets / connection (set as environment variables)
# ---------------------------------------------------------------------------
NOTION_TOKEN = os.environ.get("NOTION_TOKEN", "")
NOTION_DATABASE_ID = os.environ.get("NOTION_DATABASE_ID", "")
NOTION_VERSION = os.environ.get("NOTION_VERSION", "2022-06-28")

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
    # Optional per-task attachments. Holds external URLs (e.g. Drive links) as
    # labeled Notion "Files & media" entries. Not every task has materials.
    "materials": {"name": "Materials", "type": "files"},
}

# Default status applied to newly created tasks.
DEFAULT_NEW_TASK_STATUS = os.environ.get("DEFAULT_NEW_TASK_STATUS", "Not started")

# How many tasks a single query returns at most.
QUERY_PAGE_SIZE = int(os.environ.get("QUERY_PAGE_SIZE", "50"))


def require(name: str, value: str) -> str:
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value
