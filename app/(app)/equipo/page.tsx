import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/session";
import { EquipoDirectory } from "@/components/equipo/equipo-directory";

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

  return (
    <EquipoDirectory
      people={people ?? []}
      teams={teams ?? []}
      members={members ?? []}
    />
  );
}
