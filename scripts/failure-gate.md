# Failure gate (P3-5)

The confirmation contract: the UI never treats assistant prose as success.

1. Point `NEXT_PUBLIC_SUPABASE_URL` at a dead host (`http://127.0.0.1:1`).
2. Open `/chat` and ask to create a task.
3. The result card must show **No se guardó**, even if the model writes "listo" or "creada".
4. `resultCardState('error')` is the only path to that label — see `lib/agent/result.ts`.
