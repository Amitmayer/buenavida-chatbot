"use client";

import { useMemo, useState } from "react";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { teamEdge } from "@/components/tasks/team-colors";
import { initials } from "@/lib/utils";
import { updateMembershipAction, updateProfileRoleAction } from "@/app/(app)/equipo/actions";
import type { Profile, Team, TeamMember } from "@/lib/db/types";

export function EquipoDirectory({
  people,
  teams,
  members,
}: {
  people: Profile[];
  teams: Team[];
  members: TeamMember[];
}) {
  const [area, setArea] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const shown = useMemo(() => {
    if (!area) return people;
    const ids = new Set(members.filter((row) => row.team_id === area).map((row) => row.user_id));
    return people.filter((person) => ids.has(person.id));
  }, [area, members, people]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-5 md:px-9">
        <p className="font-mono text-[15px] font-medium text-ink/70">
          {es.team.accountsShort.replace("{p}", String(people.length)).replace("{t}", String(teams.length))}
        </p>
        <span className="flex-1" />
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((open) => !open)}
            className="flex h-[42px] items-center rounded-[11px] border-2 border-ink/20 bg-sheet px-4 text-[14px] font-semibold text-ink hover:border-ink hover:bg-white md:text-[15px]"
          >
            {es.team.filterArea}
          </button>
          {filterOpen ? (
            <ul className="absolute right-0 z-20 mt-2 min-w-[220px] overflow-hidden rounded-[14px] border-2 border-ink/12 bg-sheet p-1.5 shadow-lg">
              <li>
                <button
                  type="button"
                  className="flex w-full rounded-[10px] px-3 py-2 text-left text-[15px] hover:bg-wash"
                  onClick={() => {
                    setArea("");
                    setFilterOpen(false);
                  }}
                >
                  {es.team.allAreas}
                </button>
              </li>
              {teams.map((team) => (
                <li key={team.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[15px] hover:bg-wash"
                    onClick={() => {
                      setArea(team.id);
                      setFilterOpen(false);
                    }}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: teamEdge(team.slug) }}
                    />
                    {team.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="flex h-[42px] items-center gap-1.5 rounded-[11px] bg-overdue px-4 text-[15px] font-semibold text-white md:text-[16px]"
        >
          <span className="text-[22px] leading-none">+</span>
          {es.team.invite}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-5 px-4 py-7 md:grid-cols-2 md:px-9 xl:grid-cols-3">
        {shown.map((person) => (
          <PersonCard
            key={person.id}
            person={person}
            teams={teams}
            memberships={members.filter((row) => row.user_id === person.id)}
          />
        ))}
      </div>
      {inviteOpen ? (
        <Modal title={es.team.invite} onClose={() => setInviteOpen(false)}>
          <p className="text-[15px] leading-relaxed text-ink/75">{es.team.inviteHint}</p>
        </Modal>
      ) : null}
    </div>
  );
}

function personMeta(person: Profile, teamCount: number, allTeams: number): string {
  if (person.role === "guest") return es.team.limited;
  if ((person.role === "owner" || person.role === "admin") && teamCount >= allTeams && allTeams > 0) {
    return person.role === "owner" ? es.team.fullAccess : es.team.adminAll;
  }
  if (teamCount === 1) return es.team.areaOne;
  if (teamCount > 1) return es.team.areaCount.replace("{n}", String(teamCount));
  return es.team.limited;
}

function PersonCard({
  person,
  teams,
  memberships,
}: {
  person: Profile;
  teams: Team[];
  memberships: TeamMember[];
}) {
  const guest = person.role === "guest";
  const theirs = teams.filter((team) => memberships.some((row) => row.team_id === team.id));
  const tag = guest ? es.team.external : person.role === "admin" ? es.team.adminTag : null;

  return (
    <section
      className={
        guest
          ? "rounded-[18px] border-2 border-overdue bg-wash px-6 py-[22px]"
          : "rounded-[18px] border-2 border-ink/12 bg-sheet px-6 py-[22px]"
      }
    >
      <div className="flex items-center gap-3.5">
        <span
          className={
            guest
              ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-overdue font-mono text-[15px] font-semibold text-cream"
              : "flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-ink font-mono text-[15px] font-semibold text-cream"
          }
        >
          {initials(person.full_name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <h2 className="truncate text-[17px] font-bold text-ink md:text-[18px]">{person.full_name}</h2>
            {tag ? (
              <span
                className={
                  guest
                    ? "shrink-0 rounded-[14px] bg-overdue px-2.5 py-1 text-[13px] font-semibold text-white"
                    : "shrink-0 rounded-[14px] bg-ink px-2.5 py-1 text-[13px] font-semibold text-white"
                }
              >
                {tag}
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-[14px] text-ink/70 md:text-[15px]">
            {guest ? es.team.guestNote : (person.title ?? es.roles[person.role])}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {theirs.length > 0 ? (
          theirs.map((team) => {
            const color = teamEdge(team.slug);
            return (
              <span
                key={team.id}
                className="rounded-[11px] px-2.5 py-0.5 text-[13px] font-medium text-ink md:text-[14px]"
                style={{ background: `${color}33`, boxShadow: `inset 0 0 0 1.5px ${color}` }}
              >
                {team.name}
              </span>
            );
          })
        ) : (
          <span className="rounded-[13px] px-3 py-1 text-[14px] font-medium text-ink/70 shadow-[inset_0_0_0_1.5px_rgba(14,33,25,0.2)]">
            {es.team.noAreas}
          </span>
        )}
      </div>
      <details className="mt-[18px] border-t-2 border-ink/10 pt-3.5">
        <summary className="flex cursor-pointer list-none items-center gap-2.5">
          <span className="flex h-9 items-center rounded-[10px] bg-ink px-3.5 text-[14px] font-semibold text-cream">
            {es.team.manage}
          </span>
          <span className="font-mono text-[13px] text-ink/65 md:text-[14px]">
            {personMeta(person, theirs.length, teams.length)}
          </span>
        </summary>
        <form action={updateProfileRoleAction} className="mt-3 flex flex-wrap items-center gap-2">
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
            options={teams.map((team) => ({
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
            const membership = memberships.find((row) => row.team_id === team.id);
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
    </section>
  );
}
