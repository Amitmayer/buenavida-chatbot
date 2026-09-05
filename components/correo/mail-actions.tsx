"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { draftMailAction, sendMailAction, taskFromMailAction } from "@/app/(app)/correo/actions";
import type { Email } from "@/lib/db/types";

export function MailActions({ mail }: { mail: Email }) {
  const [body, setBody] = useState(mail.draft_reply ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-3 border-t border-line px-4 py-4 md:px-6">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const result = await draftMailAction(mail.id);
              if (result.ok && result.draft) {
                setBody(result.draft);
                toast.success(es.correo.draftReady);
              } else toast.error(es.correo.draftError);
            });
          }}
        >
          {es.correo.draft}
        </Button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            start(async () => {
              const result = await taskFromMailAction(new FormData(form));
              if (result.ok) {
                toast.success(es.tasks.saved);
                router.push(`/tareas/${result.taskId}`);
              } else toast.error(es.tasks.loadError);
            });
          }}
        >
          <input type="hidden" name="email_id" value={mail.id} />
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            {es.correo.createTask}
          </Button>
        </form>
      </div>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          start(async () => {
            const result = await sendMailAction(new FormData(form));
            if (result.ok) {
              toast.success(es.correo.sent);
              setBody("");
            } else toast.error(es.correo.sendError);
          });
        }}
      >
        <input type="hidden" name="email_id" value={mail.id} />
        <Textarea
          name="body"
          required
          maxLength={8000}
          rows={5}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={es.correo.replyPlaceholder}
        />
        <Button type="submit" disabled={pending || !body.trim()} className="h-11 w-full text-[13px]">
          {es.correo.send}
        </Button>
      </form>
    </div>
  );
}
