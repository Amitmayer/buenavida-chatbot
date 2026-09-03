import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/types";
import { TOOL_LOOP_CAP } from "@/lib/constants";
import { systemPrompt } from "@/lib/agent/prompt";
import { executeTool, toolDefinitions, type UserContext } from "@/lib/agent/tools";
import { captureError } from "@/lib/sentry";
import type { ToolResult } from "@/lib/agent/result";

type Client = SupabaseClient<Database>;

export type SseEvent =
  | { type: "text"; text: string }
  | { type: "tool"; id: string; name: string; status: "pending" | "ok" | "error"; result?: unknown }
  | { type: "done" }
  | { type: "error"; detail: string };

export async function runAgentLoop(args: {
  supabase: Client;
  ctx: UserContext & { fullName: string };
  conversationId: string;
  assistantMessageId: string;
  history: { role: "user" | "assistant"; content: string }[];
  emit: (event: SseEvent) => void;
}): Promise<string> {
  const { supabase, ctx, conversationId, assistantMessageId, history, emit } = args;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    emit({
      type: "error",
      detail: "Falta ANTHROPIC_API_KEY en .env.local. Añádela y reinicia el servidor.",
    });
    throw new Error("ANTHROPIC_API_KEY missing");
  }
  const anthropic = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_AGENT_MODEL ?? "claude-sonnet-5";

  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let assistantText = "";
  let iterations = 0;

  while (iterations < TOOL_LOOP_CAP) {
    iterations += 1;
    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model,
        max_tokens: 1024,
        system: systemPrompt(ctx),
        tools: [...toolDefinitions],
        messages,
      });
    } catch (error) {
      captureError(error, { where: "anthropic.messages.create" });
      emit({ type: "error", detail: "No se pudo hablar con el asistente." });
      throw error;
    }

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    const texts = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text);

    for (const text of texts) {
      assistantText += text;
      emit({ type: "text", text });
    }

    if (toolUses.length === 0 || response.stop_reason === "end_turn") {
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const { data: pending, error: pendingError } = await supabase
        .from("tool_calls")
        .insert({
          message_id: assistantMessageId,
          name: use.name,
          input: use.input as Json,
          status: "pending",
        })
        .select("id")
        .single();
      if (pendingError || !pending) {
        captureError(pendingError, { where: "tool_calls.insert" });
        emit({ type: "tool", id: "unknown", name: use.name, status: "error" });
        toolResults.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: JSON.stringify({ ok: false, code: "server_error", detail: "No se pudo registrar la herramienta." }),
        });
        continue;
      }
      emit({ type: "tool", id: pending.id, name: use.name, status: "pending" });

      let result: ToolResult<unknown>;
      try {
        result = await executeTool({
          supabase,
          ctx,
          conversationId,
          name: use.name,
          input: use.input,
        });
      } catch (error) {
        captureError(error, { where: "executeTool", name: use.name });
        result = { ok: false, code: "server_error", detail: "Falló la herramienta." };
      }

      const taskId =
        result.ok && result.data && typeof result.data === "object" && result.data !== null && "id" in result.data
          ? String((result.data as { id: unknown }).id)
          : result.ok && result.data && typeof result.data === "object" && result.data !== null && "tasks" in result.data
            ? null
            : null;

      const { error: updateError } = await supabase
        .from("tool_calls")
        .update({
          status: result.ok ? "ok" : "error",
          result: result as unknown as Json,
          error_code: result.ok ? null : result.code,
          task_id: taskId,
        })
        .eq("id", pending.id);
      if (updateError) {
        captureError(updateError, { where: "tool_calls.update" });
      }
      emit({
        type: "tool",
        id: pending.id,
        name: use.name,
        status: result.ok ? "ok" : "error",
        result,
      });
      toolResults.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }

  return assistantText;
}
