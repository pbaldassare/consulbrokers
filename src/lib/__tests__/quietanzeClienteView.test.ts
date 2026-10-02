import { describe, expect, it } from "vitest";
import {
  countTitoliClienteDaIncassare,
  countQuietanzeDaIncassare,
  countQuietanzeRateDaIncassare,
  isTitoloClienteDaIncassare,
  isQuietanzaDaMostrare,
  titoliClienteDaIncassare,
  quietanzaSogliaGaranziaDa,
  QUIETANZA_SCADENZA_SOGLIA_GIORNI,
} from "@/lib/quietanzeClienteView";

const oggi = new Date();
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const giorniDaOggi = (n: number) => {
  const d = new Date(oggi);
  d.setDate(d.getDate() + n);
  return fmt(d);
};

describe("isQuietanzaDaMostrare", () => {
  it("nasconde quietanza già incassata", () => {
    expect(
      isQuietanzaDaMostrare({
        stato: "incassato",
        data_messa_cassa: "2026-01-01",
        sostituisce_polizza: "x",
        garanzia_da: giorniDaOggi(-10),
      }),
    ).toBe(false);
  });

  it("mostra quietanza arretrata non incassata", () => {
    expect(
      isQuietanzaDaMostrare({
        stato: "attivo",
        data_messa_cassa: null,
        sostituisce_polizza: "x",
        garanzia_da: giorniDaOggi(-30),
      }),
    ).toBe(true);
  });

  it("mostra quietanza con decorrenza entro soglia", () => {
    expect(
      isQuietanzaDaMostrare({
        stato: "attivo",
        data_messa_cassa: null,
        sostituisce_polizza: "x",
        garanzia_da: giorniDaOggi(QUIETANZA_SCADENZA_SOGLIA_GIORNI),
      }),
    ).toBe(true);
  });

  it("nasconde quietanza futura oltre soglia", () => {
    expect(
      isQuietanzaDaMostrare({
        stato: "attivo",
        data_messa_cassa: null,
        sostituisce_polizza: "x",
        garanzia_da: giorniDaOggi(QUIETANZA_SCADENZA_SOGLIA_GIORNI + 1),
      }),
    ).toBe(false);
  });

  it("la polizza (prima rata) non incassata resta nelle Polizze, non nelle Quietanze", () => {
    expect(
      isQuietanzaDaMostrare({
        stato: "attivo",
        data_messa_cassa: null,
        sostituisce_polizza: null,
        garanzia_da: giorniDaOggi(-10),
      }),
    ).toBe(false);
  });

  it("appendice non compare nel tab Quietanze (anche se non incassata)", () => {
    expect(
      isQuietanzaDaMostrare({
        stato: "attivo",
        data_messa_cassa: null,
        is_appendice_modifica: true,
        numero_titolo: "POL/AM1",
        garanzia_da: giorniDaOggi(10),
      }),
    ).toBe(false);
  });

  it("quietanzaSogliaGaranziaDa è oggi + soglia (YYYY-MM-DD)", () => {
    const base = new Date("2026-07-16T12:00:00");
    const expected = new Date(base);
    expected.setHours(23, 59, 59, 999);
    expected.setDate(expected.getDate() + QUIETANZA_SCADENZA_SOGLIA_GIORNI);
    expect(quietanzaSogliaGaranziaDa(base)).toBe(expected.toISOString().slice(0, 10));
  });
});

describe("countQuietanzeDaIncassare", () => {
  it("conta solo le quietanze successive da mostrare, esclude polizza e appendici", () => {
    const titoli = [
      { stato: "attivo", sostituisce_polizza: null as string | null, garanzia_da: giorniDaOggi(-5) },
      { stato: "attivo", sostituisce_polizza: "x", garanzia_da: giorniDaOggi(-5) },
      { stato: "attivo", sostituisce_polizza: "x", garanzia_da: giorniDaOggi(120) },
      { stato: "incassato", data_messa_cassa: "2026-01-01", sostituisce_polizza: "x", garanzia_da: giorniDaOggi(-5) },
      { stato: "attivo", is_appendice_modifica: true, numero_titolo: "P/AM1", garanzia_da: giorniDaOggi(200) },
    ];
    expect(countQuietanzeDaIncassare(titoli)).toBe(1);
    expect(countQuietanzeRateDaIncassare(titoli)).toBe(1);
  });
});

describe("titoliClienteDaIncassare", () => {
  const now = new Date("2026-10-02T12:00:00");
  const madre = {
    id: "pol",
    numero_titolo: "POL-1",
    sostituisce_polizza: null,
    compagnia_id: "comp",
    stato: "attivo",
    data_messa_cassa: null,
    garanzia_da: "2026-10-01",
  };
  const quietanza = {
    ...madre,
    id: "q2",
    sostituisce_polizza: "POL-1",
    garanzia_da: "2026-11-01",
  };

  it("mostra la polizza come prima rata e non anticipa la quietanza successiva", () => {
    expect(titoliClienteDaIncassare([madre, quietanza], now).map((t) => t.id)).toEqual(["pol"]);
  });

  it("dopo l'incasso della polizza mostra la quietanza successiva entro soglia", () => {
    const polizzaIncassata = {
      ...madre,
      stato: "incassato",
      data_messa_cassa: "2026-10-02",
    };
    expect(titoliClienteDaIncassare([polizzaIncassata, quietanza], now).map((t) => t.id)).toEqual(["q2"]);
  });

  it("esclude quietanze incassate, annullate e future oltre soglia", () => {
    expect(isTitoloClienteDaIncassare({ ...quietanza, stato: "incassato", data_messa_cassa: "2026-10-02" }, now)).toBe(false);
    expect(isTitoloClienteDaIncassare({ ...quietanza, stato: "annullato" }, now)).toBe(false);
    expect(isTitoloClienteDaIncassare({ ...quietanza, garanzia_da: "2027-01-01" }, now)).toBe(false);
  });

  it("include garantiti aperti e appendici incassabili", () => {
    const garantito = {
      ...quietanza,
      data_messa_cassa: "2026-10-01",
      data_copertura: "2026-10-01",
      conferimento_gestito: true,
      fondi_ricevuti: false,
      tipo_pagamento: "garantito",
    };
    const appendice = {
      ...madre,
      id: "am",
      numero_titolo: "POL-1/AM1",
      is_appendice_modifica: true,
      garanzia_da: "2027-12-01",
    };
    expect(isTitoloClienteDaIncassare(garantito, now)).toBe(true);
    expect(titoliClienteDaIncassare([garantito, appendice], now).map((t) => t.id).sort()).toEqual(["am", "q2"]);
  });

  it("una polizza unica o temporanea resta un solo titolo incassabile, senza figlia 1/1", () => {
    expect(countTitoliClienteDaIncassare([madre], now)).toBe(1);
  });
});
