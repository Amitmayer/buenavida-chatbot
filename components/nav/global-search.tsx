"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { es } from "@/lib/i18n/es";
import { createClient } from "@/lib/supabase/client";
import { fold } from "@/lib/utils";
import { openDmAction } from "@/app/(app)/mensajes/actions";

type Hit =
  | { kind: "person"; id: string; label: string; hint: string }
  | { kind: "task"; id: string; label: string; hint: string }
  | { kind: "file"; id: string; label: string; href: string; hint: string };

export function GlobalSearch() {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void runSearch(q).then((next) => {
        if (cancelled) return;
        setHits(next);
        setActive(0);
        setOpen(true);
      });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  function go(hit?: Hit) {
    const pick = hit ?? hits[active];
    if (!pick) {
      const q = query.trim();
      if (q) router.push(`/tareas?q=${encodeURIComponent(q)}`);
      setOpen(false);
      return;
    }
    if (pick.kind === "person") {
      const form = new FormData();
      form.set("user_id", pick.id);
      start(() => {
        void openDmAction(form);
      });
      return;
    }
    if (pick.kind === "task") router.push(`/tareas/${pick.id}`);
    else router.push(pick.href);
    setOpen(false);
    setQuery("");
  }

  const grouped = [
    { key: "person" as const, title: es.nav.searchPeople, rows: hits.filter((h) => h.kind === "person") },
    { key: "task" as const, title: es.nav.searchTasks, rows: hits.filter((h) => h.kind === "task") },
    { key: "file" as const, title: es.nav.searchFiles, rows: hits.filter((h) => h.kind === "file") },
  ].filter((group) => group.rows.length > 0);

  return (
    <div ref={box} className="relative min-w-0">
      <form
        className="flex h-[34px] w-[168px] items-center gap-2 rounded-[9px] border border-line bg-sheet px-3 text-[12.5px] text-ink/45 md:w-[240px]"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <span className="font-mono text-[11px]">⌕</span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (hits.length > 0) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!open || hits.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={es.nav.search}
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink/45"
        />
      </form>
      {open && query.trim().length >= 2 ? (
        <div className="absolute right-0 z-[80] mt-1 w-[min(100vw-2rem,320px)] overflow-hidden rounded-[9px] border border-line bg-sheet shadow-lg">
          {hits.length === 0 ? (
            <p className="px-3 py-2.5 text-[13px] text-ink/55">{es.nav.searchEmpty}</p>
          ) : (
            grouped.map((group) => (
              <div key={group.key} className="border-b border-line last:border-0">
                <p className="bg-wash px-3 py-1.5 font-mono text-[10px] tracking-[0.12em] text-ink/55">
                  {group.title.toUpperCase()}
                </p>
                <ul>
                  {group.rows.map((hit) => {
                    const index = hits.indexOf(hit);
                    return (
                      <li key={`${hit.kind}-${hit.id}`}>
                        <button
                          type="button"
                          disabled={pending}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => go(hit)}
                          className={`flex w-full flex-col items-start px-3 py-2 text-left ${
                            index === active ? "bg-wash" : "hover:bg-hover"
                          }`}
                        >
                          <span className="truncate text-[13px] font-medium text-ink">{hit.label}</span>
                          <span className="truncate text-[11px] text-ink/50">{hit.hint}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

async function runSearch(raw: string): Promise<Hit[]> {
  const q = fold(raw);
  const supabase = createClient();
  const [{ data: people }, { data: tasks }, { data: brand }, { data: channelFiles }, { data: attachments }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, title").order("full_name").limit(80),
      supabase
        .from("tasks")
        .select("id, title, notes, assignee:profiles!assignee_id(full_name), owner:profiles!owner_id(full_name)")
        .limit(200),
      supabase.from("brand_files").select("id, filename").limit(80),
      supabase.from("channel_files").select("id, filename").limit(80),
      supabase.from("attachments").select("id, filename, task_id").limit(80),
    ]);

  const hits: Hit[] = [];
  for (const person of people ?? []) {
    if (!fold(person.full_name).includes(q) && !fold(person.title ?? "").includes(q)) continue;
    hits.push({
      kind: "person",
      id: person.id,
      label: person.full_name,
      hint: person.title || es.nav.searchWrite,
    });
    if (hits.filter((h) => h.kind === "person").length >= 6) break;
  }

  for (const task of tasks ?? []) {
    const assignee = Array.isArray(task.assignee) ? task.assignee[0] : task.assignee;
    const owner = Array.isArray(task.owner) ? task.owner[0] : task.owner;
    const blob = fold(
      [task.title, task.notes ?? "", assignee?.full_name ?? "", owner?.full_name ?? ""].join(" "),
    );
    if (!blob.includes(q)) continue;
    hits.push({
      kind: "task",
      id: task.id,
      label: task.title,
      hint: assignee?.full_name ?? owner?.full_name ?? es.nav.searchTasks,
    });
    if (hits.filter((h) => h.kind === "task").length >= 6) break;
  }

  for (const file of brand ?? []) {
    if (!fold(file.filename).includes(q)) continue;
    hits.push({
      kind: "file",
      id: file.id,
      label: file.filename,
      href: "/archivos?carpeta=marca",
      hint: es.nav.searchFiles,
    });
    if (hits.filter((h) => h.kind === "file").length >= 4) break;
  }
  for (const file of channelFiles ?? []) {
    if (!fold(file.filename).includes(q)) continue;
    hits.push({
      kind: "file",
      id: `c-${file.id}`,
      label: file.filename,
      href: "/archivos",
      hint: es.nav.searchFiles,
    });
    if (hits.filter((h) => h.kind === "file").length >= 6) break;
  }
  for (const file of attachments ?? []) {
    if (!fold(file.filename).includes(q)) continue;
    hits.push({
      kind: "file",
      id: `a-${file.id}`,
      label: file.filename,
      href: `/tareas/${file.task_id}`,
      hint: es.nav.searchTasks,
    });
    if (hits.filter((h) => h.kind === "file").length >= 8) break;
  }
  return hits;
}
