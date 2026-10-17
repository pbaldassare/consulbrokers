import { describe, expect, it } from "vitest";
import {
  futureQuietanzaWindows,
  isVoucherNumero,
  mapFrazionamentoCb,
  normalizeNumeroPolizza,
  parseExcelDateUs,
  resolveRomaUnoCliente,
  resolveRomaUnoPolizza,
  resolveRomaUnoRamo,
  type RomaUnoCliente,
  type RomaUnoCompagnia,
  type RomaUnoRamo,
} from "@/lib/romaUnoPolizze";

const clienti: RomaUnoCliente[] = [
  { id: "cli-def", codice_cliente: "RM1-012932", ragione_sociale: "DE FABIANI S.r.l." },
  { id: "cli-saga", codice_cliente: "RM1-013132", ragione_sociale: "SAGA S.r.l. a Socio Unico" },
  { id: "cli-longo", codice_cliente: "RM2-17460", ragione_sociale: "LONGO EMANUELE" },
];

const rami: RomaUnoRamo[] = [
  { id: "ramo-pc", codice: "PC", descrizione: "R.C.T./R.C.O", gruppo_descrizione: "R.C.T." },
  { id: "ramo-nc", codice: "NC", descrizione: "INFORTUNI CUMULATIVA", gruppo_descrizione: "INFORTUNI" },
  { id: "ramo-nca", codice: "NCA", descrizione: "INFORTUNI CUMULATIVA", gruppo_descrizione: "INFORTUNI" },
  { id: "ramo-pi", codice: "PI", descrizione: "R. C. AUTOVEICOLI", gruppo_descrizione: "R.C.A.", attivo: false },
];

const compagnie: RomaUnoCompagnia[] = [
  { id: "co-acqui", nome: "AG. GEN. DI ACQUI TERME", tipo: "agenzia" },
  { id: "co-allianz", nome: "ALLIANZ S.p.A.", tipo: "direzione" },
];

describe("date / frazionamento / numero", () => {
  it("parsa le date US del file CB", () => {
    expect(parseExcelDateUs("12/31/10")).toBe("2010-12-31");
    expect(parseExcelDateUs("7/26/20")).toBe("2020-07-26");
    expect(parseExcelDateUs("1/26/27")).toBe("2027-01-26");
  });

  it("mappa Fraz Excel sui frazionamenti CBnet", () => {
    expect(mapFrazionamentoCb("1")).toEqual({ frazionamento: "Annuale", rate: 1 });
    expect(mapFrazionamentoCb("2")).toEqual({ frazionamento: "Semestrale", rate: 2 });
    expect(mapFrazionamentoCb("12")).toEqual({ frazionamento: "Mensile", rate: 12 });
  });

  it("pulisce i numeri e riconosce i voucher", () => {
    expect(normalizeNumeroPolizza("8003004118/S.")).toBe("8003004118/S");
    expect(isVoucherNumero("VOUCHER SCONTO.")).toBe(true);
  });
});

describe("catalogo", () => {
  it("risolve alias clienti VIS/SGS/LONGO", () => {
    expect(resolveRomaUnoCliente("013275", clienti)?.id).toBe("cli-saga");
    expect(resolveRomaUnoCliente("013288", clienti)?.id).toBe("cli-longo");
    expect(resolveRomaUnoCliente("012932", clienti)?.id).toBe("cli-def");
  });

  it("aggancia i rami anche con spazi Excel e preferisce NC", () => {
    expect(resolveRomaUnoRamo("R.C.T.", "R.C.T./R.C.O", rami)?.codice).toBe("PC");
    expect(resolveRomaUnoRamo("R.C.A.", "R. C.  AUTOVEICOLI", rami)?.codice).toBe("PI");
    expect(resolveRomaUnoRamo("INFORTUNI", "INFORTUNI CUMULATIVA", rami)?.codice).toBe("NC");
  });
});

describe("piano titoli", () => {
  it("crea madre + quietanza in corso + futura semestrale", () => {
    const rows = resolveRomaUnoPolizza(
      {
        id: "172062",
        codice: "012932",
        nome: "DE FABIANI S.r.l.",
        polizza: "400000744",
        gruppo: "R.C.T.",
        ramo: "R.C.T./R.C.O",
        compagnia: "GENERALI ITALIA S.p.A. AG. GEN. DI ACQUI TERME",
        premio: "7701",
        provvigioni: "1007.9",
        effetto: "7/26/20",
        scadenza: "7/26/27",
        ultGaranzia: "7/26/26",
        ultScadenza: "1/26/27",
        rinnovo: "Tacito rinnovo",
        fraz: "2",
        delega: "100",
      },
      { clienti, rami, compagnie, produttori: [], duplicateNumbers: new Set() },
    );
    expect(rows).toHaveLength(3);
    expect(rows[0].tipo).toBe("polizza");
    expect(rows[0].sostituiscePolizza).toBeNull();
    expect(rows[0].durataDa).toBe("2020-07-26");
    expect(rows[0].durataA).toBe("2027-07-26");
    expect(rows[0].premioLordo).toBe(7701);
    expect(rows[1].tipo).toBe("quietanza");
    expect(rows[1].garanziaDa).toBe("2026-07-26");
    expect(rows[1].garanziaA).toBe("2027-01-26");
    expect(rows[1].sostituiscePolizza).toBe("400000744");
    expect(rows[2].garanziaDa).toBe("2027-01-26");
    expect(rows[2].garanziaA).toBe("2027-07-26");
    expect(rows.every((r) => r.esito === "da_creare")).toBe(true);
  });

  it("non genera future se la quietanza corrente chiude la polizza", () => {
    expect(futureQuietanzaWindows("2026-12-31", "2026-12-31", "Annuale")).toEqual([]);
  });

  it("suffissa i numeri duplicati VIS e salta i voucher", () => {
    const vis = resolveRomaUnoPolizza(
      {
        id: "1",
        codice: "013934",
        polizza: "3211620",
        gruppo: "INFORTUNI",
        ramo: "INFORTUNI CUMULATIVA",
        compagnia: "ALLIANZ S.p.A.",
        premio: "6070",
        effetto: "12/31/25",
        scadenza: "12/31/26",
        ultGaranzia: "12/31/25",
        ultScadenza: "12/31/26",
        fraz: "1",
        rinnovo: "Tacito rinnovo",
      },
      { clienti, rami, compagnie, produttori: [], duplicateNumbers: new Set(["3211620"]) },
    );
    expect(vis[0].numeroTitolo).toBe("3211620-013934");
    const voucher = resolveRomaUnoPolizza(
      {
        codice: "013079",
        polizza: "VOUCHER SCONTO.",
        gruppo: "R.C.A.",
        ramo: "R. C.  AUTOVEICOLI",
        compagnia: "ALLIANZ S.p.A.",
        effetto: "12/31/25",
        scadenza: "12/31/26",
        ultGaranzia: "12/31/25",
        ultScadenza: "12/31/26",
        fraz: "1",
      },
      { clienti, rami, compagnie, produttori: [], duplicateNumbers: new Set() },
    );
    expect(voucher[0].esito).toBe("saltata");
  });
});
