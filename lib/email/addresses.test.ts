import { describe, expect, it } from "vitest";
import { extractEmail, parseAddressList, replyAllCc, replyToAddress } from "./addresses";

describe("parseAddressList", () => {
  it("accepts comma and semicolon lists and name wrappers", () => {
    expect(parseAddressList("Amit <amit@buenavida.cr>, naty@buenavida.cr; Gally <gally@buenavida.cr>")).toEqual({
      ok: true,
      emails: ["amit@buenavida.cr", "naty@buenavida.cr", "gally@buenavida.cr"],
    });
  });

  it("treats empty as no recipients", () => {
    expect(parseAddressList("  ")).toEqual({ ok: true, emails: [] });
  });

  it("rejects a bad token instead of guessing", () => {
    expect(parseAddressList("amit@buenavida.cr, not-an-email")).toEqual({ ok: false });
  });

  it("dedupes", () => {
    expect(parseAddressList("Amit@buenavida.cr, amit@buenavida.cr")).toEqual({
      ok: true,
      emails: ["amit@buenavida.cr"],
    });
  });
});

describe("reply recipients", () => {
  it("replies to the sender on inbound mail", () => {
    expect(
      replyToAddress({
        inbound: true,
        fromAddress: "Marcela <marcela@cafecielo.cr>",
        toAddresses: ["amit@buenavida.cr"],
      }),
    ).toBe("marcela@cafecielo.cr");
  });

  it("puts other To recipients on Cc and skips self and the sender", () => {
    expect(
      replyAllCc({
        fromAddress: "Marcela <marcela@cafecielo.cr>",
        toAddresses: ["amit@buenavida.cr", "naty@buenavida.cr", "Marcela <marcela@cafecielo.cr>"],
        selfEmail: "amit@buenavida.cr",
      }),
    ).toEqual(["naty@buenavida.cr"]);
  });
});

describe("extractEmail", () => {
  it("reads a bare address", () => {
    expect(extractEmail("naty@buenavida.cr")).toBe("naty@buenavida.cr");
  });
});
