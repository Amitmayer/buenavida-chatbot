export const TEAM_EDGE: Record<string, string> = {
  comercial: "#5B8C6A",
  operaciones: "#4F7FA8",
  usa: "#7A6FC0",
  academia: "#B06FA8",
  marketing: "#C4718A",
  administracion: "#C79350",
  regenerativo: "#8FA85B",
  direccion: "#9AA85B",
};

const BARS = ["#5B8C6A", "#4F7FA8", "#7A6FC0", "#B06FA8", "#C4718A", "#C79350"];

export function teamEdge(slug: string | undefined): string {
  if (!slug) return "#8C978F";
  return TEAM_EDGE[slug] ?? "#8C978F";
}

export function mailBar(seed: string): string {
  let n = 0;
  for (let i = 0; i < seed.length; i += 1) n += seed.charCodeAt(i);
  return BARS[n % BARS.length] ?? "#4F7FA8";
}
