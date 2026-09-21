"use client";

import { useMemo, useRef, useState } from "react";
import { cn, initials } from "@/lib/utils";
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
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => people.find((person) => person.id === id))
        .filter((person): person is AssigneePerson => Boolean(person)),
    [people, selectedIds],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? people.filter((person) => person.full_name.toLowerCase().includes(q))
      : people;
    return pool.slice(0, 12);
  }, [people, query]);

  function add(person: AssigneePerson) {
    if (disabled) return;
    if (!selectedIds.includes(person.id)) {
      onChange([...selectedIds, person.id]);
    }
    setQuery("");
    setActive(0);
    setOpen(true);
    inputRef.current?.focus();
  }

  function remove(id: string) {
    if (disabled) return;
    onChange(selectedIds.filter((item) => item !== id));
    inputRef.current?.focus();
  }

  function commitActive() {
    const pick = matches[active] ?? (matches.length === 1 ? matches[0] : undefined);
    if (!pick) return;
    add(pick);
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
        <div
          className={cn(
            "rounded-[9px] border border-ink/15 bg-sheet focus-within:border-ink",
            disabled && "opacity-70",
          )}
        >
          <div
            className="flex min-h-11 flex-wrap items-center gap-1.5 px-2 py-1.5"
            onClick={() => {
              if (disabled) return;
              setOpen(true);
              inputRef.current?.focus();
            }}
          >
            {selected.map((person) => (
              <span
                key={person.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#DDD8C6] py-0.5 pl-0.5 pr-1 text-[12px] font-medium text-[#3C5540]"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#CFC8B4] text-[8px] font-semibold">
                  {initials(person.full_name)}
                </span>
                <span className="truncate">{person.full_name}</span>
                {!disabled ? (
                  <button
                    type="button"
                    aria-label={es.tasks.removeAssignee.replace("{name}", person.full_name)}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(person.id);
                    }}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[14px] leading-none text-[#3C5540]/70 hover:bg-[#C4BCA8] hover:text-[#3C5540]"
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))}
            <input
              ref={inputRef}
              value={query}
              disabled={disabled}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                // Let click on a dropdown row land first.
                window.setTimeout(() => setOpen(false), 120);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setOpen(true);
                  setActive((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  if (matches.length > 0) {
                    e.preventDefault();
                    commitActive();
                  }
                } else if (e.key === "Backspace" && !query && selectedIds.length > 0) {
                  remove(selectedIds[selectedIds.length - 1]);
                } else if (e.key === "Escape") {
                  setQuery("");
                  setOpen(false);
                }
              }}
              placeholder={selected.length === 0 ? es.tasks.addAssignee : es.tasks.addAnotherAssignee}
              autoComplete="off"
              className="min-w-[7rem] flex-1 bg-transparent px-1 py-1.5 text-[14px] text-ink placeholder:text-ink/40 outline-none"
            />
            {!disabled ? (
              <button
                type="button"
                aria-label={es.tasks.addAssignee}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                  inputRef.current?.focus();
                }}
                className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink/15 text-[16px] font-semibold leading-none text-ink/70 hover:bg-wash hover:text-ink"
              >
                +
              </button>
            ) : null}
          </div>

          {open && !disabled ? (
            <ul className="max-h-48 overflow-y-auto border-t border-ink/10">
              {matches.length === 0 ? (
                <li className="px-3 py-2.5 text-[13px] text-ink/50">
                  {query.trim() ? es.mensajes.noMatch : es.tasks.assigneesEmpty}
                </li>
              ) : (
                matches.map((person, index) => {
                  const already = selectedIds.includes(person.id);
                  return (
                    <li key={person.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => add(person)}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px]",
                          index === active ? "bg-wash" : "hover:bg-wash/70",
                          already && "text-ink/55",
                        )}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DDD8C6] text-[10px] font-semibold text-[#3C5540]">
                          {initials(person.full_name)}
                        </span>
                        <span className={cn("min-w-0 flex-1 truncate", !already && "font-medium text-ink")}>
                          {person.full_name}
                        </span>
                        <span className="font-mono text-[12px] text-ink/45">
                          {already ? "✓" : "+"}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
