import { describe, expect, it } from "vitest";
import {
  matchClienteByNome,
  buildClienteNameIndex,
  matchExistingTitoli,
  pickCorrispondenteStorno,
  planSediExtraPolizze,
  planSediExtraRiga,
  type SediExtraCatalogs,
  type SediExtraExistingTitolo,
  type SediExtraRiga,
} from "@/lib/sediExtraPolizze";

const UFFICIO_MI = "193e0821-4105-4ad6-a72e-0ebb6c116797";
const COMP = "comp-allianz";

function existing(partial: Partial<SediExtraExistingTitolo>): SediExtraExistingTitolo {
  return {
    id: "tit-madre",
    numero_titolo: "1001",
    riga: 1,
    filiale: "MI",
    ufficio_id: UFFICIO_MI,
    compagnia_id: COMP,
    cliente_anagrafica_id: "cli-1",
    premio_lordo: 200,
    stato: "incassato",
    sostituisce_polizza: null,
    garanzia_da: "2025-01-01",
    id_legacy: 10,
    ...partial,
  };
}

const catalogs: SediExtraCatalogs = {
  compagnieByCodice: { ALL101: COMP, VIT104: "comp-vit", ELB000: "comp-elb" },
  ramiByCodice: { RC: { id: "ramo-rc", descrizione: "RCA" } },
  existing: [
    existing({}),
    existing({
      id: "tit-q2",
      riga: 2,
      premio_lordo: 80,
      sostituisce_polizza: "1001",
      id_legacy: 11,
    }),
  ],
  clientiNameIndex: buildClienteNameIndex([
    { id: "cli-orfano", ragione: "COMUNE DI VARESE" },
  ]),
};

function riga(partial: Partial<SediExtraRiga> = {}): SediExtraRiga {
  return {
    ID: "9001",
    CdClie: "D0001",
    "Nome CLiente": "Rossi Mario",
    CdComp: "ALL101",
    CdRamo: "RC",
    Ramo: "RCA",
    Polizza: "1001",
    TipoDoc: "AM",
    Premio: 25,
    Imponibile: 20,
    Tasse: 5,
    Attive: 4,
    "Iniz Pol": "01/01/25",
    "Scad Pol": "01/01/26",
    "Iniz Gar": "01/01/25",
    "Scad Gar": "01/01/26",
    "Dt Incasso": "01/15/25",
    Rate: "1",
    Rinnovo: "R",
    "%Riparto": "100",
    ...partial,
  };
}

describe("matchExistingTitoli", () => {
  it("normalizza il punto finale del numero polizza", () => {
    const found = matchExistingTitoli(catalogs.existing, {
      numero: "1001.",
      compagniaId: COMP,
      ufficioId: UFFICIO_MI,
    });
    expect(found.map((t) => t.id)).toEqual(["tit-madre", "tit-q2"]);
  });
});

describe("pickCorrispondenteStorno", () => {
  it("preferisce la figlia con premio opposto", () => {
    const pick = pickCorrispondenteStorno(catalogs.existing, -80);
    expect(pick?.id).toBe("tit-q2");
  });

  it("se l'importo non coincide prende la figlia", () => {
    const pick = pickCorrispondenteStorno(catalogs.existing, -999);
    expect(pick?.id).toBe("tit-q2");
  });
});

