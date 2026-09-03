import { describe, expect, it } from "vitest";
import { sanitizeTitle } from "./titles";

describe("sanitizeTitle", () => {
  it("strips trailing date phrases before insert", () => {
    expect(sanitizeTitle("llamar a Kracovia el viernes").title).toBe(
      "llamar a Kracovia",
    );
  });

  it("strips a trailing priority word", () => {
    const result = sanitizeTitle("llamar al proveedor de empaque, viernes, alta");
    expect(result.title).toBe("llamar al proveedor de empaque");
    expect(result.priorityHint).toBe("high");
  });
});
