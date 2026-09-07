import { describe, expect, it } from "vitest";
import { rewriteCidImages, sanitizeEmailHtml, stripHtml } from "./html";

describe("sanitizeEmailHtml", () => {
  it("keeps layout and images, drops scripts and svg", () => {
    const html = sanitizeEmailHtml(`
      <div>
        <script>alert(1)</script>
        <img src="https://cdn.example/logo.png" onerror="alert(1)" alt="Zen">
        <a href="javascript:alert(1)">x</a>
        <a href="https://zen.example/confirm">Confirm</a>
        <svg><script>alert(1)</script></svg>
      </div>
    `);
    expect(html).toContain("https://cdn.example/logo.png");
    expect(html).toContain("https://zen.example/confirm");
    expect(html).not.toContain("script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<svg");
  });

  it("rewrites cid images to data urls", () => {
    const html = rewriteCidImages('<img src="cid:logo@zen">', new Map([["logo@zen", "data:image/png;base64,abc"]]));
    expect(html).toContain("data:image/png;base64,abc");
  });

  it("strips tags for the text fallback", () => {
    expect(stripHtml("<p>Dear Amit</p>")).toBe("Dear Amit");
  });
});
