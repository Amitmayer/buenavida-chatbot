import { describe, expect, it } from "vitest";
import { canPreviewFile } from "@/lib/files/preview";

describe("canPreviewFile", () => {
  it("allows images and PDFs", () => {
    expect(canPreviewFile("image/jpeg")).toBe(true);
    expect(canPreviewFile("image/png")).toBe(true);
    expect(canPreviewFile("application/pdf")).toBe(true);
  });

  it("rejects SVG and office files", () => {
    expect(canPreviewFile("image/svg+xml")).toBe(false);
    expect(canPreviewFile("application/vnd.ms-excel")).toBe(false);
    expect(canPreviewFile("text/csv")).toBe(false);
  });
});
