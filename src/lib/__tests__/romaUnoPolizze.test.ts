import { describe, expect, it } from "vitest";
import {
  groupRomaUnoRighe,
  isTipoCaricabile,
  lookupProduttoreId,
  normalizeProduttoreKey,
  planRomaUnoPolizze,
  resolveRomaUnoGruppo,
  romaUnoClienteKey,
  type RomaUnoCatalogs,
  type RomaUnoPolizzaRiga,
} from "@/lib/romaUnoPolizze";

const catalogs: RomaUnoCatalogs = {
  clientiByCodice: {
    "017738": "cli-ade",
    "013063": "cli-feder",
    "014034": "cli-vis-ql",
    "013934": "cli-vis-sgs",
  },
  ramiByCodice: {
    DV: { id: "ramo-dv", descrizione: "POLIZZA VIAGGI" },
    NC: { id: "ramo-nc", descrizione: "INFORTUNI CUMULATIVA" },
    MC: { id: "ramo-mc", descrizione: "MALATTIA CUMULATIVA" },
  },
  compagnieByCodice: {
    CHU000: "comp-chubb",
    REA128: "comp-reale",
  },
  produttoriByKey: {
    MUTTIASS: "prod-mutti",
    INTERFIDI: "prod-inter",
    "BALLERINI CURZIO": "prod-ball",
  },
};

function riga(partial: Partial<RomaUnoPolizzaRiga>): RomaUnoPolizzaRiga {
  return {
    ID: 1,
    CdClie: "017738",
    "Nome CLiente": "AGENZIA DELLE ENTRATE",
    CdComp: "CHU000",
    "Nome Compagnia": "Chubb",
    CdRamo: "DV",
    Ramo: "POLIZZA VIAGGI",
    Polizza: "ITBBBO02243",
    TipoTit: "PI",
    TipoDoc: "PI",
    Premio: 1366.13,
    Imponibile: 1313.08,
    Tasse: 53.05,
    Attive: 15.76,
    "Iniz Pol": 45919,
    "Scad Pol": 46284,
    "Iniz Gar": 45919,
    "Scad Gar": 46284,
    "Dt Incasso": 45973,
    Rate: 1,
    Rinnovo: "R",
    "%Riparto": 100,
    "Nome Produttore": "MUTTIASS S.r.l.",
    ...partial,
  };
}

describe("helpers Roma Uno", () => {
  it("accetta solo PI e PQ", () => {
    expect(isTipoCaricabile("PI")).toBe(true);
    expect(isTipoCaricabile("PQ")).toBe(true);
    expect(isTipoCaricabile("AM")).toBe(false);
    expect(isTipoCaricabile("PR")).toBe(false);
  });

  it("normalizza cliente e produttore", () => {
    expect(romaUnoClienteKey(17738)).toBe("017738");
    expect(normalizeProduttoreKey("MUTTIASS S.r.l.")).toBe("MUTTIASS");
    expect(normalizeProduttoreKey("SCARPA MAURO/MUTTIASS S.r.l.")).toBe("SCARPA MAURO");
    expect(lookupProduttoreId("MUTTIASS S.r.l.", catalogs.produttoriByKey)).toBe("prod-mutti");
  });
});

