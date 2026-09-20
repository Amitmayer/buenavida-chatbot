import type { Profile } from "@/lib/db/types";

export type AssigneePerson = Pick<Profile, "id" | "full_name">;

type AssigneeLink = {
  user_id?: string;
  profiles?: AssigneePerson | AssigneePerson[] | null;
  profile?: AssigneePerson | AssigneePerson[] | null;
};

export function parseAssigneeIds(formData: FormData, key = "assignee_ids"): string[] {
  const fromMulti = formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  if (fromMulti.length > 0) {
    return [...new Set(fromMulti)];
  }
  const single = formData.get("assignee_id");
  if (typeof single === "string" && single.trim()) return [single.trim()];
  return [];
}

export function assigneesFromLinks(
  links: AssigneeLink[] | null | undefined,
  fallback: AssigneePerson | AssigneePerson[] | null | undefined = null,
): AssigneePerson[] {
  const fromJoin = (links ?? [])
    .map((row) => {
      const nested = row.profiles ?? row.profile ?? null;
      const person = Array.isArray(nested) ? nested[0] : nested;
      if (!person?.id || !person.full_name) return null;
      return { id: person.id, full_name: person.full_name };
    })
    .filter((person): person is AssigneePerson => Boolean(person));
  if (fromJoin.length > 0) return fromJoin;
  if (!fallback) return [];
  const one = Array.isArray(fallback) ? fallback[0] : fallback;
  return one?.id && one.full_name ? [{ id: one.id, full_name: one.full_name }] : [];
}

export function formatAssigneeNames(people: AssigneePerson[]): string {
  if (people.length === 0) return "";
  if (people.length === 1) return people[0].full_name;
  if (people.length === 2) return `${people[0].full_name}, ${people[1].full_name}`;
  return `${people[0].full_name} +${people.length - 1}`;
}

export function taskHasAssignee(
  task: { assignee_id?: string | null; assignees?: AssigneePerson[] },
  userId: string,
): boolean {
  if (task.assignees?.some((person) => person.id === userId)) return true;
  return task.assignee_id === userId;
}
