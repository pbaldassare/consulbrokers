import { describe, expect, it } from "vitest";
import {
  clienteSearchBlob,
  matchesClienteSearch,
  parseSearchClientiRankedPayload,
  sanitizeClienteSearchTerm,
  toClienteSearchOption,
  type ClienteSearchRow,
} from "../clienteSearch";

const abatangelo: ClienteSearchRow = {
  id: "1",
  cognome: "ABATANGELO",
  nome: "COSIMO DAMIANO",
  tipo_cliente: "privato",
  indirizzo_residenza: "Via Dante 10",
  citta_residenza: "Bari",
  cap_residenza: "70121",
};

const conNominativo: ClienteSearchRow = {
  id: "2",
  ragione_sociale: "ACME SRL",
  tipo_cliente: "azienda",
  indirizzo_sede: "Corso Italia 5",
  citta_sede: "Milano",
  nominativi: [{ nome: "MARCO", cognome: "DE GOBBI" }],
};

describe("clienteSearch", () => {
  it("sanifica caratteri pericolosi PostgREST", () => {
    expect(sanitizeClienteSearchTerm("  varese,(ig) 50% ")).toBe("varese ig 50");
  });

  it("trova clienti con più nomi in qualsiasi ordine", () => {
    expect(matchesClienteSearch(abatangelo, "cosimo damiano")).toBe(true);
    expect(matchesClienteSearch(abatangelo, "damiano abatangelo")).toBe(true);
    expect(matchesClienteSearch(abatangelo, "abatangelo cosimo")).toBe(true);
    expect(matchesClienteSearch(abatangelo, "rossi")).toBe(false);
  });

  it("trova per indirizzo e città", () => {
    expect(matchesClienteSearch(abatangelo, "via dante")).toBe(true);
    expect(matchesClienteSearch(abatangelo, "dante bari")).toBe(true);
    expect(matchesClienteSearch(abatangelo, "70121")).toBe(true);
    expect(matchesClienteSearch(abatangelo, "via verdi")).toBe(false);
  });

  it("trova per nominativo aggiuntivo + indirizzo sede", () => {
    expect(matchesClienteSearch(conNominativo, "de gobbi")).toBe(true);
    expect(matchesClienteSearch(conNominativo, "marco corso italia")).toBe(true);
    expect(clienteSearchBlob(conNominativo)).toContain("de gobbi");
  });

  it("parse payload RPC jsonb", () => {
    expect(parseSearchClientiRankedPayload({ data: [abatangelo], total_count: 1 })).toEqual([abatangelo]);
    expect(parseSearchClientiRankedPayload([abatangelo])).toEqual([abatangelo]);
    expect(parseSearchClientiRankedPayload(null)).toEqual([]);
  });

  it("opzione dropdown include indirizzo nel searchText", () => {
    const opt = toClienteSearchOption(abatangelo);
    expect(opt.label).toBe("ABATANGELO COSIMO DAMIANO");
    expect(opt.description).toContain("Via Dante 10");
    expect(opt.searchText).toContain("via dante 10");
  });
});
