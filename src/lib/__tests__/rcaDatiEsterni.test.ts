import { describe, expect, it } from "vitest";
import {
  hasDatiEsterniUtili,
  mergeDatiEsterniNelForm,
  normalizeDatiRcaEsterni,
  riepilogoAttestato,
} from "@/lib/rca/datiEsterni";
import { emptyPreventivoForm, snapshotsFromForm } from "@/lib/rca/preventivi";

describe("dati ANIA / Euroherc", () => {
  it("normalizza attestato e veicolo da payload misti", () => {
    const dati = normalizeDatiRcaEsterni({
      fonte: "Euroherc / ANIA",
      vehicle: { brand: "Fiat", model: "Panda", plate: "ab123cd" },
      insurance: { cu: "1", current_insurance_provider: "Euroherc", atr: { cu_originaria: "4" } },
    });
    expect(dati?.brand).toBe("FIAT");
    expect(dati?.cu).toBe("1");
    expect(dati?.atr?.cu).toBe("1");
    expect(dati?.currentProvider).toBe("Euroherc");
    expect(riepilogoAttestato(dati?.atr, dati?.cu)).toContain("CU 1");
    expect(hasDatiEsterniUtili(dati)).toBe(true);
  });

  it("non sovrascrive i campi CBnet già compilati, ma tiene CU/ATR esterni", () => {
    const base = {
      ...emptyPreventivoForm(),
      brand: "VW",
      currentProvider: "Generali",
      targa: "AB123CD",
    };
    const next = mergeDatiEsterniNelForm(base, {
      fonte: "ANIA",
      interrogatoIl: "2026-09-25T10:00:00Z",
      brand: "FIAT",
      cu: "3",
      atr: { cu: "3", compagnia: "Euroherc" },
      currentProvider: "Euroherc",
    });
    expect(next.brand).toBe("VW");
    expect(next.currentProvider).toBe("Generali");
    expect(next.cu).toBe("3");
    expect(next.atr?.compagnia).toBe("Euroherc");
    expect(next.fonteDati).toBe("ANIA");
  });

  it("ignora payload vuoti", () => {
    expect(normalizeDatiRcaEsterni({})).toBeNull();
    expect(hasDatiEsterniUtili(null)).toBe(false);
  });

  it("persiste CU e attestato nello snapshot preventivo, non in anagrafica", () => {
    const form = mergeDatiEsterniNelForm(
      { ...emptyPreventivoForm(), targa: "AB123CD", name: "MARIO", surname: "ROSSI", cf: "RSSMRA80A01H501U" },
      {
        fonte: "Euroherc / ANIA",
        interrogatoIl: "2026-09-25T10:00:00Z",
        cu: "1",
        atr: { cu: "1", compagnia: "Euroherc", scadenza: "01/12/2026" },
      },
    );
    const snaps = snapshotsFromForm(form);
    expect((snaps.quote_snapshot as { insurance: { cu: string } }).insurance.cu).toBe("1");
    expect((snaps.quote_snapshot as { dati_esterni: { fonte: string } }).dati_esterni.fonte).toBe(
      "Euroherc / ANIA",
    );
    expect((snaps.client_snapshot as { cf: string }).cf).toBe("RSSMRA80A01H501U");
  });
});
