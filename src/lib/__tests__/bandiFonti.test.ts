import { describe, expect, it } from "vitest";
import {
  filterMondoHits,
  fontiDaRicerca,
  inferFonteFromLink,
  isEnteBandoGenerico,
  isFonteBando,
  isFonteRicerca,
  isMondoAppaltiUrl,
  isMondoSchedaUrl,
  labelFonteBando,
  labelFonteRicerca,
  mapMondoHitToBando,
  matchesFiltroFonte,
  progressMsgRicerca,
  regioneFromText,
  resolveFonteBando,
  schedaIdFromUrl,
} from "@/lib/bandiFonti";

describe("labelFonteBando", () => {
  it("etichetta TED e Mondo Appalti", () => {
    expect(labelFonteBando("ted")).toBe("TED Europa");
    expect(labelFonteBando("mondoappalti")).toBe("Mondo Appalti");
    expect(labelFonteRicerca("entrambe")).toBe("Entrambe");
    expect(isFonteBando("mondoappalti")).toBe(true);
    expect(isFonteBando("entrambe")).toBe(false);
    expect(isFonteRicerca("entrambe")).toBe(true);
    expect(isFonteBando("altro")).toBe(false);
  });
});

describe("fontiDaRicerca", () => {
  it("interroga entrambe se non specificato o se scelto Entrambe", () => {
    expect(fontiDaRicerca("entrambe")).toEqual(["ted", "mondoappalti"]);
    expect(fontiDaRicerca(undefined)).toEqual(["ted", "mondoappalti"]);
    expect(fontiDaRicerca("ted")).toEqual(["ted"]);
    expect(fontiDaRicerca("mondoappalti")).toEqual(["mondoappalti"]);
  });
});

describe("inferenza e filtro fonte", () => {
  it("riconosce la fonte dal link se manca il campo", () => {
    expect(inferFonteFromLink("https://www.mondoappalti.it/Scheda/128903")).toBe("mondoappalti");
    expect(inferFonteFromLink("https://ted.europa.eu/it/notice/-/detail/397990-2026")).toBe("ted");
    expect(resolveFonteBando(null, "https://mondoappalti.it/Scheda/1")).toBe("mondoappalti");
    expect(resolveFonteBando("ted", "https://mondoappalti.it/Scheda/1")).toBe("ted");
  });

  it("filtra la lista TED / Mondo / Tutte", () => {
    expect(matchesFiltroFonte("ted", "https://ted.europa.eu/x", "tutte")).toBe(true);
    expect(matchesFiltroFonte("ted", "https://ted.europa.eu/x", "ted")).toBe(true);
    expect(matchesFiltroFonte("ted", "https://ted.europa.eu/x", "mondoappalti")).toBe(false);
    expect(matchesFiltroFonte(null, "https://mondoappalti.it/Scheda/9", "mondoappalti")).toBe(true);
  });

  it("messaggio avanzamento senza nomi vendor", () => {
    expect(progressMsgRicerca("entrambe")).toContain("TED");
    expect(progressMsgRicerca("entrambe")).toContain("Mondo Appalti");
    expect(progressMsgRicerca("entrambe")).not.toMatch(/kimi|gemini|tavily|serper/i);
  });
});

describe("mondoappalti url", () => {
  it("accetta solo il dominio Mondo Appalti", () => {
    expect(isMondoAppaltiUrl("https://www.mondoappalti.it/Scheda/12345")).toBe(true);
    expect(isMondoAppaltiUrl("https://ted.europa.eu/it/notice/1")).toBe(false);
  });

  it("tiene solo le schede gara, non le pagine marketing", () => {
    expect(isMondoSchedaUrl("https://mondoappalti.it/bancadati/scheda/14893370")).toBe(true);
    expect(isMondoSchedaUrl("https://mondoappalti.it/Scheda/11111")).toBe(true);
    expect(isMondoSchedaUrl("https://mondoappalti.it/Main/OffertaTecnica")).toBe(false);
    expect(isMondoSchedaUrl("https://mondoappalti.it/Main/Contatti")).toBe(false);
  });

  it("estrae l'id numerico dalla scheda", () => {
    expect(schedaIdFromUrl("https://mondoappalti.it/Scheda/128903")).toBe("128903");
  });
});

describe("filterMondoHits / map", () => {
  it("scarta login e duplicati, tiene le schede e marca la fonte", () => {
    const hits = filterMondoHits([
      { title: "Login", url: "https://mondoappalti.it/Account/Login", snippet: "" },
      { title: "Contatti", url: "https://mondoappalti.it/Main/Contatti", snippet: "" },
      { title: "Broker Comune X", url: "https://mondoappalti.it/Scheda/11111", snippet: "Lombardia" },
      { title: "Broker Comune X 2", url: "https://www.mondoappalti.it/Scheda/11111", snippet: "" },
    ]);
    expect(hits).toHaveLength(1);
    const b = mapMondoHitToBando(hits[0], 0, ["Lombardia", "Lazio"]);
    expect(b.scheda_id).toBe("11111");
    expect(b.regione).toBe("Lombardia");
    expect(b.link).toContain("mondoappalti.it");
    expect(b.fonte).toBe("mondoappalti");
  });
});

describe("regioneFromText", () => {
  it("riconosce la regione nel testo", () => {
    expect(regioneFromText("Comune di Bari — Puglia", ["Lazio", "Puglia"])).toBe("Puglia");
    expect(regioneFromText("nessuna", ["Lazio"])).toBeNull();
  });
});

describe("isEnteBandoGenerico", () => {
  it("non crea prospect da etichette placeholder", () => {
    expect(isEnteBandoGenerico("Scheda Mondo Appalti")).toBe(true);
    expect(isEnteBandoGenerico("Fonte web")).toBe(true);
    expect(isEnteBandoGenerico("Comune di Bari")).toBe(false);
  });
});
