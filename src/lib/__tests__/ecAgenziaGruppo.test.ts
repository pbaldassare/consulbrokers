import { describe, expect, it } from "vitest";
import {
  ecAgenziaCodiceProgressivo,
  ecAgenziaGroupKey,
  ecAgenziaProgressivoEntitaId,
  resolveEcAgenziaMandataria,
} from "@/lib/contabilita/ecAgenziaGruppo";

describe("ecAgenziaGruppo", () => {
  const ag = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const rap = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  it("groupKey distingue rapporto e agenzia", () => {
    expect(ecAgenziaGroupKey(ag, rap)).toBe(`rapporto:${rap}`);
    expect(ecAgenziaGroupKey(ag, null)).toBe(`compagnia:${ag}`);
  });

  it("progressivo entità usa rapporto se presente", () => {
    expect(ecAgenziaProgressivoEntitaId(ag, rap)).toBe(rap);
    expect(ecAgenziaProgressivoEntitaId(ag, null)).toBe(ag);
  });

  it("codice progressivo preferisce rapporto e gruppo", () => {
    expect(
      ecAgenziaCodiceProgressivo({ codiceRapporto: "BG0052-M05", codiceCompagnia: "EURO" }),
    ).toBe("BG0052-M05");
    expect(ecAgenziaCodiceProgressivo({ codiceGruppo: "UNI", codiceCompagnia: "EURO" })).toBe("UNI");
  });

  it("mandataria dal gruppo rapporto", () => {
    expect(resolveEcAgenziaMandataria({ gruppi_compagnia: { descrizione: "Unipol" } }, null)).toBe("Unipol");
    expect(resolveEcAgenziaMandataria(null, { gruppo_compagnia: "AXA" })).toBe("AXA");
  });
});
