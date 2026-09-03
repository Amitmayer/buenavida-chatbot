import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/session";
import { runAgentLoop, type SseEvent } from "@/lib/agent/loop";
import { captureError } from "@/lib/sentry";

export const runtime = "nodejs";

const bodySchema = z.object({
  conversation_id: z.string().uuid(),
  client_message_id: z.string().min(8).max(80),
  text: z.string().min(1).max(4000),
});

function sse(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return new Response("unauthorized", { status: 401 });
  const json: unknown = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return new Response("validation", { status: 400 });

  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", parsed.data.conversation_id)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!conversation) return new Response("forbidden", { status: 403 });

  const existing = await supabase
    .from("messages")
    .select("id, content, role")
    .eq("conversation_id", conversation.id)
    .eq("client_message_id", parsed.data.client_message_id)
    .maybeSingle();

  if (existing.data) {
    const { data: assistant } = await supabase
      .from("messages")
      .select("id, content, tool_calls(*)")
      .eq("conversation_id", conversation.id)
      .eq("role", "assistant")
      .gt("created_at", existing.data ? "1970-01-01" : "1970-01-01")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        if (assistant?.content) {
          controller.enqueue(encoder.encode(sse({ type: "text", text: assistant.content })));
        }
        const calls = Array.isArray(assistant?.tool_calls) ? assistant.tool_calls : [];
        for (const call of calls) {
          controller.enqueue(
            encoder.encode(
              sse({
                type: "tool",
                id: call.id,
                name: call.name,
                status: call.status as "pending" | "ok" | "error",
                result: call.result,
              }),
            ),
          );
        }
        controller.enqueue(encoder.encode(sse({ type: "done" })));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  const { data: userMessage, error: userError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      role: "user",
      content: parsed.data.text,
      client_message_id: parsed.data.client_message_id,
    })
    .select("id")
    .single();
  if (userError || !userMessage) {
    captureError(userError, { where: "chat.userMessage" });
    return new Response("server_error", { status: 500 });
  }

  const { data: assistantMessage, error: assistantError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: "",
    })
    .select("id")
    .single();
  if (assistantError || !assistantMessage) {
    captureError(assistantError, { where: "chat.assistantMessage" });
    return new Response("server_error", { status: 500 });
  }

  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const text = await runAgentLoop({
          supabase,
          ctx: {
            userId: profile.id,
            defaultTeamId: profile.default_team,
            teamSlugs: profile.teams.map((t) => ({ id: t.id, slug: t.slug, name: t.name })),
            isGuest: profile.isGuest,
            isOwner: profile.isOwner,
            fullName: profile.full_name,
          },
          conversationId: conversation.id,
          assistantMessageId: assistantMessage.id,
          history: (history ?? [])
            .reverse()
            .filter((m) => m.content.length > 0)
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          emit: (event) => controller.enqueue(encoder.encode(sse(event))),
        });
        await supabase.from("messages").update({ content: text }).eq("id", assistantMessage.id);
        controller.enqueue(encoder.encode(sse({ type: "done" })));
      } catch (error) {
        captureError(error, { where: "chat.loop" });
        controller.enqueue(
          encoder.encode(sse({ type: "error", detail: "No se pudo completar la respuesta." })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
