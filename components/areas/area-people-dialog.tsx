"use client";

import { useState } from "react";
import { es } from "@/lib/i18n/es";
import { Modal } from "@/components/ui/modal";
import { PersonProfile } from "@/components/nav/person-profile";
import { initials } from "@/lib/utils";
import type { AreaPerson } from "@/lib/areas/people";

export function AreaPeopleDialog({
  teamName,
  people,
  onClose,
}: {
  teamName: string;
  people: AreaPerson[];
  onClose: () => void;
}) {
  const [personId, setPersonId] = useState<string | null>(null);

  if (personId) {
    return <PersonProfile userId={personId} onClose={() => setPersonId(null)} />;
  }

  return (
    <Modal title={es.areas.peopleTitle.replace("{name}", teamName)} onClose={onClose}>
      {people.length === 0 ? (
        <p className="text-[13px] text-ink/55">{es.areas.peopleEmpty}</p>
      ) : (
        <ul className="-mx-1.5">
          {people.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => setPersonId(person.id)}
                className="flex w-full items-center gap-3 rounded-[12px] px-1.5 py-2 text-left hover:bg-wash"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pine text-[12px] font-semibold text-paper">
                  {initials(person.fullName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[14px] font-semibold text-ink">{person.fullName}</span>
                    {person.isLead ? (
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium text-ink/70 shadow-[inset_0_0_0_1px_rgba(14,33,25,0.18)]">
                        {es.team.lead}
                      </span>
                    ) : null}
                  </span>
                  {person.title ? (
                    <span className="mt-0.5 block truncate text-[12px] text-ink/55">{person.title}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
