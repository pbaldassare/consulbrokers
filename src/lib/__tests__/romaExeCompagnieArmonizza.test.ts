import { describe, expect, it } from "vitest";
import {
  cleanAggiuntiva,
  codiceRapportoExe,
  matchControparte,
  parseTipoMandato,
  preferGruppo,
  resolveRomaExeMandato,
  buildDirezioneByBrand,
  rapportoInsertMode,
  sanitizeExeTelefono,
} from "@/lib/romaExeCompagnieArmonizza";

const catalogo = [
  { id: "all-dir", nome: "allianz direzione", codice: "ALL123", tipo: "direzione", gruppo_compagnia_id: "g-all" },
  { id: "bena", nome: "BENACQUISTA ASSICURAZIONI SRL", codice: "B0616", tipo: "plurimandataria" },
  { id: "sd", nome: "GENERALI ITALIA S.P.A. - AG. SAN DONA' DI PIAVE", codice: "B0007", tipo: "agenzia" },
  { id: "gen-rm2", nome: "GENERALI ITALIA SPA", codice: "RM20316", tipo: "direzione", gruppo_compagnia_id: "g-gen" },
];

const gruppi = [
  { id: "g-gen", descrizione: "GENERALI ITALIA" },
  { id: "g-all", descrizione: "ALLIANZ" },
  { id: "g-uni-old", descrizione: "UNIPOLSAI" },
  { id: "g-uni", descrizione: "Unipol Assicurazioni S.p.a." },
];

describe("parse excel mandato", () => {
  it("legge Direzione / pluri / broker", () => {
    expect(parseTipoMandato("Direzione")).toBe("direzione");
    expect(parseTipoMandato(" pluri")).toBe("pluri");
    expect(parseTipoMandato("broker")).toBe("broker");
    expect(cleanAggiuntiva("Direzione")).toBeNull();
    expect(cleanAggiuntiva("Ragione Sociale Aggiuntiva")).toBeNull();
    expect(cleanAggiuntiva("ACQUAVIVA ASSICURAZIONI SRL")).toBe("ACQUAVIVA ASSICURAZIONI SRL");
    expect(codiceRapportoExe("664")).toBe("EXE0664");
  });
});

describe("controparte", () => {
  it("riusa Benacquista già in catalogo", () => {
    const hit = matchControparte("BENACQUISTA ASS.NI SRL", catalogo, "plurimandataria");
    expect(hit.esito).toBe("esistente");
    expect(hit.id).toBe("bena");
  });

  it("non prende l'agenzia San Donà come controparte Roma", () => {
    const hit = matchControparte("ACQUAVIVA ASSICURAZIONI SRL", catalogo, "plurimandataria");
    expect(hit.esito).toBe("da_creare");
    expect(hit.nome).toBe("ACQUAVIVA ASSICURAZIONI SRL");
  });

  it("unisce TUTELA ASSICURA e TUTELASSICURA", () => {
    const hit = matchControparte("TUTELA ASSICURA SAS", [
      ...catalogo,
      { id: "tutela-sas", nome: "TUTELASSICURA SAS", codice: "EXA0088", tipo: "plurimandataria" },
    ], "plurimandataria");
    expect(hit.esito).toBe("esistente");
    expect(hit.id).toBe("tutela-sas");
  });
});

describe("gruppo preferito", () => {
  it("Unipol va sul gruppo attivo, non UNIPOLSAI", () => {
    expect(preferGruppo("UNIPOL ASS.NI SPA", gruppi)?.id).toBe("g-uni");
  });

  it("Europ / Tutela / Berkshire / Global usano il gruppo CBnet esistente", () => {
    const extra = [
      ...gruppi,
      { id: "g-europ", descrizione: "EUROP ASSISTANCE ITALIA" },
      { id: "g-tutela", descrizione: "Tutela Legale Spa" },
      { id: "g-berk", descrizione: "Berkshire Hathaway International Insurance Limite" },
      { id: "g-glob", descrizione: "GLOBAL ASSISTANCE" },
    ];
    expect(preferGruppo("EUROP ASSISTANCE ITALIA SPA", extra)?.id).toBe("g-europ");
    expect(preferGruppo("TUTELA LEGALE SPA", extra)?.id).toBe("g-tutela");
    expect(preferGruppo("BERKSHIRE HATHAWAY", extra)?.id).toBe("g-berk");
    expect(preferGruppo("GLOBAL ASSISTANCE - ENTI PUBBLICI", extra)?.id).toBe("g-glob");
  });
});

describe("resolve mandato", () => {
  const direzioneByBrand = buildDirezioneByBrand(catalogo, [
    { exe_nome: "GENERALI ASS.NI", compagnia_id: "gen-rm2" },
    { exe_nome: "ALLIANZ SPA", compagnia_id: "all-dir" },
  ]);

  it("Direzione Allianz riusa ALL123", () => {
    const hit = resolveRomaExeMandato(
      { exeCodice: "527", brandNome: "ALLIANZ SPA", aggiuntiva: null, tipoMandato: "direzione" },
      { catalogo, gruppi, direzioneByBrand },
    );
    expect(hit.skip).toBe(false);
    expect(hit.controparte?.id).toBe("all-dir");
    expect(hit.tipoRapporto).toBe("Direzione");
  });

  it("pluri Generali crea Acquaviva sul gruppo Generali", () => {
    const hit = resolveRomaExeMandato(
      {
        exeCodice: "664",
        brandNome: "GENERALI ASS.NI",
        aggiuntiva: "ACQUAVIVA ASSICURAZIONI SRL",
        tipoMandato: "pluri",
      },
      { catalogo, gruppi, direzioneByBrand },
    );
    expect(hit.skip).toBe(false);
    expect(hit.gruppoId).toBe("g-gen");
    expect(hit.direzioneId).toBe("gen-rm2");
    expect(hit.controparte?.esito).toBe("da_creare");
    expect(hit.tipoRapporto).toBe("Agenzia");
    expect(hit.codiceRapporto).toBe("EXE0664");
  });
});

describe("rapporto vs trigger self-ref", () => {
  it("Direzione sullo stesso gruppo riusa il principale", () => {
    expect(
      rapportoInsertMode({
        compagniaGruppoId: "g-uni",
        rapportoGruppoId: "g-uni",
        principaleId: "rap-1",
      }),
    ).toBe("reuse_principale");
  });

  it("Direzione senza principale lo crea 1:1", () => {
    expect(
      rapportoInsertMode({
        compagniaGruppoId: "g-cat",
        rapportoGruppoId: "g-cat",
        principaleId: null,
      }),
    ).toBe("insert_principale");
  });

  it("Agenzia/broker con gruppo diverso (o nullo) è N:N", () => {
    expect(
      rapportoInsertMode({
        compagniaGruppoId: null,
        rapportoGruppoId: "g-gen",
        principaleId: null,
      }),
    ).toBe("insert_nn");
    expect(sanitizeExeTelefono("ITALIA")).toBeNull();
    expect(sanitizeExeTelefono("06.46665596")).toBe("06.46665596");
  });
});
