import { describe, expect, it } from "vitest";
import {
  displayStatoPolizza,
  isTitoloIncassato,
  messaCassaRowBgClass,
} from "@/lib/polizzeDisplay";

describe("stato incasso nelle tabelle polizze", () => {
  it("mostra l'etichetta Incassata per stato o data di messa a cassa", () => {
    expect(displayStatoPolizza({ stato: "incassato" })).toBe("Incassata");
    expect(displayStatoPolizza({ stato: "attivo", data_messa_cassa: "2026-10-02" })).toBe("Incassata");
    expect(isTitoloIncassato({ data_messa_cassa: "2026-10-02" })).toBe(true);
  });

  it("mantiene lo stato originale per i titoli non incassati", () => {
    expect(displayStatoPolizza({ stato: "sospeso" })).toBe("sospeso");
    expect(isTitoloIncassato({ stato: "attivo" })).toBe(false);
  });

  it("non assegna più colori o hover speciali alla riga incassata", () => {
    expect(messaCassaRowBgClass({ stato: "incassato", data_messa_cassa: "2026-10-02" })).toBe("");
  });
});
