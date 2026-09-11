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
    const pool = q
      ? available.filter((person) => person.full_name.toLowerCase().includes(q))
      : available;
    return pool.slice(0, 12);
  }, [available, query]);

  function commit(person?: PersonOption) {
    const pick = person ?? (matches.length === 1 ? matches[0] : matches[active]);
    if (!pick) return;
    onPick(pick);
    setQuery("");
    setActive(0);
  }

  return (
    <div>
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
      <ul className="mt-2 max-h-56 overflow-y-auto rounded-[9px] border border-ink/10 bg-sheet">
        {matches.length === 0 ? (
          <li className="px-3 py-2 text-[13px] text-mute">
            {query.trim() ? es.mensajes.noMatch : es.mensajes.searchPerson}
          </li>
        ) : (
          matches.map((person, index) => (
            <li key={person.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(person)}
                className={`block w-full px-3 py-2.5 text-left text-[14px] ${
                  index === active ? "bg-wash font-medium text-ink" : "text-ink hover:bg-wash/70"
                }`}
              >
                {person.full_name}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
