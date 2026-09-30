import { describe, expect, it } from "vitest";
import {
  labelTitoloRiferimento,
  pickTitoloRiferimento,
  titoliRiferimentoAppendice,
  type TitoloRiferimentoRow,
} from "@/lib/appendiceTitoloRiferimento";

const polizza: TitoloRiferimentoRow = {
  id: "pol",
  numero_titolo: "5049287LD",
  sostituisce_polizza: null,
  riga: 1,
  garanzia_da: "2026-01-01",
  garanzia_a: "2026-06-30",
  stato: "incassato",
  premio_lordo: 500,
};
const q2: TitoloRiferimentoRow = {
  id: "q2",
  numero_titolo: "5049287LD",
  sostituisce_polizza: "5049287LD",
  riga: 2,
  garanzia_da: "2026-07-01",
  garanzia_a: "2026-12-31",
  stato: "attivo",
  premio_lordo: 500,
};

describe("titoliRiferimentoAppendice", () => {
  it("include la polizza anche senza quietanze (rata unica)", () => {
    expect(titoliRiferimentoAppendice([polizza]).map((t) => t.id)).toEqual(["pol"]);
  });

  it("mette la polizza per prima ed esclude appendici e annullati", () => {
    const rg = { ...q2, id: "rg", is_regolazione: true };
    const annullata = { ...q2, id: "qx", riga: 3, stato: "annullato" };
    expect(titoliRiferimentoAppendice([q2, rg, annullata, polizza]).map((t) => t.id)).toEqual(["pol", "q2"]);
  });
});

describe("pickTitoloRiferimento", () => {
  const list = titoliRiferimentoAppendice([polizza, q2]);

  it("preferisce la quietanza da cui si apre il dialog", () => {
    expect(pickTitoloRiferimento(list, { currentId: "q2", dataRiferimento: "2026-02-01" })).toBe("q2");
  });

  it("aperto dalla polizza usa il titolo che copre la data", () => {
    expect(pickTitoloRiferimento(list, { currentId: "pol", dataRiferimento: "2026-08-15" })).toBe("q2");
    expect(pickTitoloRiferimento(list, { currentId: "pol", dataRiferimento: "2026-03-01" })).toBe("pol");
  });

  it("ricade sulla polizza se nessun periodo copre la data", () => {
    expect(pickTitoloRiferimento(list, { currentId: null, dataRiferimento: "2030-01-01" })).toBe("pol");
    expect(pickTitoloRiferimento([polizza], { currentId: "pol", dataRiferimento: "2030-01-01" })).toBe("pol");
  });

  it("lista vuota → null", () => {
    expect(pickTitoloRiferimento([], { currentId: "pol" })).toBeNull();
  });
});

describe("labelTitoloRiferimento", () => {
  const d = (s: string | null | undefined) => s ?? "-";
  const e = (n: number | null | undefined) => String(n ?? "-");
  it("distingue polizza (rata 1) e quietanza", () => {
    expect(labelTitoloRiferimento(polizza, 0, d, e)).toMatch(/^Polizza \(rata 1\)/);
    expect(labelTitoloRiferimento(q2, 1, d, e)).toMatch(/^Quietanza rata 2/);
  });
});
