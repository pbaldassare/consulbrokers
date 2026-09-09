import { describe, expect, it } from "vitest";
import { documentaleTabToQuery, parseDocumentaleTab } from "@/lib/documentaleTab";

describe("parseDocumentaleTab", () => {
  it("mappa tab=cb-bot sul tab interno Cb Bot", () => {
    expect(parseDocumentaleTab("cb-bot", false)).toBe("assistente-garanzie");
    expect(parseDocumentaleTab("assistente-garanzie", false)).toBe("assistente-garanzie");
  });

  it("senza query apre Archivio (admin) o Cb Bot (consultazione)", () => {
    expect(parseDocumentaleTab(null, false)).toBe("archivio");
    expect(parseDocumentaleTab(null, true)).toBe("assistente-garanzie");
  });
});

describe("documentaleTabToQuery", () => {
  it("serializza Cb Bot come tab=cb-bot", () => {
    expect(documentaleTabToQuery("assistente-garanzie", false)).toBe("cb-bot");
  });

  it("omette tab sull'archivio in modalità normale", () => {
    expect(documentaleTabToQuery("archivio", false)).toBeNull();
    expect(documentaleTabToQuery("archivio", true)).toBe("archivio");
  });
});
