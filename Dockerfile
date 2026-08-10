FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Slack Socket Mode worker: opens an OUTBOUND websocket to Slack, so there is
# no HTTP port to bind. This is the process to run for the Slack <-> Notion bot.
CMD ["python", "slack_app.py"]

# --- Alternative: Google Chat HTTP webhook (needs a public URL / Cloud Run) ---
# Swap the CMD above for the line below if you deploy the Chat version instead:
# CMD exec gunicorn --bind :${PORT:-8080} --workers 1 --threads 8 --timeout 120 app:app
