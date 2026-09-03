import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import webpush from "web-push";
import { createServiceClient, createUserScopedClient } from "@/lib/supabase/as-user";
import { addDaysYmd, crStampLabel, todayYmd } from "@/lib/agent/dates";
import { renderDigestEmail, type DigestGroup } from "@/lib/digest/email";
import { es } from "@/lib/i18n/es";
import { captureError } from "@/lib/sentry";

function groupByTeam(
  tasks: { title: string; due_date: string | null; priority: string; team: { name: string } | { name: string }[] | null }[],
): DigestGroup[] {
  const map = new Map<string, DigestGroup>();
  for (const task of tasks) {
    const team = Array.isArray(task.team) ? task.team[0] : task.team;
    const name = team?.name ?? "—";
    const group = map.get(name) ?? { team: name, tasks: [] };
    group.tasks.push({
      title: task.title,
      due: task.due_date,
      priority: task.priority,
    });
    map.set(name, group);
  }
  return [...map.values()];
}

async function summarise(text: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return text.slice(0, 280);
  const anthropic = new Anthropic({ apiKey: key });
  const model = process.env.ANTHROPIC_DIGEST_MODEL ?? "claude-haiku-4-5";
  const response = await anthropic.messages.create({
    model,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Resume en dos frases, español latinoamericano neutro, estas tareas para el digest matutino. No inventes nada:\n${text}`,
      },
    ],
  });
  const block = response.content[0];
  return block && block.type === "text" ? block.text : text.slice(0, 280);
}

export async function runDigest(): Promise<{ sent: number; skipped: number; error: number }> {
  const admin = createServiceClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, full_name, role")
    .neq("role", "guest");
  if (error) {
    captureError(error, { where: "digest.profiles" });
    throw error;
  }
  const today = todayYmd();
  const weekEnd = addDaysYmd(today, 7);
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const resendKey = process.env.RESEND_API_KEY;
  const resend = resendKey ? new Resend(resendKey) : null;

  if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:os@buenavida.cr",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
  }

  for (const profile of profiles ?? []) {
    try {
      const asUser = createUserScopedClient(profile.id);
      const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
      const email = authUser.user?.email;
      const { data: tasks } = await asUser
        .from("tasks")
        .select("title, due_date, priority, status, team:teams(name)")
        .in("status", ["open", "in_progress"]);
      const visible = tasks ?? [];
      const overdue = groupByTeam(visible.filter((t) => t.due_date && t.due_date < today));
      const dueToday = groupByTeam(visible.filter((t) => t.due_date === today));
      const week = groupByTeam(
        visible.filter((t) => t.due_date && t.due_date > today && t.due_date <= weekEnd),
      );
      if (overdue.length + dueToday.length + week.length === 0) {
        await admin.from("digest_runs").upsert({
          user_id: profile.id,
          run_date: today,
          status: "skipped",
          detail: "no_tasks",
        }, { onConflict: "user_id,run_date" });
        skipped += 1;
        continue;
      }
      const blob = JSON.stringify({ overdue, dueToday, week });
      const summary = await summarise(blob);
      if (resend && email) {
        await resend.emails.send({
          from: process.env.RESEND_FROM ?? "Buena Vida OS <os@buenavida.cr>",
          to: email,
          subject: es.digest.subject,
          html: renderDigestEmail({
            name: profile.full_name,
            dateLabel: crStampLabel(today),
            siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
            todayYmd: today,
            overdue,
            today: dueToday,
            week,
          }),
        });
      }
      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", profile.id);
      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({ title: es.digest.subject, body: summary }),
          );
        } catch (pushError) {
          captureError(pushError, { where: "digest.push", userId: profile.id });
        }
      }
      await admin.from("digest_runs").upsert({
        user_id: profile.id,
        run_date: today,
        status: "sent",
        detail: email ?? "no-email",
      }, { onConflict: "user_id,run_date" });
      sent += 1;
    } catch (runError) {
      captureError(runError, { where: "digest.user", userId: profile.id });
      await admin.from("digest_runs").upsert({
        user_id: profile.id,
        run_date: today,
        status: "error",
        detail: runError instanceof Error ? runError.message : "error",
      }, { onConflict: "user_id,run_date" });
      failed += 1;
    }
  }
  return { sent, skipped, error: failed };
}
