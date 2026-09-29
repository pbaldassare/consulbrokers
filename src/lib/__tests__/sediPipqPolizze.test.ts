import { describe, expect, it } from "vitest";
import {
  buildClienteNameIndex,
  denominazioneKeys,
  mapCompagniaCodiceSede,
  matchClienteByNome,
  planSediPipqPolizze,
  resolveSediPipqGruppo,
  type SediPipqCatalogs,
  type SediPipqRiga,
} from "@/lib/sediPipqPolizze";

const catalogs: SediPipqCatalogs = {
  clientiByCodice: { D00264: "cli-villani" },
  ramiByCodice: {
    LT: { id: "ramo-lt", descrizione: "GLOBALE FABBRICATO" },
    QA: { id: "ramo-qa", descrizione: "R. C. AUTO" },
  },
  compagnieByCodice: {
    VIT104: "comp-vit104",
    IPAL00: "comp-ipal",
    AIG000: "comp-aig",
  },
  produttoriByKey: { "BLANCO ROBERTO": "prod-blanco" },
};

function riga(partial: Partial<SediPipqRiga>): SediPipqRiga {
  return {
    ID: "1",
    CdClie: "D00264",
    "Nome CLiente": "VILLANI ROBERTO",
    CdComp: "IPAL00",
    CdRamo: "LT",
    Ramo: "GLOBALE FABBRICATO",
    Polizza: "BK25LLO09668-LB",
    TipoTit: "PI",
    TipoDoc: "PI",
    Premio: 100,
    Imponibile: 80,
    Tasse: 20,
    Attive: 10,
    Rate: 1,
    "Iniz Pol": "01/01/25",
    "Scad Pol": "01/01/26",
    "Iniz Gar": "01/01/25",
    "Scad Gar": "01/01/26",
    "Dt Incasso": "01/15/25",
    ...partial,
  };
}

describe("sediPipqPolizze", () => {
  it("alias VIT000 → VIT104 e Reale Potenza", () => {
    expect(mapCompagniaCodiceSede("VIT000")).toBe("VIT104");
    expect(mapCompagniaCodiceSede("IPAL00")).toBe("IPAL00");
    expect(mapCompagniaCodiceSede("REA100")).toBe("REAPZ0");
    expect(mapCompagniaCodiceSede("REAASL")).toBe("REAPZ0");
    expect(mapCompagniaCodiceSede("UNIASL")).toBe("FON105");
  });

  it("matcha cliente per nome anche invertito", () => {
    const index = buildClienteNameIndex([
      { id: "c1", ragione: "MASSIMILIANO CORSICO PICCOLINI EMANUELE", nome: "MASSIMILIANO", cognome: "CORSICO PICCOLINI" },
    ]);
    expect(matchClienteByNome("CORSICO PICCOLINI EMANUELE MASSIMILIANO", index)).toBe("c1");
    expect(denominazioneKeys("VILLANI ROBERTO").length).toBeGreaterThan(0);
  });

  it("solo PI: una polizza, nessuna figlia 1/1", () => {
    const g = resolveSediPipqGruppo([riga({ TipoTit: "PI" })], catalogs);
    expect(g.esito).toBe("da_creare");
    expect(g.madre?.tipo).toBe("polizza");
    expect(g.madre?.stato).toBe("incassato");
    expect(g.madre?.premioLordo).toBe(100);
    expect(g.quietanze).toHaveLength(0);
  });

  it("PI+PQ: madre dal PI, quietanza solo dalla PQ", () => {
    const g = resolveSediPipqGruppo(
      [
        riga({ TipoTit: "PI", Premio: 100 }),
        riga({
          TipoTit: "PQ",
          TipoDoc: "PQ",
          Premio: 90,
          "Iniz Gar": "07/01/25",
          "Scad Gar": "01/01/26",
        }),
      ],
      catalogs,
    );
    expect(g.madre?.motivo).toBe("Polizza da PI");
    expect(g.madre?.premioLordo).toBe(100);
    expect(g.quietanze).toHaveLength(1);
    expect(g.quietanze[0].premioLordo).toBe(90);
    expect(g.quietanze[0].sostituiscePolizza).toBe("BK25LLO09668-LB");
  });

  it("solo PQ: la prima diventa polizza, niente madre vuota", () => {
    const g = resolveSediPipqGruppo(
      [
        riga({
          TipoTit: "PQ",
          TipoDoc: "PQ",
          CdComp: "AIG000",
          Premio: 250,
          "Dt Incasso": "03/01/25",
        }),
      ],
      catalogs,
    );
    expect(g.madre?.promossaDaPq).toBe(true);
    expect(g.madre?.premioLordo).toBe(250);
    expect(g.madre?.stato).toBe("incassato");
    expect(g.quietanze).toHaveLength(0);
  });

  it("due PQ senza PI: prima polizza, seconda figlia", () => {
    const g = resolveSediPipqGruppo(
      [
        riga({ TipoTit: "PQ", TipoDoc: "PQ", Premio: 40, "Iniz Gar": "01/01/25" }),
        riga({ TipoTit: "PQ", TipoDoc: "PQ", Premio: 50, "Iniz Gar": "07/01/25", "Scad Gar": "01/01/26" }),
      ],
      catalogs,
    );
    expect(g.madre?.premioLordo).toBe(40);
    expect(g.quietanze).toHaveLength(1);
    expect(g.quietanze[0].premioLordo).toBe(50);
  });

  it("scarta AM/PR e gruppi senza compagnia", () => {
    const plan = planSediPipqPolizze(
      [
        riga({ TipoTit: "AM" }),
        riga({ TipoTit: "PI", CdComp: "REAPZ0" }),
        riga({ TipoTit: "PI" }),
      ],
      catalogs,
    );
    expect(plan.stats.escluseAltriTipi).toBe(1);
    expect(plan.stats.saltati).toBe(1);
    expect(plan.stats.madri).toBe(1);
    expect(plan.daCreare).toHaveLength(1);
  });
});
