"""
Verify that an incoming request really came from Google Chat.

Google Chat puts a bearer token in the Authorization header of every request.
The token is an ID token signed by chat@system.gserviceaccount.com, with the
audience set to either your HTTP endpoint URL or your GCP project number
(whichever you select as the "Authentication audience" in the Chat config).

This is OPTIONAL. The simplest production setup is to deploy on Cloud Run with
the Chat service account granted roles/run.invoker — then Cloud Run rejects
forged requests before they reach this code. Enable in-app verification by
setting VERIFY_CHAT_TOKENS=true and CHAT_AUDIENCE.
"""
from google.auth.transport import requests as g_requests
from google.oauth2 import id_token

import config

CHAT_ISSUER = "chat@system.gserviceaccount.com"
CHAT_CERTS_URL = (
    "https://www.googleapis.com/service_accounts/v1/metadata/x509/"
    "chat@system.gserviceaccount.com"
)


def is_valid_chat_request(auth_header: str | None) -> bool:
    if not config.VERIFY_CHAT_TOKENS:
        return True  # verification disabled (rely on Cloud Run IAM instead)
    if not auth_header or not auth_header.startswith("Bearer "):
        return False

    token = auth_header.split(" ", 1)[1].strip()
    try:
        claims = id_token.verify_token(
            token,
            g_requests.Request(),
            audience=config.CHAT_AUDIENCE or None,
            certs_url=CHAT_CERTS_URL,
        )
    except Exception:
        return False

    return claims.get("iss") == CHAT_ISSUER and claims.get("email") == CHAT_ISSUER
