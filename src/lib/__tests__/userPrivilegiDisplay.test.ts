import { describe, expect, it } from "vitest";
import { formatNomeCognome, permissionSummary, sedeAssegnataLabel } from "../userPrivilegiDisplay";

describe("sedeAssegnataLabel", () => {
  it("per l'admin senza sede indica tutte le sedi", () => {
    expect(sedeAssegnataLabel({ ruolo: "admin", uffici: null, profilo_sedi: [] })).toBe("Tutte le sedi");
  });

  it("mostra la sede diretta e quelle extra senza duplicare", () => {
    expect(
      sedeAssegnataLabel({
        ruolo: "ufficio",
        uffici: { nome_ufficio: "Milano" },
        profilo_sedi: [
          { primaria: true, uffici: { nome_ufficio: "Milano" } },
          { primaria: false, uffici: { nome_ufficio: "Roma" } },
        ],
      }),
    ).toBe("Milano, Roma");
  });

  it("segna la primaria solo se non è già la sede diretta", () => {
    expect(
      sedeAssegnataLabel({
        ruolo: "produttore",
        uffici: null,
        profilo_sedi: [{ primaria: true, uffici: { nome_ufficio: "Torino" } }],
      }),
    ).toBe("Torino (primaria)");
  });
});

describe("formatNomeCognome", () => {
  it("mostra sempre nome poi cognome", () => {
    expect(formatNomeCognome({ nome: "Federico", cognome: "Bartozzi" })).toBe("Federico Bartozzi");
    expect(formatNomeCognome({ nome: "Tina", cognome: "Bonito" })).toBe("Tina Bonito");
  });

  it("omite le parti vuote e non inverte le etichette sede", () => {
    expect(formatNomeCognome({ nome: "Bergamo Sede", cognome: "" })).toBe("Bergamo Sede");
    expect(formatNomeCognome({ nome: "CATANIA Sede", cognome: null })).toBe("CATANIA Sede");
    expect(formatNomeCognome({ nome: "  Federico  ", cognome: "  " })).toBe("Federico");
    expect(formatNomeCognome({ nome: "", cognome: "Bonito" })).toBe("Bonito");
    expect(formatNomeCognome(null)).toBe("");
  });
});

describe("permissionSummary", () => {
  it("l'admin ha accesso totale anche senza permessi_json", () => {
    expect(permissionSummary({ ruolo: "admin", permessi_json: null })).toBe("Accesso totale");
  });

  it("elenca i permessi attivi", () => {
    expect(
      permissionSummary({
        ruolo: "produttore",
        permessi_json: { titoli: true, sinistri: false },
      }),
    ).toBe("Polizze (lettura/scrittura)");
  });

  it("segnala l'assenza di permessi espliciti", () => {
    expect(permissionSummary({ ruolo: "ufficio", permessi_json: null })).toBe("Nessun permesso attivo");
  });
});
