import { describe, expect, it } from "vitest";
import { publicOrigin, publicUrl } from "./public-origin";

function req(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

describe("publicOrigin", () => {
  it("uses x-forwarded-host when the process bound 0.0.0.0", () => {
    const origin = publicOrigin(
      req("http://0.0.0.0:8080/auth/signout", {
        "x-forwarded-host": "buenavidaos.com",
        "x-forwarded-proto": "https",
      }),
    );
    expect(origin).toBe("https://buenavidaos.com");
  });

  it("keeps localhost for local development", () => {
    expect(publicOrigin(req("http://localhost:3000/auth/signout"))).toBe("http://localhost:3000");
  });

  it("does not send people to 0.0.0.0", () => {
    const origin = publicOrigin(req("https://0.0.0.0:8080/auth/signout"));
    expect(origin).not.toContain("0.0.0.0");
    expect(publicUrl("/entrar", req("https://0.0.0.0:8080/auth/signout")).href).toBe(
      "https://buenavidaos.com/entrar",
    );
  });
});
