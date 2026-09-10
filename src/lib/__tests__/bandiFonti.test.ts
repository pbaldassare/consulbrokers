import { describe, expect, it } from "vitest";
import {
  filterMondoHits,
  isFonteBando,
  isMondoAppaltiUrl,
  labelFonteBando,
  mapMondoHitToBando,
  regioneFromText,
  schedaIdFromUrl,
} from "@/lib/bandiFonti";

describe("labelFonteBando", () => {
  it("etichetta TED e Mondo Appalti", () => {
    expect(labelFonteBando("ted")).toBe("TED Europa");
    expect(labelFonteBando("mondoappalti")).toBe("Mondo Appalti");
    expect(isFonteBando("mondoappalti")).toBe(true);
    expect(isFonteBando("altro")).toBe(false);
  });
});

describe("mondoappalti url", () => {
  it("accetta solo il dominio Mondo Appalti", () => {
    expect(isMondoAppaltiUrl("https://www.mondoappalti.it/Scheda/12345")).toBe(true);
    expect(isMondoAppaltiUrl("https://ted.europa.eu/it/notice/1")).toBe(false);
  });

  it("estrae l'id numerico dalla scheda", () => {
    expect(schedaIdFromUrl("https://mondoappalti.it/Scheda/128903")).toBe("128903");
  });
});

describe("filterMondoHits / map", () => {
  it("scarta login e duplicati, tiene le schede", () => {
    const hits = filterMondoHits([
      { title: "Login", url: "https://mondoappalti.it/Account/Login", snippet: "" },
      { title: "Broker Comune X", url: "https://mondoappalti.it/Scheda/11111", snippet: "Lombardia" },
      { title: "Broker Comune X 2", url: "https://www.mondoappalti.it/Scheda/11111", snippet: "" },
    ]);
    expect(hits).toHaveLength(1);
    const b = mapMondoHitToBando(hits[0], 0, ["Lombardia", "Lazio"]);
    expect(b.scheda_id).toBe("11111");
    expect(b.regione).toBe("Lombardia");
    expect(b.link).toContain("mondoappalti.it");
  });
});

describe("regioneFromText", () => {
  it("riconosce la regione nel testo", () => {
    expect(regioneFromText("Comune di Bari — Puglia", ["Lazio", "Puglia"])).toBe("Puglia");
    expect(regioneFromText("nessuna", ["Lazio"])).toBeNull();
  });
});
