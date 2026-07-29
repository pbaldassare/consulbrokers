import { describe, it, expect } from "vitest";
import { scoreClienteSearch } from "../scoreClienteSearch";

describe("scoreClienteSearch", () => {
  it("priorità città esatta su match nome parziale", () => {
    const citta = scoreClienteSearch(
      { cognome: "Biolcati", nome: "Mario", citta_residenza: "ADRIA" },
      "adria",
    );
    const nomeParziale = scoreClienteSearch(
      { cognome: "Adriano", nome: "Luca", citta_residenza: "Milano" },
      "adria",
    );
    expect(citta).toBe(1);
    expect(nomeParziale).toBe(3);
    expect(citta).toBeLessThan(nomeParziale);
  });

  it("match esatto anagrafica meglio di contains", () => {
    expect(scoreClienteSearch({ ragione_sociale: "ADRIA" }, "adria")).toBe(2);
    expect(scoreClienteSearch({ ragione_sociale: "Società Adriatica" }, "adria")).toBe(4);
  });

  it("match solo altri campi = score 5", () => {
    expect(
      scoreClienteSearch(
        { cognome: "Rossi", nome: "Mario", citta_residenza: "Roma" },
        "adria",
      ),
    ).toBe(5);
  });
});