describe("planSediExtraRiga", () => {
  it("salta PI/PQ e compagnie sconosciute", () => {
    const suffix = new Map<string, number>();
    expect(planSediExtraRiga(riga({ TipoDoc: "PI" }), "MI", catalogs, suffix).azione).toBe("skip");
    expect(planSediExtraRiga(riga({ CdComp: "ZZZ999", TipoDoc: "AM" }), "MI", catalogs, suffix).motivo).toMatch(
      /Compagnia non in anagrafica/,
    );
  });

  it("AM crea /AM1 sulla madre esistente, senza clone 1/1", () => {
    const suffix = new Map<string, number>();
    const plan = planSediExtraRiga(riga({ TipoDoc: "AM" }), "MI", catalogs, suffix);
    expect(plan.azione).toBe("insert_am");
    expect(plan.numeroTitolo).toBe("1001/AM1");
    expect(plan.riga).toBe(1);
    expect(plan.isAppendiceModifica).toBe(true);
    expect(plan.isRegolazione).toBe(false);
    expect(plan.sostituiscePolizza).toBe("1001");
    expect(plan.madreId).toBe("tit-madre");
    expect(plan.clienteId).toBe("cli-1");
    expect(plan.premioLordo).toBe(25);
  });

  it("due AM incrementano il suffisso", () => {
    const suffix = new Map<string, number>();
    const a = planSediExtraRiga(riga({ ID: "9001", TipoDoc: "AM" }), "MI", catalogs, suffix);
    const b = planSediExtraRiga(riga({ ID: "9002", TipoDoc: "AM", Premio: 12 }), "MI", catalogs, suffix);
    expect(a.numeroTitolo).toBe("1001/AM1");
    expect(b.numeroTitolo).toBe("1001/AM2");
  });

  it("AP si comporta come modifica /AM", () => {
    const plan = planSediExtraRiga(riga({ TipoDoc: "AP", Polizza: "ELB-1", CdComp: "ELB000" }), "MI", catalogs, new Map());
    expect(plan.azione).toBe("insert_ap");
    expect(plan.numeroTitolo).toBe("ELB-1/AM1");
    expect(plan.isAppendiceModifica).toBe(true);
    expect(plan.madreId).toBeNull();
    expect(plan.note).toMatch(/madre assente/);
  });

  it("PR crea /RG1 con flag regolazione", () => {
    const plan = planSediExtraRiga(riga({ TipoDoc: "PR", Premio: 40 }), "MI", catalogs, new Map());
    expect(plan.azione).toBe("insert_pr");
    expect(plan.numeroTitolo).toBe("1001/RG1");
    expect(plan.isRegolazione).toBe(true);
    expect(plan.isAppendiceModifica).toBe(false);
    expect(plan.madreId).toBe("tit-madre");
  });

  it("PS marca il corrispondente e inserisce la riga negativa sullo stesso numero", () => {
    const plan = planSediExtraRiga(riga({ TipoDoc: "PS", Premio: -80, Imponibile: -70, Tasse: -10 }), "MI", catalogs, new Map());
    expect(plan.azione).toBe("insert_ps");
    expect(plan.numeroTitolo).toBe("1001");
    expect(plan.riga).toBe(3);
    expect(plan.targetId).toBe("tit-q2");
    expect(plan.sostituiscePolizza).toBe("1001");
    expect(plan.premioLordo).toBe(-80);
    expect(plan.isAppendiceModifica).toBe(false);
  });

  it("DP non crea titolo: rettifica le provvigioni della polizza collegata", () => {
    const plan = planSediExtraRiga(riga({ TipoDoc: "DP", Premio: 0, Attive: -10.38 }), "MI", catalogs, new Map());
    expect(plan.azione).toBe("update_dp");
    expect(plan.targetId).toBe("tit-madre");
    expect(plan.provvigioni).toBe(-10.38);
    expect(plan.numeroTitolo).toBe("1001");
  });

  it("DP senza polizza si salta; PS orfano inserisce comunque il negativo", () => {
    const suffix = new Map<string, number>();
    expect(planSediExtraRiga(riga({ TipoDoc: "DP", Polizza: "NOPE" }), "MI", catalogs, suffix).azione).toBe("skip");
    const ps = planSediExtraRiga(riga({ TipoDoc: "PS", Polizza: "NOPE", Premio: -40 }), "MI", catalogs, suffix);
    expect(ps.azione).toBe("insert_ps");
    expect(ps.targetId).toBeNull();
    expect(ps.numeroTitolo).toBe("NOPE");
    expect(ps.premioLordo).toBe(-40);
  });

  it("AM orfana crea comunque l'appendice e prova il match cliente per nome", () => {
    const plan = planSediExtraRiga(
      riga({ TipoDoc: "AM", Polizza: "ORFANA", "Nome CLiente": "Comune di Varese" }),
      "MI",
      catalogs,
      new Map(),
    );
    expect(plan.azione).toBe("insert_am");
    expect(plan.numeroTitolo).toBe("ORFANA/AM1");
    expect(plan.madreId).toBeNull();
    expect(plan.clienteId).toBe("cli-orfano");
    expect(plan.sostituiscePolizza).toBe("ORFANA");
  });

  it("alias VIT000 → VIT104", () => {
    const withVit: SediExtraCatalogs = {
      ...catalogs,
      existing: [existing({ compagnia_id: "comp-vit", numero_titolo: "V1" })],
    };
    const plan = planSediExtraRiga(
      riga({ TipoDoc: "AM", CdComp: "VIT000", Polizza: "V1" }),
      "MI",
      withVit,
      new Map(),
    );
    expect(plan.azione).toBe("insert_am");
    expect(plan.compagniaId).toBe("comp-vit");
  });

  it("non reimporta lo stesso id_legacy", () => {
    const plan = planSediExtraRiga(riga({ ID: "10", TipoDoc: "AM" }), "MI", catalogs, new Map());
    expect(plan.azione).toBe("skip");
    expect(plan.motivo).toMatch(/già importato/);
  });
});

describe("planSediExtraPolizze", () => {
  it("conta per tipo e ignora le altre voci", () => {
    const { stats, pianificati } = planSediExtraPolizze(
      [
        riga({ TipoDoc: "PI" }),
        riga({ ID: "1", TipoDoc: "AM" }),
        riga({ ID: "2", TipoDoc: "PR" }),
        riga({ ID: "3", TipoDoc: "PS", Premio: -80 }),
        riga({ ID: "4", TipoDoc: "DP", Attive: 1 }),
        riga({ ID: "5", TipoDoc: "AP" }),
      ],
      "MI",
      catalogs,
    );
    expect(stats.altre).toBe(1);
    expect(stats.AM).toBe(1);
    expect(stats.PR).toBe(1);
    expect(stats.PS).toBe(1);
    expect(stats.DP).toBe(1);
    expect(stats.AP).toBe(1);
    expect(pianificati.filter((p) => p.azione !== "skip")).toHaveLength(5);
  });
});

describe("matchClienteByNome", () => {
  it("accetta ordine parole diverso", () => {
    const index = buildClienteNameIndex([{ id: "x", ragione: "Rossi Mario Srl" }]);
    expect(matchClienteByNome("MARIO ROSSI SRL", index)).toBe("x");
  });
});
