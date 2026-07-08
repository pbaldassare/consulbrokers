import { describe, expect, it } from "vitest";
import {
  countQuietanzeDaIncassare,
  isQuietanzaDaMostrare,
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

  it("appendice non incassata sempre visibile anche se decorrenza lontana", () => {
    expect(
      isQuietanzaDaMostrare({
        stato: "attivo",
        data_messa_cassa: null,
        is_appendice_modifica: true,
        numero_titolo: "POL/AM1",
        garanzia_da: giorniDaOggi(365),
      }),
    ).toBe(true);
  });
});

describe("countQuietanzeDaIncassare", () => {
  it("conta solo quietanze/appendici da mostrare", () => {
    const n = countQuietanzeDaIncassare([
      { stato: "attivo", sostituisce_polizza: "x", garanzia_da: giorniDaOggi(-5) },
      { stato: "attivo", sostituisce_polizza: "x", garanzia_da: giorniDaOggi(120) },
      { stato: "incassato", data_messa_cassa: "2026-01-01", sostituisce_polizza: "x", garanzia_da: giorniDaOggi(-5) },
      { stato: "attivo", is_appendice_modifica: true, numero_titolo: "P/AM1", garanzia_da: giorniDaOggi(200) },
    ]);
    expect(n).toBe(2);
  });
});