describe("resolveRomaUnoGruppo", () => {
  it("da un PI crea solo la polizza incassabile, senza quietanza clonata", () => {
    const g = resolveRomaUnoGruppo([riga({})], catalogs);
    expect(g.esito).toBe("da_creare");
    expect(g.madre?.tipo).toBe("polizza");
    expect(g.madre?.stato).toBe("incassato");
    expect(g.madre?.dataMessaCassa).toBe("2025-11-12");
    expect(g.madre?.sostituiscePolizza).toBeNull();
    expect(g.madre?.produttoreId).toBe("prod-mutti");
    expect(g.quietanze).toHaveLength(0);
  });

  it("con PI+PQ tiene il PI come madre e le PQ come quietanze", () => {
    const g = resolveRomaUnoGruppo(
      [
        riga({ TipoTit: "PI", TipoDoc: "PI", Premio: 69550, "Dt Incasso": 45973 }),
        riga({
          TipoTit: "PQ",
          TipoDoc: "PQ",
          Premio: 69550,
          "Iniz Gar": 46284,
          "Scad Gar": 46649,
          "Dt Incasso": 46274,
        }),
      ],
      catalogs,
    );
    expect(g.madre?.fileTipoTit).toBe("PI");
    expect(g.madre?.generata).toBe(false);
    expect(g.quietanze).toHaveLength(1);
    expect(g.quietanze[0].sostituiscePolizza).toBe("ITBBBO02243");
    expect(g.quietanze[0].stato).toBe("incassato");
    expect(g.quietanze[0].premioLordo).toBe(69550);
  });

  it("con solo PQ genera la madre a premio 0 e tiene le quietanze", () => {
    const g = resolveRomaUnoGruppo(
      [
        riga({
          TipoTit: "PQ",
          TipoDoc: "PQ",
          CdClie: "013063",
          Polizza: "010306315S",
          CdRamo: "NC",
          Premio: 7729.12,
          "Iniz Gar": 45900,
          "Scad Gar": 45930,
        }),
        riga({
          TipoTit: "PQ",
          TipoDoc: "PQ",
          CdClie: "013063",
          Polizza: "010306315S",
          CdRamo: "NC",
          Premio: 7159.79,
          "Iniz Gar": 45930,
          "Scad Gar": 45961,
        }),
      ],
      catalogs,
    );
    expect(g.madre?.generata).toBe(true);
    expect(g.madre?.premioLordo).toBe(0);
    expect(g.madre?.dataMessaCassa).toBeNull();
    expect(g.madre?.stato).toBe("attivo");
    expect(g.quietanze).toHaveLength(2);
    expect(g.quietanze.every((q) => q.sostituiscePolizza === "010306315S")).toBe(true);
    expect(g.quietanze[0].premioLordo).toBe(7729.12);
  });

  it("non importa AM/PR e spezza 3211620 per cliente", () => {
    const groups = groupRomaUnoRighe([
      riga({ TipoTit: "AM", TipoDoc: "AM", Polizza: "ITDRNC37964" }),
      riga({ TipoTit: "PI", Polizza: "3211620", CdComp: "REA128", CdClie: "014034", CdRamo: "MC" }),
      riga({ TipoTit: "PI", Polizza: "3211620", CdComp: "REA128", CdClie: "013934", CdRamo: "MC" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(resolveRomaUnoGruppo(groups[0], catalogs).numero).toBe("3211620");
    expect(resolveRomaUnoGruppo(groups[1], catalogs).codiceCliente).not.toBe(
      resolveRomaUnoGruppo(groups[0], catalogs).codiceCliente,
    );
  });

  it("salta compagnia o cliente assente", () => {
    expect(resolveRomaUnoGruppo([riga({ CdComp: "ALL108" })], catalogs).motivo).toMatch(/Compagnia non/);
    expect(resolveRomaUnoGruppo([riga({ CdClie: "013275" })], catalogs).motivo).toMatch(/Cliente non/);
  });
});

describe("planRomaUnoPolizze", () => {
  it("conta madri generate e quietanze", () => {
    const plan = planRomaUnoPolizze(
      [
        riga({}),
        riga({ TipoTit: "AM", TipoDoc: "AM" }),
        riga({
          TipoTit: "PQ",
          TipoDoc: "PQ",
          CdClie: "013063",
          Polizza: "010306315S",
          CdRamo: "NC",
        }),
      ],
      catalogs,
    );
    expect(plan.stats.escluseAltriTipi).toBe(1);
    expect(plan.stats.madri).toBe(2);
    expect(plan.stats.madriGenerate).toBe(1);
    expect(plan.stats.quietanze).toBe(1);
  });
});
