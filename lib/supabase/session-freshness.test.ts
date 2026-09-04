import { describe, expect, it } from "vitest";
import { accessTokenExpiresAt, shouldRefreshSession, hasAuthSessionCookie } from "./session-freshness";

function jwt(exp: number): string {
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
  return `header.${payload}.sig`;
}

describe("shouldRefreshSession", () => {
  it("refreshes when no auth cookie is present", () => {
    expect(shouldRefreshSession([], 1_700_000_000)).toBe(true);
  });

  it("skips refresh when expires_at is still well in the future", () => {
    const cookies = [
      {
        name: "sb-abc123-auth-token",
        value: JSON.stringify({ access_token: "x", expires_at: 1_700_000_500 }),
      },
    ];
    expect(shouldRefreshSession(cookies, 1_700_000_000)).toBe(false);
  });

  it("refreshes when the token expires within 90 seconds", () => {
    const cookies = [
      {
        name: "sb-abc123-auth-token",
        value: JSON.stringify({ access_token: "x", expires_at: 1_700_000_060 }),
      },
    ];
    expect(shouldRefreshSession(cookies, 1_700_000_000)).toBe(true);
  });

  it("reads chunked base64 cookies and JWT exp", () => {
    const session = JSON.stringify({ access_token: jwt(1_700_000_400) });
    const encoded = `base64-${Buffer.from(session, "utf8").toString("base64url")}`;
    const mid = Math.ceil(encoded.length / 2);
    const cookies = [
      { name: "sb-abc123-auth-token.1", value: encoded.slice(mid) },
      { name: "sb-abc123-auth-token.0", value: encoded.slice(0, mid) },
    ];
    expect(accessTokenExpiresAt(cookies)).toBe(1_700_000_400);
    expect(shouldRefreshSession(cookies, 1_700_000_000)).toBe(false);
  });

  it("ignores code-verifier cookies", () => {
    const cookies = [
      {
        name: "sb-abc123-auth-token-code-verifier",
        value: JSON.stringify({ expires_at: 1_700_000_500 }),
      },
    ];
    expect(shouldRefreshSession(cookies, 1_700_000_000)).toBe(true);
    expect(hasAuthSessionCookie(cookies)).toBe(false);
  });
});
