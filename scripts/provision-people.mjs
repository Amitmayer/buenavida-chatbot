import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PEOPLE_PATH = resolve(process.cwd(), "scripts/people.json");
const ENV_PATH = resolve(process.cwd(), ".env.local");

const Person = {
  parse(raw) {
    const email = String(raw.email ?? "").trim().toLowerCase();
    const password = String(raw.password ?? "");
    const full_name = String(raw.full_name ?? "").trim();
    const role = raw.role ?? "member";
    if (!email.includes("@")) throw new Error(`correo inválido: ${raw.email}`);
    if (password.length < 8) throw new Error(`clave corta para ${email} (mínimo 8)`);
    if (!full_name) throw new Error(`falta full_name para ${email}`);
    if (!["owner", "admin", "member", "guest"].includes(role)) {
      throw new Error(`rol inválido para ${email}: ${role}`);
    }
    return {
      email,
      password,
      full_name,
      title: raw.title ? String(raw.title) : null,
      role,
      default_team: raw.default_team ? String(raw.default_team) : null,
      teams: Array.isArray(raw.teams) ? raw.teams.map(String) : [],
      lead_of: Array.isArray(raw.lead_of) ? raw.lead_of.map(String) : [],
    };
  },
};

function loadEnv() {
  if (!existsSync(ENV_PATH)) return;
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!existsSync(PEOPLE_PATH)) {
  console.log("Todavía no hay lista.");
  console.log("Copiá scripts/people.example.json a scripts/people.json y llená correo, clave, equipos.");
  process.exit(0);
}

const people = JSON.parse(readFileSync(PEOPLE_PATH, "utf8"));
if (!Array.isArray(people) || people.length === 0) {
  console.error("scripts/people.json tiene que ser una lista de personas.");
  process.exit(1);
}

const supabase = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: teams, error: teamsError } = await supabase.from("teams").select("id, slug");
if (teamsError) {
  console.error(teamsError.message);
  process.exit(1);
}
const teamId = Object.fromEntries((teams ?? []).map((team) => [team.slug, team.id]));

function requireTeam(slug, email) {
  const id = teamId[slug];
  if (!id) throw new Error(`${email}: no existe el equipo ${slug}`);
  return id;
}

let ok = 0;
for (const row of people) {
  const person = Person.parse(row);
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: person.email,
    password: person.password,
    email_confirm: true,
    user_metadata: { full_name: person.full_name },
  });

  let userId = created?.user?.id;
  if (createError) {
    const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 200 });
    if (listError) throw listError;
    const existing = list.users.find((user) => user.email === person.email);
    if (!existing) throw createError;
    userId = existing.id;
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: person.password,
      email_confirm: true,
      user_metadata: { full_name: person.full_name },
    });
    if (updateError) throw updateError;
    console.log(`actualizado ${person.email}`);
  } else {
    console.log(`creado ${person.email}`);
  }

  const defaultTeam = person.default_team ? requireTeam(person.default_team, person.email) : null;
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: person.full_name,
      title: person.title,
      role: person.role,
      default_team: defaultTeam,
    })
    .eq("id", userId);
  if (profileError) throw profileError;

  for (const slug of person.teams) {
    const { error: memberError } = await supabase.from("team_members").upsert({
      team_id: requireTeam(slug, person.email),
      user_id: userId,
      is_lead: person.lead_of.includes(slug),
    });
    if (memberError) throw memberError;
  }
  ok += 1;
}

console.log(`${ok} cuentas listas. Nadie puede registrarse solo; solo estas claves entran.`);
