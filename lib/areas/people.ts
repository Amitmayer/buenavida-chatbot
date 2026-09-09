import { z } from "zod";

export type AreaPerson = {
  id: string;
  fullName: string;
  title: string | null;
  isLead: boolean;
};

const ProfileLite = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  title: z.string().nullable(),
});

export function mapAreaPeople(rows: unknown): AreaPerson[] {
  if (!Array.isArray(rows)) return [];
  const people: AreaPerson[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { is_lead?: unknown; profiles?: unknown };
    const nested = rec.profiles;
    const one = Array.isArray(nested) ? nested[0] : nested;
    const parsed = ProfileLite.safeParse(one);
    if (!parsed.success) continue;
    people.push({
      id: parsed.data.id,
      fullName: parsed.data.full_name,
      title: parsed.data.title,
      isLead: rec.is_lead === true,
    });
  }
  people.sort((a, b) => {
    if (a.isLead !== b.isLead) return a.isLead ? -1 : 1;
    return a.fullName.localeCompare(b.fullName, "es");
  });
  return people;
}
