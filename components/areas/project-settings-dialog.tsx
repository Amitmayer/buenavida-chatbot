"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  deleteProjectAction,
  deleteProjectFileAction,
  loadProjectSettingsAction,
  updateProjectAction,
} from "@/app/(app)/areas/actions";
import { cn } from "@/lib/utils";
import type { AreaPerson } from "@/lib/areas/people";

type ProjectFileRow = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

const fieldClass =
  "h-11 w-full rounded-[9px] border border-line bg-sheet px-3 text-[14px] text-ink outline-none focus:border-ink";

export function ProjectSettingsDialog({
  projectId,
  people,
  onClose,
  onUpdated,
  onDeleted,
}: {
  projectId: string;
  people: AreaPerson[];
  onClose: () => void;
  onUpdated: (project: { id: string; name: string }) => void;
  onDeleted: (projectId: string) => void;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [files, setFiles] = useState<ProjectFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const result = await loadProjectSettingsAction(projectId);
      if (!alive) return;
      if (!result.ok) {
        toast.error(es.tasks.loadError);
        onClose();
        return;
      }
      setName(result.project.name);
      setNotes(result.project.notes ?? "");
      setDueDate(result.project.due_date ?? "");
      setMemberIds(result.memberIds);
      setFiles(result.files as ProjectFileRow[]);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [projectId, onClose]);

  function toggleMember(id: string) {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function save() {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    start(async () => {
      const result = await updateProjectAction({
        projectId,
        name: trimmed,
        notes: notes.trim() || null,
        due_date: dueDate || null,
        memberIds,
      });
      if (!result.ok) {
        toast.error(es.tasks.loadError);
        return;
      }
      onUpdated({ id: projectId, name: trimmed });
      toast.success(es.areas.projectSaved);
      onClose();
    });
  }

  function removeProject() {
    if (pending) return;
    start(async () => {
      const result = await deleteProjectAction(projectId);
      if (!result.ok) {
        toast.error(es.tasks.loadError);
        return;
      }
      onDeleted(projectId);
      toast.success(es.areas.projectDeleted);
      onClose();
    });
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const metaRes = await fetch("/api/files/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      if (!metaRes.ok) {
        toast.error(es.tasks.loadError);
        return;
      }
      const meta = (await metaRes.json()) as { signedUrl?: string; path?: string };
      if (!meta.signedUrl || !meta.path) return;
      const put = await fetch(meta.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) {
        toast.error(es.tasks.loadError);
        return;
      }
      const confirm = await fetch("/api/files/project", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          path: meta.path,
        }),
      });
      if (!confirm.ok) {
        toast.error(es.tasks.loadError);
        return;
      }
      const body = (await confirm.json()) as { file?: ProjectFileRow };
      if (body.file) setFiles((prev) => [body.file!, ...prev]);
    } finally {
      setUploading(false);
    }
  }

  async function openFile(fileId: string) {
    const res = await fetch(`/api/files/project/${fileId}`);
    if (!res.ok) {
      toast.error(es.tasks.loadError);
      return;
    }
    const body = (await res.json()) as { url?: string };
    if (body.url) window.open(body.url, "_blank", "noopener,noreferrer");
  }

  function removeFile(fileId: string) {
    start(async () => {
      const result = await deleteProjectFileAction(fileId);
      if (!result.ok) {
        toast.error(es.tasks.loadError);
        return;
      }
      setFiles((prev) => prev.filter((file) => file.id !== fileId));
    });
  }

  return (
    <Modal title={es.areas.projectSettings} onClose={onClose}>
      {loading ? (
        <p className="text-[13px] text-ink/55">{es.nav.loading}</p>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-ink/55">
              {es.areas.projectName}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-ink/55">
              {es.areas.projectDue}
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-ink/55">
              {es.areas.projectNotes}
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={4000}
              className="w-full resize-none rounded-[9px] border border-line bg-sheet px-3 py-2 text-[14px] text-ink outline-none focus:border-ink"
            />
          </label>
          <div>
            <span className="mb-2 block text-[11px] font-semibold text-ink/55">
              {es.areas.projectMembers}
            </span>
            {people.length === 0 ? (
              <p className="text-[13px] text-ink/55">{es.areas.peopleEmpty}</p>
            ) : (
              <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {people.map((person) => {
                  const on = memberIds.includes(person.id);
                  return (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() => toggleMember(person.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-[13px]",
                          on ? "bg-pine/10 font-semibold text-ink" : "text-ink/80 hover:bg-wash",
                        )}
                      >
                        <span className="truncate">{person.fullName}</span>
                        <span className="font-mono text-[11px] text-ink/45">{on ? "✓" : "+"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-ink/55">{es.areas.projectFiles}</span>
              <button
                type="button"
                disabled={uploading || pending}
                onClick={() => fileInput.current?.click()}
                className="flex h-8 items-center gap-1.5 rounded-[9px] border border-ink/15 px-2.5 text-[12px] font-semibold text-ink hover:bg-wash disabled:opacity-50"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {es.areas.attachFile}
              </button>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadFile(file);
                }}
              />
            </div>
            {files.length === 0 ? (
              <p className="text-[13px] text-ink/55">{es.areas.noFiles}</p>
            ) : (
              <ul className="space-y-1.5">
                {files.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center gap-2 rounded-[10px] border border-line bg-sheet px-2.5 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => void openFile(file.id)}
                      className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-ink hover:underline"
                    >
                      {file.filename}
                    </button>
                    <button
                      type="button"
                      aria-label={es.areas.removeFile}
                      onClick={() => removeFile(file.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-ink/45 hover:bg-wash hover:text-ink"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button
            type="button"
            disabled={pending || !name.trim()}
            onClick={save}
            className="h-11 w-full text-[13px]"
          >
            {es.areas.saveProject}
          </Button>
          {confirmDelete ? (
            <div className="rounded-[12px] border border-[#A8501F]/30 bg-[#A8501F]/8 p-3">
              <p className="text-[13px] text-ink">{es.areas.deleteProjectConfirm}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex h-10 flex-1 items-center justify-center rounded-[11px] border-2 border-ink/20 text-[13px] font-semibold text-ink"
                >
                  {es.mensajes.dismiss}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={removeProject}
                  className="flex h-10 flex-1 items-center justify-center rounded-[11px] bg-[#A8501F] text-[13px] font-semibold text-cream disabled:opacity-50"
                >
                  {es.areas.deleteProject}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full text-center text-[13px] font-semibold text-[#A8501F] hover:underline"
            >
              {es.areas.deleteProject}
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
