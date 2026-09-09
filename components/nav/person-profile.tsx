"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import { teamEdge } from "@/components/tasks/team-colors";
import { initials } from "@/lib/utils";
import { openDmAction } from "@/app/(app)/mensajes/actions";
import type { UserRole } from "@/lib/db/types";

type TeamChip = { id: string; slug: string; name: string; isLead: boolean };

type Card = {
  id: string;
  fullName: string;
  title: string | null;
  role: UserRole;
  email: string | null;
  teams: TeamChip[];
  mine: boolean;
};

const DirectorySchema = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  title: z.string().nullable(),
  role: z.enum(["owner", "admin", "member", "guest"]),
  email: z.string().nullable(),
});

const TeamSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
});

export function PersonProfile({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [card, setCard] = useState<Card | null>(null);
  const [missing, setMissing] = useState(false);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadCard(userId).then((next) => {
      if (cancelled) return;
      if (!next) setMissing(true);
      else setCard(next);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function write() {
    if (!card || card.mine || writing) return;
    setWriting(true);
    const form = new FormData();
    form.set("user_id", card.id);
    onClose();
    await openDmAction(form);
  }

  const title = card?.fullName ?? es.team.profile;

  return (
    <Modal title={title} onClose={onClose}>
      {missing ? (
        <p className="text-[13px] text-ink/55">{es.nav.searchEmpty}</p>
      ) : !card ? (
        <p className="text-[13px] text-ink/45">{es.nav.loading}</p>
      ) : (
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pine text-[13px] font-semibold text-paper">
              {initials(card.fullName)}
            </span>
            <div className="min-w-0">
              {card.title ? <p className="text-[13px] text-ink/70">{card.title}</p> : null}
              <p className="text-[12px] text-ink/50">{es.roles[card.role]}</p>
            </div>
          </div>

          {card.email ? (
            <div className="mt-4">
              <p className="text-[11px] font-semibold text-ink/55">{es.auth.email}</p>
              <a href={`mailto:${card.email}`} className="mt-0.5 block truncate text-[13px] text-pine">
                {card.email}
              </a>
            </div>
          ) : null}

          {card.teams.length > 0 ? (
            <div className="mt-4">
              <p className="text-[11px] font-semibold text-ink/55">{es.team.memberships}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {card.teams.map((team) => (
                  <span
                    key={team.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-wash px-2 py-0.5"
                  >
                    <span
                      className="h-[5px] w-[5px] rounded-full"
                      style={{ background: teamEdge(team.slug) }}
                    />
                    <span className="text-[11px] font-medium text-ink">
                      {team.name}
                      {team.isLead ? ` · ${es.team.lead}` : ""}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {card.mine ? null : (
            <Button type="button" className="mt-5 w-full" disabled={writing} onClick={() => void write()}>
              {es.nav.searchWrite}
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}

async function loadCard(userId: string): Promise<Card | null> {
  const supabase = createClient();
  const [{ data: profile }, { data: memberships }, session, directory] = await Promise.all([
    supabase.from("profiles").select("id, full_name, title, role").eq("id", userId).maybeSingle(),
    supabase.from("team_members").select("is_lead, teams(id, slug, name)").eq("user_id", userId),
    supabase.auth.getUser(),
    supabase.rpc("profile_directory", { p_id: userId }),
  ]);
  if (!profile) return null;

  const dir = DirectorySchema.safeParse(directory.data);
  const mine = session.data.user?.id === profile.id;
  const email = dir.success ? dir.data.email : mine ? (session.data.user?.email ?? null) : null;

  const teams: TeamChip[] = [];
  for (const row of memberships ?? []) {
    const nested = "teams" in row ? row.teams : null;
    const one = Array.isArray(nested) ? nested[0] : nested;
    const team = TeamSchema.safeParse(one);
    if (!team.success) continue;
    teams.push({
      id: team.data.id,
      slug: team.data.slug,
      name: team.data.name,
      isLead: row.is_lead,
    });
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    title: profile.title,
    role: profile.role,
    email,
    teams,
    mine,
  };
}
