import { describe, expect, it } from "vitest";
import { resultCardState } from "./result";

describe("resultCardState", () => {
  it("never derives success from model prose — only from the row status", () => {
    expect(resultCardState("ok")).toBe("guardado");
    expect(resultCardState("error")).toBe("no_se_guardo");
    expect(resultCardState("pending")).toBe("guardando");
  });
});
