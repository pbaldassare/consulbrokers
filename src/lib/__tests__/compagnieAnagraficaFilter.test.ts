import { describe, expect, it } from "vitest";
import { matchAgenziaRagioneSociale } from "@/lib/compagnieAnagraficaFilter";

describe("matchAgenziaRagioneSociale", () => {
  it("trova per ragione sociale parziale", () => {
    expect(matchAgenziaRagioneSociale({ nome: "ASSIMEDIA SRL" }, "med")).toBe(true);
    expect(matchAgenziaRagioneSociale({ nome: "LINK SRL" }, "assimedia")).toBe(false);
  });

  it("ignora accenti e trova anche per sede/comune", () => {
    expect(matchAgenziaRagioneSociale({ nome: "Società Reale" }, "societa")).toBe(true);
    expect(matchAgenziaRagioneSociale({ nome: "X", nome_sede: "Sede Roma EXE" }, "roma exe")).toBe(true);
    expect(matchAgenziaRagioneSociale({ nome: "X", comune: "Castelfranco Veneto" }, "castelfranco")).toBe(true);
  });
});
