"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { ResultCard } from "@/components/chat/result-card";
import { createClient } from "@/lib/supabase/client";
import { createTaskAction } from "@/app/(app)/tareas/actions";

type Tool = {
  id: string;
  name: string;
  status: "pending" | "ok" | "error";
  result?: { ok?: boolean; data?: { id?: string; title?: string }; detail?: string };
};

type Person = { id: string; full_name: string };
type TeamOpt = { id: string; slug: string; name: string };

const fieldClass =
  "h-11 w-full rounded-[9px] border border-line bg-sheet px-3 text-[14px] text-ink outline-none focus:border-ink";

export function CaptureBox({
  conversationId,
  trigger = "field",
}: {
  conversationId: string;
  trigger?: "field" | "button" | "inline";
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<Person[]>([]);
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [notes, setNotes] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [teams, setTeams] = useState<TeamOpt[]>([]);
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<Tool | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const [{ data: profiles }, { data: me }, { data: memberships }, { data: allTeams }] =
        await Promise.all([
          supabase.from("profiles").select("id, full_name").order("full_name"),
          user
            ? supabase.from("profiles").select("role, full_access").eq("id", user.id).maybeSingle()
            : Promise.resolve({ data: null }),
          user
            ? supabase.from("team_members").select("team_id, teams(id, slug, name)").eq("user_id", user.id)
            : Promise.resolve({ data: [] }),
          supabase.from("teams").select("id, slug, name").order("name"),
        ]);
      setPeople((profiles ?? []) as Person[]);
      const nextTeams =
        me?.role === "owner" || me?.full_access
          ? ((allTeams ?? []) as TeamOpt[])
          : (memberships ?? [])
              .map((row) => {
                const nested = row.teams as unknown;
                if (Array.isArray(nested)) return nested[0] as TeamOpt | undefined;
                return nested as TeamOpt | undefined;
              })
              .filter((team): team is TeamOpt => Boolean(team));
      setTeams(nextTeams);
      setTeamId((prev) => prev || nextTeams[0]?.id || "");
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !teamId) {
      setAssigneeOptions(people);
      setProjects([]);
      setProjectId("");
      return;
    }
    const supabase = createClient();
    void (async () => {
      const [{ data: members }, { data: projectRows }] = await Promise.all([
        supabase
          .from("team_members")
          .select("user_id, profiles(id, full_name)")
          .eq("team_id", teamId),
        supabase
          .from("projects")
          .select("id, name")
          .eq("team_id", teamId)
          .is("archived_at", null)
          .order("created_at", { ascending: true }),
      ]);
      const opts = (members ?? [])
        .map((row) => {
          const nested = row.profiles as unknown;
          const profile = Array.isArray(nested) ? nested[0] : nested;
          if (!profile || typeof profile !== "object") return null;
          const p = profile as { id?: string; full_name?: string };
          if (!p.id || !p.full_name) return null;
          return { id: p.id, full_name: p.full_name };
        })
        .filter((p): p is Person => Boolean(p));
      setAssigneeOptions(opts);
      setAssigneeId((prev) => (opts.some((p) => p.id === prev) ? prev : ""));
      setProjects((projectRows ?? []) as { id: string; name: string }[]);
      setProjectId((prev) =>
        (projectRows ?? []).some((p) => p.id === prev) ? prev : "",
      );
    })();
  }, [open, teamId, people]);


  async function send() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setTool({ id: "pending", name: "create_task", status: "pending" });
    const formData = new FormData();
    formData.set("title", title.trim());
    if (notes.trim()) formData.set("notes", notes.trim());
    if (teamId) formData.set("team_id", teamId);
    if (projectId) formData.set("project_id", projectId);
    if (assigneeId) formData.set("assignee_id", assigneeId);
    if (due) formData.set("due_date", due);
    formData.set("priority", priority);
    formData.set("visibility", "team");
    const result = await createTaskAction(formData);
    if (result.ok) {
      setTool({
        id: "ok",
        name: "create_task",
        status: "ok",
        result: { ok: true, data: { id: result.id, title: title.trim() } },
      });
      setOpen(false);
      setTitle("");
      setNotes("");
      setAssigneeId("");
      setProjectId("");
      setDue("");
      setPriority("medium");
      router.push(`/tareas/${result.id}`);
      router.refresh();
    } else {
      setTool({
        id: "err",
        name: "create_task",
        status: "error",
        result: { ok: false, detail: result.detail },
      });
    }
    setBusy(false);
  }

  function resetAndOpen() {
    setOpen(true);
    setTool(null);
  }

  const dialog = open ? (
    <Modal title={es.hoy.captureTitle} onClose={() => setOpen(false)}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Field label={es.tasks.colTask}>
          <input
            ref={field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder={es.hoy.capturePlaceholder}
            className={fieldClass}
          />
        </Field>
        {teams.length > 0 ? (
          <Field label={es.tasks.team}>
            <AppSelect
              value={teamId}
              onValueChange={(value) => {
                setTeamId(value);
                setAssigneeId("");
                setProjectId("");
              }}
              options={teams.map((team) => ({ value: team.id, label: team.name }))}
            />
          </Field>
        ) : null}
        {projects.length > 0 ? (
          <Field label={es.tasks.project}>
            <AppSelect
              value={projectId}
              placeholder={es.areas.noProject}
              onValueChange={setProjectId}
              options={projects.map((project) => ({
                value: project.id,
                label: project.name,
              }))}
            />
          </Field>
        ) : null}
        <Field label={es.tasks.assignee}>
          <AppSelect
            value={assigneeId}
            placeholder={es.tasks.unassigned}
            onValueChange={setAssigneeId}
            options={assigneeOptions.map((person) => ({
              value: person.id,
              label: person.full_name,
            }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={es.tasks.due}>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field label={es.tasks.priority}>
            <AppSelect
              value={priority}
              onValueChange={(value) =>
                setPriority(value as "low" | "medium" | "high" | "urgent")
              }
              options={(["low", "medium", "high", "urgent"] as const).map((level) => ({
                value: level,
                label: es.priority[level],
              }))}
            />
          </Field>
        </div>
        <Field label={es.tasks.notes}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-[9px] border border-line bg-sheet px-3 py-2 text-[14px] text-ink outline-none focus:border-ink"
          />
        </Field>
        <Button type="submit" disabled={busy || !title.trim()} className="h-11 w-full text-[13px]">
          {es.hoy.createTask}
        </Button>
      </form>
      {tool ? (
        <div className="mt-3">
          <ResultCard status={tool.status} name={tool.name} result={tool.result} />
        </div>
      ) : null}
      <p className="mt-3 text-[11px] leading-relaxed text-ink/50">{es.hoy.captureHint}</p>
    </Modal>
  ) : null;

  return (
    <div className="relative">
      {trigger === "button" ? (
        <button
          type="button"
          onClick={resetAndOpen}
          aria-label={es.hoy.createTask}
          className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-ink text-[14px] font-semibold text-cream hover:bg-pine md:h-[42px] md:w-auto md:gap-1.5 md:px-4 md:text-[15px]"
        >
          <span className="font-mono text-[12px]">+</span>
          <span className="hidden md:inline">{es.hoy.createTask}</span>
        </button>
      ) : trigger === "inline" ? (
        <button
          type="button"
          onClick={resetAndOpen}
          className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] text-ink/45"
        >
          <span className="font-mono text-[13px] text-gold">+</span>
          {es.hoy.captureInline}
        </button>
      ) : (
        <button
          type="button"
          onClick={resetAndOpen}
          className="mt-2 block w-full rounded-[9px] border border-line bg-sheet px-3 py-3.5 text-left text-[14px] text-ink/45"
        >
          {es.hoy.capturePlaceholder}
        </button>
      )}
      {dialog}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1 block text-[11px] font-semibold text-ink/55">{label}</span>
      {children}
    </div>
  );
}
