import { describe, expect, it } from "vitest";
import { mapAreaPeople } from "@/lib/areas/people";

describe("mapAreaPeople", () => {
  it("unwraps nested profiles and sorts leads first", () => {
    const people = mapAreaPeople([
      {
        is_lead: false,
        profiles: { id: "11111111-1111-4111-8111-111111111111", full_name: "Nathan", title: "B2B" },
      },
      {
        is_lead: true,
        profiles: [
          { id: "22222222-2222-4222-8222-222222222222", full_name: "Deybid", title: "Director" },
        ],
      },
    ]);
    expect(people.map((person) => person.fullName)).toEqual(["Deybid", "Nathan"]);
    expect(people[0]?.isLead).toBe(true);
  });

  it("skips rows without a profile", () => {
    expect(mapAreaPeople([{ is_lead: true, profiles: null }, null])).toEqual([]);
  });
});
