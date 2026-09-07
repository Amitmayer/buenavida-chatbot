import { describe, expect, it } from "vitest";
import { buildRfc2822 } from "./gmail";

describe("buildRfc2822", () => {
  it("puts Cc and Bcc on the envelope and encodes a Spanish subject", () => {
    const raw = buildRfc2822({
      from: "amit@buenavida.cr",
      to: ["marcela@cafecielo.cr"],
      cc: ["naty@buenavida.cr"],
      bcc: ["gally@buenavida.cr"],
      subject: "Cotización café",
      body: "Adjunto la ficha.",
    });
    expect(raw).toContain("To: marcela@cafecielo.cr");
    expect(raw).toContain("Cc: naty@buenavida.cr");
    expect(raw).toContain("Bcc: gally@buenavida.cr");
    expect(raw).toContain("Subject: =?UTF-8?B?");
    expect(raw).toContain("Adjunto la ficha.");
    expect(raw).not.toContain("multipart/mixed");
  });

  it("strips header injection from subject and addresses", () => {
    const raw = buildRfc2822({
      from: "amit@buenavida.cr",
      to: ["marcela@cafecielo.cr\r\nBcc: evil@x.com"],
      subject: "Hola\r\nBcc: evil@x.com",
      body: "ok",
    });
    expect(raw).not.toMatch(/Subject:[^\r\n]*\nBcc:/);
    expect(raw).toContain("To: marcela@cafecielo.cr Bcc: evil@x.com");
  });

  it("attaches files as base64 parts without putting bytes in the subject", () => {
    const raw = buildRfc2822({
      from: "amit@buenavida.cr",
      to: ["marcela@cafecielo.cr"],
      subject: "Ficha",
      body: "Ahí va.",
      boundary: "bound1",
      attachments: [
        {
          filename: "ficha.pdf",
          mime: "application/pdf",
          bytes: Buffer.from("PDF"),
        },
      ],
    });
    expect(raw).toContain('Content-Type: multipart/mixed; boundary="bound1"');
    expect(raw).toContain("Content-Disposition: attachment; filename=\"ficha.pdf\"");
    expect(raw).toContain("Content-Transfer-Encoding: base64");
    expect(raw).toContain(Buffer.from("PDF").toString("base64"));
    expect(raw).toContain("--bound1--");
  });
});
