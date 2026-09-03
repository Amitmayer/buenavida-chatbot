import { describe, expect, it } from "vitest";
import { daysBetweenYmd, parseDueDate, stripDatePhrase, todayYmd } from "./dates";

function atCr(isoUtc: string): () => Date {
  return () => new Date(isoUtc);
}

describe("parseDueDate", () => {
  it("resolves hoy in Costa Rica, not the server local zone", () => {
    const clock = atCr("2026-03-13T02:00:00.000Z");
    expect(todayYmd(clock)).toBe("2026-03-12");
    expect(parseDueDate("llamar hoy", clock)).toBe("2026-03-12");
  });

  it("resolves mañana at 20:00 Costa Rica", () => {
    const clock = atCr("2026-03-13T02:00:00.000Z");
    expect(parseDueDate("enviar mañana", clock)).toBe("2026-03-13");
  });

  it("resolves el viernes including today when today is Friday", () => {
    const clock = atCr("2026-03-13T18:00:00.000Z");
    expect(parseDueDate("el viernes", clock)).toBe("2026-03-13");
  });

  it("resolves el viernes as the coming Friday", () => {
    const clock = atCr("2026-03-11T18:00:00.000Z");
    expect(parseDueDate("cerrar el viernes", clock)).toBe("2026-03-13");
  });

  it("resolves el 29 as this month when that day is still ahead", () => {
    const clock = atCr("2026-03-10T18:00:00.000Z");
    expect(parseDueDate("el 29", clock)).toBe("2026-03-29");
  });

  it("resolves el 29 as next month when already past", () => {
    const clock = atCr("2026-03-30T18:00:00.000Z");
    expect(parseDueDate("el 29", clock)).toBe("2026-04-29");
  });

  it("resolves la próxima semana as next Monday", () => {
    const clock = atCr("2026-03-11T18:00:00.000Z");
    expect(parseDueDate("la próxima semana", clock)).toBe("2026-03-16");
  });
});

describe("stripDatePhrase", () => {
  it("strips a trailing Friday from a task title", () => {
    expect(stripDatePhrase("llamar a Kracovia el viernes")).toBe(
      "llamar a Kracovia",
    );
  });

  it("strips mañana", () => {
    expect(stripDatePhrase("Enviar guía mañana")).toBe("Enviar guía");
  });

  it("leaves the title alone when there is no date phrase", () => {
    expect(stripDatePhrase("Inventario bodega Heredia")).toBe(
      "Inventario bodega Heredia",
    );
  });
});

describe("daysBetweenYmd", () => {
  it("counts calendar days between two Costa Rica dates", () => {
    expect(daysBetweenYmd("2026-08-28", "2026-09-03")).toBe(6);
    expect(daysBetweenYmd("2026-09-03", "2026-09-03")).toBe(0);
  });
});
