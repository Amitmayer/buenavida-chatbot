"use client";

import { cn } from "@/lib/utils";
import { es } from "@/lib/i18n/es";

export type AssigneePerson = { id: string; full_name: string };

export function AssigneeMultiSelect({
  people,
  selectedIds,
  onChange,
  disabled = false,
  name = "assignee_ids",
}: {
  people: AssigneePerson[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  name?: string;
}) {
  function toggle(id: string) {
    if (disabled) return;
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id],
    );
  }

  return (
    <div>
      <input type="hidden" name="assignee_ids_set" value="1" />
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {people.length === 0 ? (
        <p className="text-[13px] text-ink/55">{es.tasks.assigneesEmpty}</p>
      ) : (
        <ul
          className={cn(
            "flex max-h-40 flex-col gap-1 overflow-y-auto rounded-[9px] border border-ink/10 bg-sheet p-1",
            disabled && "opacity-70",
          )}
        >
          {people.map((person) => {
            const on = selectedIds.includes(person.id);
            return (
              <li key={person.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(person.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[8px] px-2.5 py-1.5 text-left text-[13px]",
                    on ? "bg-pine/10 font-semibold text-ink" : "text-ink/80 hover:bg-wash",
                    disabled && "cursor-default",
                  )}
                >
                  <span className="truncate">{person.full_name}</span>
                  <span className="font-mono text-[11px] text-ink/45">{on ? "✓" : "+"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
