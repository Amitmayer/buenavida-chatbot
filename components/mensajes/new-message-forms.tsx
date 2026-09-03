"use client";

import { useState, type ReactNode } from "react";
import { MessageSquarePlus, Users, X } from "lucide-react";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { openDmAction, createGroupAction } from "@/app/(app)/mensajes/actions";
import { PeopleTypeahead, type PersonOption } from "@/components/mensajes/people-typeahead";

export function NewMessageForms({
  people,
}: {
  people: PersonOption[];
}) {
  const [dmOpen, setDmOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [members, setMembers] = useState<PersonOption[]>([]);
  const [pending, setPending] = useState(false);

  async function pickDm(person: PersonOption) {
    const form = new FormData();
    form.set("user_id", person.id);
    setDmOpen(false);
    await openDmAction(form);
  }

  async function createGroup() {
    if (!title.trim() || members.length === 0 || pending) return;
    setPending(true);
    const form = new FormData();
    form.set("title", title.trim());
    for (const member of members) form.append("member_ids", member.id);
    await createGroupAction(form);
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setDmOpen(true)}
          aria-label={es.mensajes.newDm}
          title={es.mensajes.newDm}
          className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-ink/15 text-ink hover:bg-hover"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setGroupOpen(true);
            setTitle("");
            setMembers([]);
          }}
          aria-label={es.mensajes.newGroup}
          title={es.mensajes.newGroup}
          className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-ink/15 text-ink hover:bg-hover"
        >
          <Users className="h-4 w-4" />
        </button>
      </div>

      {dmOpen ? (
        <Modal title={es.mensajes.newDmTitle} onClose={() => setDmOpen(false)}>
          <PeopleTypeahead
            people={people}
            onPick={(person) => void pickDm(person)}
            placeholder={es.mensajes.searchPerson}
          />
        </Modal>
      ) : null}

      {groupOpen ? (
        <Modal title={es.mensajes.newGroupTitle} onClose={() => setGroupOpen(false)}>
          <label className="mb-1 block text-[11px] font-semibold text-ink/55">{es.mensajes.groupTitle}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            className="mb-4 h-11 w-full rounded-[9px] border border-ink/15 bg-sheet px-3 text-[14px] outline-none focus:border-ink"
          />
          <p className="mb-1 text-[11px] font-semibold text-ink/55">{es.mensajes.members}</p>
          {members.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {members.map((member) => (
                <span
                  key={member.id}
                  className="inline-flex items-center gap-1 rounded-full bg-wash px-2 py-1 text-[12px] font-medium text-ink"
                >
                  {member.full_name}
                  <button
                    type="button"
                    aria-label={es.mensajes.removeMember}
                    onClick={() => setMembers((prev) => prev.filter((item) => item.id !== member.id))}
                    className="text-ink/45 hover:text-ink"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <PeopleTypeahead
            people={people}
            excludeIds={members.map((m) => m.id)}
            onPick={(person) => setMembers((prev) => [...prev, person])}
            placeholder={es.mensajes.searchPerson}
          />
          <p className="mt-2 text-[11px] text-ink/50">{es.mensajes.membersHint}</p>
          <Button
            type="button"
            className="mt-4 w-full"
            disabled={!title.trim() || members.length === 0 || pending}
            onClick={() => void createGroup()}
          >
            {es.mensajes.create}
          </Button>
        </Modal>
      ) : null}
    </>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-pine/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="w-full max-w-md rounded-lg border border-ink/10 bg-sheet p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-[18px] font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="text-[11px] font-semibold text-ink/50">
            {es.tasks.close}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
