import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PEOPLE_PATH = resolve(process.cwd(), "scripts/people.json");
const ENV_PATH = resolve(process.cwd(), ".env.local");
const COMPANY_CHANNELS = ["general", "bot-alertas"];

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
      channels: Array.isArray(raw.channels) ? raw.channels.map(String) : [],
      reports_to: raw.reports_to ? String(raw.reports_to).trim().toLowerCase() : null,
      full_access: Boolean(raw.full_access),
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

const [{ data: teams, error: teamsError }, { data: channels, error: channelsError }] = await Promise.all([
  supabase.from("teams").select("id, slug"),
  supabase.from("chats").select("id, slug").eq("kind", "channel"),
]);
if (teamsError) {
  console.error(teamsError.message);
  process.exit(1);
}
if (channelsError) {
  console.error(channelsError.message);
  process.exit(1);
}
const teamId = Object.fromEntries((teams ?? []).map((team) => [team.slug, team.id]));
const channelId = Object.fromEntries((channels ?? []).map((chat) => [chat.slug, chat.id]));

function requireTeam(slug, email) {
  const id = teamId[slug];
  if (!id) throw new Error(`${email}: no existe el equipo ${slug}`);
  return id;
}

function requireChannel(slug, email) {
  const id = channelId[slug];
  if (!id) throw new Error(`${email}: no existe el canal ${slug}`);
  return id;
}

const byEmail = new Map();
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
      full_access: person.full_access,
    })
    .eq("id", userId);
  if (profileError) throw profileError;

  const wantedTeams = new Set(person.teams);
  for (const slug of wantedTeams) {
    const { error: memberError } = await supabase.from("team_members").upsert({
      team_id: requireTeam(slug, person.email),
      user_id: userId,
      is_lead: person.lead_of.includes(slug),
    });
    if (memberError) throw memberError;
  }
  const { data: currentTeams, error: currentTeamsError } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId);
  if (currentTeamsError) throw currentTeamsError;
  const wantedTeamIds = new Set([...wantedTeams].map((slug) => requireTeam(slug, person.email)));
  for (const row of currentTeams ?? []) {
    if (wantedTeamIds.has(row.team_id)) continue;
    const { error: dropError } = await supabase
      .from("team_members")
      .delete()
      .eq("user_id", userId)
      .eq("team_id", row.team_id);
    if (dropError) throw dropError;
  }

  const wantedChannels = new Set(person.channels);
  if (person.role !== "guest") {
    for (const slug of COMPANY_CHANNELS) wantedChannels.add(slug);
  }
  if (Object.keys(channelId).length > 0) {
    for (const slug of wantedChannels) {
      const { error: channelError } = await supabase.from("chat_members").upsert({
        chat_id: requireChannel(slug, person.email),
        user_id: userId,
      });
      if (channelError) throw channelError;
    }
    const { data: currentChannels, error: currentChannelsError } = await supabase
      .from("chat_members")
      .select("chat_id")
      .eq("user_id", userId)
      .in("chat_id", Object.values(channelId));
    if (currentChannelsError) throw currentChannelsError;
    const wantedChannelIds = new Set([...wantedChannels].map((slug) => requireChannel(slug, person.email)));
    for (const row of currentChannels ?? []) {
      if (wantedChannelIds.has(row.chat_id)) continue;
      const { error: dropError } = await supabase
        .from("chat_members")
        .delete()
        .eq("user_id", userId)
        .eq("chat_id", row.chat_id);
      if (dropError) throw dropError;
    }
  }

  byEmail.set(person.email, { userId, reports_to: person.reports_to });
  ok += 1;
}

for (const [email, row] of byEmail) {
  const reportsToId = row.reports_to ? byEmail.get(row.reports_to)?.userId ?? null : null;
  if (row.reports_to && !reportsToId) {
    throw new Error(`${email}: reports_to ${row.reports_to} no está en la lista`);
  }
  const { error } = await supabase.from("profiles").update({ reports_to: reportsToId }).eq("id", row.userId);
  if (error) throw error;
}

console.log(`${ok} cuentas listas. Nadie puede registrarse solo; solo estas claves entran.`);
