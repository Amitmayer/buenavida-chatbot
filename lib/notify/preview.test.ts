import { describe, expect, it } from "vitest";
import { clipPreview } from "./preview";

describe("clipPreview", () => {
  it("keeps short text", () => {
    expect(clipPreview("Hola")).toBe("Hola");
  });

  it("collapses space and clips long text", () => {
    const text = "Pedido   de café " + "x".repeat(120);
    const out = clipPreview(text, 20);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.startsWith("Pedido de café")).toBe(true);
  });
});
