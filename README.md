# Notion ↔ Google Chat task assistant

A Google Chat bot that talks to your Notion task database in plain English.

- **Create tasks:** *"Assign David to make the slide deck for Buokapi, due Friday"* → creates a Notion task with owner, due date, etc.
- **Query tasks:** *"What does David have to do?"* · *"What's due today?"* · *"Show me all the tasks"*

An LLM (Claude) reads each message, decides whether to **create** or **query**, calls the Notion API, and replies in chat.

```
Google Chat  ──event──▶  this app (Cloud Run)  ──▶  Claude (decides + phrases)
     ▲                          │                         │
     └────── reply ─────────────┘                         ▼
                                                    Notion API (create / query)
```

## Files

| File | What it does |
|------|--------------|
| `app.py` | Flask webhook that receives Google Chat events |
| `agent.py` | The Claude tool-use loop (intent → Notion call → reply) |
| `notion_client.py` | Create + query tasks via the Notion API |
| `chat_auth.py` | Optional Google Chat token verification |
| `config.py` | **Your Notion schema mapping** + env vars |
| `Dockerfile` / `requirements.txt` | Deploy to Cloud Run |

---

## 1. Notion setup

1. Create an internal integration at **https://www.notion.so/my-integrations** → copy the token (starts with `ntn_`/`secret_`).
2. Open your task database in Notion → **••• menu → Connections → add your integration**. (Without this, the token has no access — most common mistake.)
3. Get the **database ID**: it's the 32-char string in the database URL: `notion.so/<workspace>/<DATABASE_ID>?v=...`.
4. **Match your columns** in `config.py` → `NOTION_SCHEMA`. The default assumes columns named `Task`, `Owner` (select), `Status` (status), `Priority` (select), `Due Date` (date), `Notes` (rich text). Edit the `name` and `type` to match yours exactly — names are **case-sensitive**.
   - Keep `Owner` as a `select` (not a Notion *person* property) so the bot can write `"David"` directly; Notion auto-creates the option.

## 2. Anthropic key

Get an API key from the Claude Console and set `ANTHROPIC_API_KEY`. Default model is `claude-sonnet-4-6` (fast + cheap, good for routing); set `ANTHROPIC_MODEL=claude-opus-4-8` for tougher phrasing.

## 3. Run locally to test

```bash
pip install -r requirements.txt
export NOTION_TOKEN=...  NOTION_DATABASE_ID=...  ANTHROPIC_API_KEY=...
python app.py            # serves on :8080
```

Simulate a Google Chat message (no Chat setup needed yet):

```bash
curl -s localhost:8080 -X POST -H 'Content-Type: application/json' -d '{
  "type":"MESSAGE",
  "user":{"displayName":"Amit"},
  "message":{"text":"Assign David to make the slide deck for Buokapi, due Friday"}
}'
```

Then query it back:

```bash
curl -s localhost:8080 -X POST -H 'Content-Type: application/json' \
  -d '{"type":"MESSAGE","message":{"text":"what does David have to do?"}}'
```

## 4. Deploy to Cloud Run

```bash
gcloud run deploy notion-chat-agent \
  --source . --region us-central1 --allow-unauthenticated=false \
  --set-env-vars NOTION_TOKEN=...,NOTION_DATABASE_ID=...,ANTHROPIC_API_KEY=...
```

> Use Google Secret Manager for the keys in production rather than `--set-env-vars`.

Copy the service URL it prints — you'll need it next.

## 5. Register the Google Chat app

1. In the Cloud Console: enable the **Google Chat API**, then open it → **Configuration**.
2. Fill in App name, avatar, description.
3. Under **Functionality**: enable *Receive 1:1 messages* and *Join spaces and group conversations*.
4. Under **Connection settings**: choose **HTTP endpoint URL** and paste your Cloud Run URL.
5. Under **Visibility**: make it available to yourself / your domain.
6. Save. In Google Chat, start a DM with the app or `@mention` it in a space.

### Securing the endpoint (recommended)

Let Cloud Run reject anything that isn't really Google Chat:

```bash
gcloud run services add-iam-policy-binding notion-chat-agent \
  --region us-central1 \
  --member='serviceAccount:chat@system.gserviceaccount.com' \
  --role='roles/run.invoker'
```

Alternatively, set `VERIFY_CHAT_TOKENS=true` and `CHAT_AUDIENCE=<your-Cloud-Run-URL>` to have the app validate the bearer token itself (see `chat_auth.py`).

---

## Notes & limits

- **Notion API version** is pinned to `2022-06-28` (stable, uses `database_id` directly). Newer versions (`2025-09-03`+) split databases into "data sources" and change the query endpoint — only upgrade if you need new features.
- **Rate limit:** Notion allows ~3 requests/sec; fine for chat usage.
- **Relative dates** ("Friday", "next week") are resolved by Claude using the server's current date, injected into its instructions.
- **Cost:** each message is 1–2 Claude calls. Sonnet keeps this cheap.
- **Owner as people property:** if you must use a real Notion *person* property, change `owner` type to `people` in `config.py` and pass Notion user IDs (not names) — names won't resolve automatically.

## Extending it

- **Daily standup digest:** add a scheduled Cloud Run job (or Cloud Scheduler) that calls `notion_client.query_tasks(due_on=today)` and posts to a space webhook.
- **Mark tasks done from chat:** add an `update_task` tool that calls Notion's `PATCH /v1/pages/{id}`.
- **Notion → Chat push on changes:** register a Notion webhook (`2026-03-01`+) and post updates into a space.
