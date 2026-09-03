export type ErrorCode =
  | "not_found"
  | "forbidden"
  | "ambiguous"
  | "validation"
  | "server_error";

export type ToolOk<T> = { ok: true; data: T };
export type ToolErr = {
  ok: false;
  code: ErrorCode;
  detail: string;
  options?: { id: string; label: string }[];
};
export type ToolResult<T> = ToolOk<T> | ToolErr;

export function ok<T>(data: T): ToolOk<T> {
  return { ok: true, data };
}

export function err(
  code: ErrorCode,
  detail: string,
  options?: { id: string; label: string }[],
): ToolErr {
  return options ? { ok: false, code, detail, options } : { ok: false, code, detail };
}

export type ResultCardState = "guardando" | "guardado" | "no_se_guardo";

export function resultCardState(
  status: "pending" | "ok" | "error",
): ResultCardState {
  if (status === "pending") return "guardando";
  if (status === "ok") return "guardado";
  return "no_se_guardo";
}
