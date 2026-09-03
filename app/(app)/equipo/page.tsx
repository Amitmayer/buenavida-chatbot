import { redirect } from "next/navigation";
import { es } from "@/lib/i18n/es";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/session";
import { updateMembershipAction, updateProfileRoleAction } from "./actions";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/select";
import { teamEdge } from "@/components/tasks/team-colors";
import { initials } from "@/lib/utils";
import type { Profile, Team, TeamMember } from "@/lib/db/types";

export default async function EquipoPage() {
  const profile = await getSessionProfile();
  if (!profile) return null;
  if (!profile.isAdmin) redirect("/hoy");
  const supabase = await createClient();
  const [{ data: people }, { data: teams }, { data: members }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("teams").select("*").order("name"),
    supabase.from("team_members").select("*"),
  ]);
  const allPeople = people ?? [];
  const allTeams = teams ?? [];
  const allMembers = members ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <p className="px-4 pt-5 text-[11px] text-ink/50 md:px-7">
        {es.team.accounts
          .replace("{p}", String(allPeople.length))
          .replace("{t}", String(allTeams.length))}
      </p>
      <div className="px-4 md:px-7">
        {allPeople.map((person) => (
          <PersonRow
            key={person.id}
            person={person}
            teams={allTeams}
            memberships={allMembers.filter((m) => m.user_id === person.id)}
          />
        ))}
        <div className="py-5 pb-8">
          <p className="mb-2.5 font-mono text-[10px] font-semibold tracking-[0.04em] text-ink/40">
            {es.team.teams.toUpperCase()}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {allTeams.map((team) => {
              const count = allMembers.filter((m) => m.team_id === team.id).length;
              return (
                <div
                  key={team.id}
                  className="flex items-center gap-2 rounded-[9px] border border-ink/10 bg-sheet px-2.5 py-2"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: teamEdge(team.slug) }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-ink">
                    {team.name}
                  </span>
                  <span className="font-mono text-[10.5px] text-ink/45">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonRow({
  person,
  teams,
  memberships,
}: {
  person: Profile;
  teams: Team[];
  memberships: TeamMember[];
}) {
  const guest = person.role === "guest";
  const theirs = teams.filter((team) => memberships.some((m) => m.team_id === team.id));
  return (
    <section className="flex gap-3 border-b border-ink/10 py-[15px]">
      <span
        className={
          guest
            ? "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-dashed border-overdue text-[11px] font-semibold text-overdue"
            : person.role === "owner"
              ? "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-pine text-[11px] font-semibold text-paper"
              : "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#DDD8C6] text-[11px] font-semibold text-[#3C5540]"
        }
      >
        {initials(person.full_name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <h2 className="text-[14px] font-semibold text-ink">{person.full_name}</h2>
          {guest ? (
            <span className="rounded-full border border-overdue px-2 py-0.5 text-[10px] font-semibold text-overdue">
              {es.team.external}
            </span>
          ) : person.title ? (
            <span className="text-[10.5px] text-ink/50">{person.title}</span>
          ) : null}
        </div>
        {guest ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink/55">{es.team.guestNote}</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1">
            {theirs.map((team) => (
              <span
                key={team.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-wash px-2 py-0.5"
              >
                <span
                  className="h-[5px] w-[5px] rounded-full"
                  style={{ background: teamEdge(team.slug) }}
                />
                <span className="text-[10px] font-semibold text-ink">{team.name}</span>
              </span>
            ))}
          </div>
        )}
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-medium text-pine">{es.team.manage}</summary>
          <form action={updateProfileRoleAction} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="user_id" value={person.id} />
            <AppSelect
              name="role"
              size="sm"
              defaultValue={person.role}
              options={(["owner", "admin", "member", "guest"] as const).map((role) => ({
                value: role,
                label: es.roles[role],
              }))}
            />
            <AppSelect
              name="default_team"
              size="sm"
              defaultValue={person.default_team ?? ""}
              placeholder={es.tasks.team}
              options={(teams ?? []).map((team) => ({
                value: team.id,
                label: team.name,
              }))}
            />
            <Button type="submit" size="sm">
              {es.tasks.save}
            </Button>
          </form>
          <ul className="mt-2 flex flex-wrap gap-2">
            {teams.map((team) => {
              const membership = memberships.find((m) => m.team_id === team.id);
              return (
                <li key={team.id}>
                  <form action={updateMembershipAction} className="flex items-center gap-1">
                    <input type="hidden" name="user_id" value={person.id} />
                    <input type="hidden" name="team_id" value={team.id} />
                    {membership ? (
                      <>
                        <span className="rounded-[8px] bg-wash px-2 py-1 text-xs">
                          {team.name}
                          {membership.is_lead ? ` · ${es.team.lead}` : ""}
                        </span>
                        <input type="hidden" name="remove" value="true" />
                        <Button type="submit" size="sm" variant="ghost">
                          ×
                        </Button>
                      </>
                    ) : (
                      <Button type="submit" size="sm" variant="outline">
                        + {team.name}
                      </Button>
                    )}
                  </form>
                </li>
              );
            })}
          </ul>
        </details>
      </div>
    </section>
  );
}
