import { describe, expect, it } from "vitest";
import {
  classifyTitoloGestione,
  listSediFile,
  listSediPortafoglio,
} from "@/lib/sediPortafoglioList";

describe("classifyTitoloGestione", () => {
  it("distingue PI stornata da PS di compensazione", () => {
    expect(classifyTitoloGestione({
      numero_titolo: "P1",
      sostituisce_polizza: null,
      stato: "stornato",
      premio_lordo: 100,
    })).toBe("PI");
    expect(classifyTitoloGestione({
      numero_titolo: "P1",
      sostituisce_polizza: "P1",
      premio_lordo: -100,
      note: "Storno gestionale PS su P1 riga 1",
    })).toBe("PS");
  });

  it("non chiama PQ le appendici figlie", () => {
    expect(classifyTitoloGestione({
      sostituisce_polizza: "P1",
      is_appendice_modifica: true,
    })).toBe("AM");
    expect(classifyTitoloGestione({
      sostituisce_polizza: "P1",
      is_regolazione: true,
    })).toBe("PR");
    expect(classifyTitoloGestione({
      sostituisce_polizza: "P1",
      premio_lordo: 80,
    })).toBe("PQ");
    expect(classifyTitoloGestione({})).toBe("altro");
  });
});

describe("listSediFile", () => {
  it("lista anagrafiche e compagnie una sola volta, con alias", () => {
    const list = listSediFile([
      { TipoTit: "PI", CdClie: "006881", "Nome CLiente": "SAN CARLO", CdComp: "REA100", "Nome Compagnia": "REALE", Polizza: "A", Premio: 100, Attive: 10 },
      { TipoTit: "PQ", CdClie: "000909", "Nome CLiente": "AO SAN CARLO", CdComp: "REAPZ0", "Nome Compagnia": "REALE MUTUA", Polizza: "A", Premio: 90, Attive: 8 },
      { TipoTit: "AM", CdClie: "006881", "Nome CLiente": "SAN CARLO", CdComp: "REAASL", Polizza: "A", Premio: 5 },
      { TipoTit: "DP", CdClie: "006881", CdComp: "REA100", Polizza: "A", Attive: -2 },
    ]);
    expect(list.stats.anagrafiche).toBe(1);
    expect(list.anagrafiche[0].codiceCanonico).toBe("000909");
    expect(list.stats.compagnie).toBe(1);
    expect(list.compagnie[0].codiceCanonico).toBe("REAPZ0");
    expect(list.stats.PI).toBe(1);
    expect(list.stats.PQ).toBe(1);
    expect(list.stats.AM).toBe(1);
    expect(list.stats.DP).toBe(1);
    expect(list.stats.lordo).toBe(195);
  });
});

describe("listSediPortafoglio", () => {
  it("lista solo anagrafiche con titoli e non confonde storni", () => {
    const list = listSediPortafoglio({
      sede: "PZ",
      clienti: [
        { id: "c1", codice_ricerca: "000909", ragione_sociale: "SAN CARLO" },
        { id: "c2", codice_ricerca: "Z999", ragione_sociale: "SENZA TITOLI" },
      ],
      compagnie: [
        { id: "comp1", codice: "REAPZ0", nome: "REALE" },
        { id: "comp2", codice: "UNUSED", nome: "NON USATA" },
      ],
      titoli: [
        { id: "pi", numero_titolo: "P1", cliente_anagrafica_id: "c1", compagnia_id: "comp1", sostituisce_polizza: null, stato: "stornato", premio_lordo: 100, provvigioni: 10 },
        { id: "pq", numero_titolo: "P1", cliente_anagrafica_id: "c1", compagnia_id: "comp1", sostituisce_polizza: "P1", stato: "incassato", premio_lordo: 80, provvigioni: 8 },
        { id: "am", numero_titolo: "P1/AM1", cliente_anagrafica_id: "c1", compagnia_id: "comp1", sostituisce_polizza: "P1", is_appendice_modifica: true, premio_lordo: 5 },
        { id: "ps", numero_titolo: "P1", cliente_anagrafica_id: "c1", compagnia_id: "comp1", sostituisce_polizza: "P1", premio_lordo: -100, note: "Storno gestionale PS" },
      ],
    });
    expect(list.stats.PI).toBe(1);
    expect(list.stats.PQ).toBe(1);
    expect(list.stats.AM).toBe(1);
    expect(list.stats.PS).toBe(1);
    expect(list.stats.stornati).toBe(1);
    expect(list.anagrafiche.conPortafoglio).toHaveLength(1);
    expect(list.anagrafiche.conPortafoglio[0].numPolizze).toBe(1);
    expect(list.anagrafiche.senzaPortafoglioCount).toBe(1);
    expect(list.compagnie).toHaveLength(1);
    expect(list.catene).toHaveLength(1);
    expect(list.catene[0].polizza?.id).toBe("pi");
    expect(list.catene[0].quietanze).toHaveLength(1);
    expect(list.catene[0].extra).toHaveLength(2);
  });
});
