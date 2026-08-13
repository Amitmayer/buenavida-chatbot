"""
Google Drive storage for task materials, via a service account.

Design (see PLAN_materials.md): the bytes live in exactly ONE place — a single
Shared Drive folder (config.GDRIVE_FOLDER_ID), flat, each file keeping its own
natural name. Notion only holds the *link*. Slack delivery re-uploads the bytes
so people without Drive access still get the file.

The bot authenticates as a service account using a JSON key held in
config.GOOGLE_SERVICE_ACCOUNT_JSON (an env var — never committed). The service
account must be a member of the Shared Drive (Content manager) so it can write.

Operations the rest of the app needs:
    is_configured()                     -> bool
    upload_bytes(name, data, mime)      -> {"id", "link"}
    extract_file_id(url)                -> Drive file id, or None
    download_bytes(file_id)             -> (name, data, mime)

Requires: google-api-python-client, google-auth (see requirements.txt).
"""
import io
import json
import re

import config

# Full Drive scope so the service account can create files in the Shared Drive
# and read them back for re-upload to Slack.
_SCOPES = ["https://www.googleapis.com/auth/drive"]

# Built lazily and cached: the discovery build + credential parse is not free,
# and most messages never touch Drive.
_service = None


def is_configured() -> bool:
    """True only when both the key and the target folder are set, so callers can
    degrade gracefully (links still work) when Phase 2 isn't wired up yet."""
    return bool(config.GOOGLE_SERVICE_ACCOUNT_JSON and config.GDRIVE_FOLDER_ID)


def _drive():
    global _service
    if _service is not None:
        return _service
    # Imported lazily so the app still boots (and Phase 1 keeps working) even if
    # the Google libraries aren't installed yet.
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    raw = config.require("GOOGLE_SERVICE_ACCOUNT_JSON", config.GOOGLE_SERVICE_ACCOUNT_JSON)
    info = json.loads(raw)
    creds = service_account.Credentials.from_service_account_info(info, scopes=_SCOPES)
    _service = build("drive", "v3", credentials=creds, cache_discovery=False)
    return _service


def upload_bytes(name: str, data: bytes, mime: str = "application/octet-stream",
                 folder_id: str = None) -> dict:
    """Store `data` as a file named `name` in a Shared Drive folder. Uses
    `folder_id` when given (the caller's sector subfolder), otherwise the default
    config.GDRIVE_FOLDER_ID. Returns {"id", "link"} where link is a Drive
    webViewLink. Flat within the folder — the task<->file linkage lives in Notion,
    not the Drive layout."""
    from googleapiclient.http import MediaIoBaseUpload

    folder = config.require("GDRIVE_FOLDER_ID", folder_id or config.GDRIVE_FOLDER_ID)
    meta = {"name": name or "file", "parents": [folder]}
    media = MediaIoBaseUpload(io.BytesIO(data), mimetype=mime or "application/octet-stream",
                              resumable=False)
    f = _drive().files().create(
        body=meta,
        media_body=media,
        fields="id, webViewLink",
        supportsAllDrives=True,  # required to write into a Shared Drive
    ).execute()
    return {"id": f.get("id"), "link": f.get("webViewLink")}


# Matches the file id in the common Drive URL shapes:
#   https://drive.google.com/file/d/<ID>/view?...   -> /d/<ID>
#   https://drive.google.com/open?id=<ID>           -> ?id=<ID>
#   https://drive.google.com/uc?id=<ID>&...         -> &id=<ID>
_DRIVE_ID_RE = re.compile(r"/d/([A-Za-z0-9_-]+)|[?&]id=([A-Za-z0-9_-]+)")


def extract_file_id(url: str):
    """Return the Drive file id embedded in a link, or None if it isn't a Drive
    link (in which case the caller should just post the link as-is)."""
    if not url:
        return None
    m = _DRIVE_ID_RE.search(url)
    if not m:
        return None
    return m.group(1) or m.group(2)


def download_bytes(file_id: str):
    """Fetch a Drive file's bytes by id (service account reads it even for people
    with no Drive access). Returns (name, data, mime) for re-upload into Slack."""
    from googleapiclient.http import MediaIoBaseDownload

    svc = _drive()
    meta = svc.files().get(fileId=file_id, fields="name, mimeType",
                           supportsAllDrives=True).execute()
    req = svc.files().get_media(fileId=file_id, supportsAllDrives=True)
    buf = io.BytesIO()
    dl = MediaIoBaseDownload(buf, req)
    done = False
    while not done:
        _, done = dl.next_chunk()
    return meta.get("name"), buf.getvalue(), meta.get("mimeType")
