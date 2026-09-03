"use client";

import { useMemo, useState } from "react";
import { es } from "@/lib/i18n/es";

export type PersonOption = { id: string; full_name: string };

export function PeopleTypeahead({
  people,
  excludeIds = [],
  onPick,
  placeholder,
}: {
  people: PersonOption[];
  excludeIds?: string[];
  onPick: (person: PersonOption) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const available = people.filter((person) => !excludeIds.includes(person.id));
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return available.filter((person) => person.full_name.toLowerCase().includes(q)).slice(0, 6);
  }, [available, query]);

  function commit(person?: PersonOption) {
    const pick = person ?? (matches.length === 1 ? matches[0] : matches[active]);
    if (!pick) return;
    onPick(pick);
    setQuery("");
    setActive(0);
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          const value = e.target.value;
          if (value.includes(",")) {
            const name = value.replace(/,/g, " ").trim();
            setQuery(name);
            setActive(0);
            const q = name.toLowerCase();
            const hits = available.filter((person) => person.full_name.toLowerCase().includes(q));
            if (hits.length === 1) commit(hits[0]);
            return;
          }
          setQuery(value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" || e.key === ",") {
            if (matches.length > 0) {
              e.preventDefault();
              commit(matches.length === 1 ? matches[0] : matches[active]);
            }
          } else if (e.key === "Escape") {
            setQuery("");
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="h-11 w-full rounded-[9px] border border-ink/15 bg-sheet px-3 text-[14px] text-ink placeholder:text-ink/45 outline-none focus:border-ink"
      />
      {query.trim() ? (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-[9px] border border-ink/10 bg-sheet shadow-md">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-mute">{es.mensajes.noMatch}</li>
          ) : (
            matches.map((person, index) => (
              <li key={person.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(person)}
                  className={`block w-full px-3 py-2 text-left text-[14px] ${
                    index === active ? "bg-wash font-medium text-ink" : "text-ink"
                  }`}
                >
                  {person.full_name}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
