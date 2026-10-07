import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { calcolaCodiceFiscale, risolviComune, type ComuneCatastale } from "../codiceFiscale";
import { isCFValid } from "../validateCF";

const C = JSON.parse(readFileSync("public/data/comuni-catastali.json", "utf8")) as ComuneCatastale[];

describe("calcolaCodiceFiscale", () => {
  it("esempio di riferimento: Mario Rossi, Roma, 01/01/1980", () => {
    expect(calcolaCodiceFiscale({ nome: "Mario", cognome: "Rossi", sesso: "M", dataNascita: "1980-01-01", codiceCatastale: "H501" }))
      .toBe("RSSMRA80A01H501U");
  });

  it("donna: giorno + 40, carattere di controllo valido", () => {
    const cf = calcolaCodiceFiscale({ nome: "Maria", cognome: "Rossi", sesso: "F", dataNascita: "1985-12-09", codiceCatastale: "F205" });
    expect(cf.slice(0, 15)).toBe("RSSMRA85T49F205");
    expect(isCFValid(cf)).toBe(true);
  });

  it("nome con 4+ consonanti usa la 1ª, 3ª e 4ª; cognomi corti completati con X; accenti e apostrofi ignorati", () => {
    const cf = calcolaCodiceFiscale({ nome: "Gianfranco", cognome: "Fo", sesso: "M", dataNascita: "2001-05-20", codiceCatastale: "A794" });
    expect(cf.slice(0, 6)).toBe("FOXGFR");
    expect(calcolaCodiceFiscale({ nome: "Nicolò", cognome: "D'Amico", sesso: "M", dataNascita: "1990-03-15", codiceCatastale: "H501" }).slice(0, 6))
      .toBe("DMCNCL");
  });
});

describe("risolviComune", () => {
  it("trova il comune per nome, con o senza provincia", () => {
    expect(risolviComune("Roma", C)).toMatchObject({ ok: true, comune: ["Roma", "RM", "H501"] });
    expect(risolviComune("milano (mi)", C)).toMatchObject({ ok: true, comune: ["Milano", "MI", "F205"] });
  });

  it("chiede la provincia per i comuni omonimi e segnala quelli inesistenti", () => {
    expect(risolviComune("Castro", C).ok).toBe(false);
    expect(risolviComune("Castro (LE)", C)).toMatchObject({ ok: true });
    expect(risolviComune("Atlantide", C).ok).toBe(false);
  });
});
