export const TEAM_EDGE: Record<string, string> = {
  comercial: "#1E6E58",
  operaciones: "#2A6884",
  usa: "#5C6096",
  academia: "#83588C",
  marketing: "#8E5470",
  administracion: "#7C5A2E",
  regenerativo: "#4C6E33",
  direccion: "#6A6A2B",
};

export function teamEdge(slug: string | undefined): string {
  if (!slug) return "#8C978F";
  return TEAM_EDGE[slug] ?? "#8C978F";
}
