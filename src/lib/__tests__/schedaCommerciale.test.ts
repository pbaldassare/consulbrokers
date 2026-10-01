import { describe, expect, it } from "vitest";
import {
  buildRipartoCommerciale,
  nomeAnagraficaProf,
  totProvvigioniRata,
} from "../schedaCommerciale";

describe("nomeAnagraficaProf", () => {
  it("preferisce ragione sociale", () => {
    expect(nomeAnagraficaProf({ ragione_sociale: "Rossi Broker", nome: "Mario", cognome: "Rossi" })).toBe(
      "Rossi Broker",
    );
  });
  it("fallback cognome nome", () => {
    expect(nomeAnagraficaProf({ nome: "Mario", cognome: "Rossi" }, "X")).toBe("Rossi Mario");
  });
});

describe("totProvvigioniRata", () => {
  it("usa quietanza se > 0", () => {
    expect(totProvvigioniRata({ provvigioni_firma: 10, provvigioni_quietanza: 20 })).toBe(20);
  });
  it("altrimenti firma", () => {
    expect(totProvvigioniRata({ provvigioni_firma: 10, provvigioni_quietanza: 0 })).toBe(10);
  });
});

describe("buildRipartoCommerciale", () => {
  it("split multiplo + residuo agenzia", () => {
    const r = buildRipartoCommerciale({
      totProvv: 100,
      splits: [
        { nome: "A", perc: 40 },
        { nome: "B", perc: 30 },
      ],
    });
    expect(r.hasProduttore).toBe(true);
    expect(r.righe).toEqual([
      { ruolo: "produttore", nome: "A", perc: 40, importo: 40 },
      { ruolo: "produttore", nome: "B", perc: 30, importo: 30 },
      { ruolo: "agenzia", nome: "Consulbrokers SPA", perc: 30, importo: 30 },
    ]);
  });

  it("un produttore al 100% senza split", () => {
    const r = buildRipartoCommerciale({
      totProvv: 46.58,
      commercialeNome: "Scala Mario",
      percentualeCommerciale: 100,
    });
    expect(r.hasProduttore).toBe(true);
    expect(r.righe[0]).toEqual({ ruolo: "produttore", nome: "Scala Mario", perc: 100, importo: 46.58 });
    expect(r.righe[1].ruolo).toBe("agenzia");
    expect(r.righe[1].perc).toBe(0);
  });

  it("senza produttore tutta l'agenzia", () => {
    const r = buildRipartoCommerciale({ totProvv: 46.58 });
    expect(r.hasProduttore).toBe(false);
    expect(r.righe).toEqual([
      { ruolo: "agenzia", nome: "Consulbrokers SPA", perc: 100, importo: 46.58 },
    ]);
  });
});
