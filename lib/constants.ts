export const APP_TIMEZONE = "America/Costa_Rica";

export const USER_IDS = {
  gally: "a0000000-0000-0000-0000-000000000001",
  naty: "a0000000-0000-0000-0000-000000000002",
  deybid: "a0000000-0000-0000-0000-000000000003",
  roy: "a0000000-0000-0000-0000-000000000004",
  susana: "a0000000-0000-0000-0000-000000000005",
  amanda: "a0000000-0000-0000-0000-000000000006",
  nathan: "a0000000-0000-0000-0000-000000000007",
  fernanda: "a0000000-0000-0000-0000-000000000008",
  jenny: "a0000000-0000-0000-0000-000000000009",
  angie: "a0000000-0000-0000-0000-00000000000a",
  jhonny: "a0000000-0000-0000-0000-00000000000b",
  david: "a0000000-0000-0000-0000-00000000000c",
} as const;

export const FEEDBACK_CHAT_ID = "e0000000-0000-0000-0000-000000000001";

export const CHANNEL_IDS = {
  ventasCr: "c0000000-0000-0000-0000-000000000001",
  estrategia: "c0000000-0000-0000-0000-000000000002",
  academia: "c0000000-0000-0000-0000-000000000003",
  usa: "c0000000-0000-0000-0000-000000000004",
  admin: "c0000000-0000-0000-0000-000000000005",
  regenerativo: "c0000000-0000-0000-0000-000000000006",
  rutaComercial: "c0000000-0000-0000-0000-000000000007",
  pedidos: "c0000000-0000-0000-0000-000000000008",
  cotizaciones: "c0000000-0000-0000-0000-000000000009",
  operaciones: "c0000000-0000-0000-0000-00000000000a",
  logistica: "c0000000-0000-0000-0000-00000000000b",
  marketing: "c0000000-0000-0000-0000-00000000000c",
  general: "c0000000-0000-0000-0000-00000000000d",
  botAlertas: "c0000000-0000-0000-0000-00000000000e",
} as const;

export const TEAM_IDS = {
  comercial: "b0000000-0000-0000-0000-000000000001",
  operaciones: "b0000000-0000-0000-0000-000000000002",
  usa: "b0000000-0000-0000-0000-000000000003",
  academia: "b0000000-0000-0000-0000-000000000004",
  marketing: "b0000000-0000-0000-0000-000000000005",
  administracion: "b0000000-0000-0000-0000-000000000006",
  regenerativo: "b0000000-0000-0000-0000-000000000007",
  direccion: "b0000000-0000-0000-0000-000000000008",
} as const;

export const MAX_UPLOAD_BYTES = 26_214_400;
export const SIGNED_URL_TTL_SECONDS = 60;
export const TOOL_LOOP_CAP = 6;

export const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
] as const;

export const REJECTED_MIME = ["image/svg+xml", "image/svg"] as const;
