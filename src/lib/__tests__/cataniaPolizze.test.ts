import { describe, expect, it } from "vitest";
import {
  groupCataniaPolizze,
  mapCataniaAe,
  mapCataniaCompagnia,
  mapCataniaProduttore,
  mapCataniaRamo,
  mapCataniaSpecialist,
  normalizeCataniaNumero,
  type CataniaPolizzaRiga,
} from "@/lib/cataniaPolizze";

function row(partial: Partial<CataniaPolizzaRiga>): CataniaPolizzaRiga {
  return {
    ID: 1,
    CdClie: "017727",
    CdComp: "ETI000",
    Polizza: "413133632.",
    TipoDoc: "PI",
    "Iniz Gar": "07/24/25",
    ...partial,
  };
}

describe("cataniaPolizze", () => {
  it("normalizza il punto finale senza confondere la sequenza PI/PS/PQ", () => {
    const groups = groupCataniaPolizze([
      row({ ID: 1, TipoDoc: "PI", Polizza: "413133632." }),
      row({ ID: 2, TipoDoc: "PS", Polizza: "413133632" }),
      row({ ID: 3, TipoDoc: "PQ", Polizza: "413133632.", "Iniz Gar": "07/24/26" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].numero).toBe("413133632");
    expect(groups[0].madre?.TipoDoc).toBe("PI");
    expect(groups[0].quietanze).toHaveLength(1);
    expect(groups[0].storni).toHaveLength(1);
  });

  it("promuove la prima PQ a polizza senza creare la figlia 1/1", () => {
    const [group] = groupCataniaPolizze([
      row({ TipoDoc: "PQ", Polizza: "LSM0000047212" }),
    ]);
    expect(group.promossaDaPq).toBe(true);
    expect(group.madre?.TipoDoc).toBe("PQ");
    expect(group.quietanze).toHaveLength(0);
  });

  it("esclude le due appendici prive di madre", () => {
    const groups = groupCataniaPolizze([
      row({ TipoDoc: "AM", Polizza: "118917057" }),
      row({ TipoDoc: "AM", Polizza: "118862287" }),
    ]);
    expect(groups.every((group) => group.escluso)).toBe(true);
  });

  it("applica i mapping concordati", () => {
    expect(mapCataniaCompagnia("ASSISA")).toBe("ASSI00");
    expect(mapCataniaCompagnia("ELBA00")).toBe("ELB000");
    expect(mapCataniaRamo("FG1")).toBe("CA");
    expect(mapCataniaProduttore("Aldo Tranquillo/INTERFIDI SRL")).toBe("INTERFIDI SRL");
    expect(mapCataniaAe("SEDE NAPOLI")).toBeNull();
    expect(mapCataniaAe("RONDINELLA SALVATORE")).toBe("RONDINELLA SALVATORE");
    expect(mapCataniaSpecialist("TURCO ALIDA")).toBe("Turco Alida");
    expect(mapCataniaSpecialist("GUARRACINO GAETANO")).toBe("Guarracino Gaetano");
    expect(normalizeCataniaNumero("OX00064498.")).toBe("OX00064498");
  });
});
