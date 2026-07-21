import { describe, it, expect } from "vitest";
import {
  groupTitoliByPolizza,
  getTotQuietanze,
  getQuietanzaRataIndex,
  tipoLabel,
  isQuietanza,
  isPolizzaMadre,
  canHaveDataCopertura,
  dataCoperturaUltimaQuietanza,
  quietanzaUltimaCopertura,
} from "../quietanze";

const titoli = [
  { id: "m1", numero_titolo: "POL-A", sostituisce_polizza: null, garanzia_da: "2026-01-01" },
  { id: "q1", numero_titolo: "POL-A", sostituisce_polizza: "m1", garanzia_da: "2026-07-01" },
  { id: "q2", numero_titolo: "POL-A", sostituisce_polizza: "m1", garanzia_da: "2027-01-01" },
  { id: "m2", numero_titolo: "POL-B", sostituisce_polizza: null, garanzia_da: "2026-01-15" },
];

describe("getTotQuietanze / getQuietanzaRataIndex", () => {
  const [catenaA] = groupTitoliByPolizza(titoli.filter((t) => t.numero_titolo === "POL-A"));
  const [catenaB] = groupTitoliByPolizza(titoli.filter((t) => t.numero_titolo === "POL-B"));

  it("conta solo le quietanze, esclusa la madre", () => {
    expect(getTotQuietanze(catenaA)).toBe(2);
    expect(getTotQuietanze(catenaB)).toBe(0);
  });

  it("madre → indice 0", () => {
    expect(getQuietanzaRataIndex(catenaA.madre!, catenaA)).toBe(0);
  });

  it("quietanze → indice 1-based su rate.length", () => {
    expect(getQuietanzaRataIndex(catenaA.rate[0], catenaA)).toBe(1);
    expect(getQuietanzaRataIndex(catenaA.rate[1], catenaA)).toBe(2);
  });

  it("tipoLabel: madre = Polizza, singola quietanza = Quietanza", () => {
    const soloMadre = groupTitoliByPolizza([
      { id: "m1", numero_titolo: "POL-C", sostituisce_polizza: null },
      { id: "q1", numero_titolo: "POL-C", sostituisce_polizza: "m1" },
    ])[0];
    expect(tipoLabel(soloMadre.madre!, soloMadre)).toBe("Polizza");
    expect(tipoLabel(soloMadre.rate[0], soloMadre)).toBe("Quietanza");
  });

  it("tipoLabel: più quietanze → Rata N", () => {
    expect(tipoLabel(catenaA.rate[0], catenaA)).toBe("Rata 1");
    expect(tipoLabel(catenaA.rate[1], catenaA)).toBe("Rata 2");
  });
});

describe("copertura polizza madre", () => {
  it("madre non può avere data_copertura; quietanze sì", () => {
    const madre = { id: "m", sostituisce_polizza: null as string | null };
    const q = { id: "q", sostituisce_polizza: "POL-A" };
    expect(isPolizzaMadre(madre)).toBe(true);
    expect(canHaveDataCopertura(madre)).toBe(false);
    expect(canHaveDataCopertura(q)).toBe(true);
  });

  it("dataCoperturaUltimaQuietanza = MAX sulle rate, mai dalla madre", () => {
    const rate = [
      { id: "q1", sostituisce_polizza: "m", data_copertura: "2026-01-10" },
      { id: "q2", sostituisce_polizza: "m", data_copertura: "2026-07-15" },
      { id: "q3", sostituisce_polizza: "m", data_copertura: null },
    ];
    expect(dataCoperturaUltimaQuietanza(rate)).toBe("2026-07-15");
    expect(quietanzaUltimaCopertura(rate)?.id).toBe("q2");
    expect(dataCoperturaUltimaQuietanza([])).toBeNull();
  });
});

describe("isQuietanza — E/C Cliente Dare", () => {
  it("somma solo quietanze, escludendo la polizza madre (no doppio conteggio)", () => {
    const titoli = [
      { id: "m", sostituisce_polizza: null as string | null, premio_lordo: 1222.5, importo_incassato: 0 },
      { id: "q", sostituisce_polizza: "m", premio_lordo: 1222.5, importo_incassato: 0 },
    ];
    const dare = titoli.filter(isQuietanza).reduce((s, t) => s + (Number(t.premio_lordo) || 0), 0);
    const avere = titoli.filter(isQuietanza).reduce((s, t) => s + (Number(t.importo_incassato) || 0), 0);
    expect(dare).toBe(1222.5);
    expect(avere).toBe(0);
    expect(dare - avere).toBe(1222.5);
  });
});
