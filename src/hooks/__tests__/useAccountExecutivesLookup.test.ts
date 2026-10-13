import { describe, expect, it } from "vitest";
import { mapSpecialistOptions } from "@/hooks/useAccountExecutivesLookup";

describe("mapSpecialistOptions", () => {
  it("ordina per cognome e usa COGNOME NOME", () => {
    const opts = mapSpecialistOptions([
      { id: "2", nome: "Francesco", cognome: "Paparella", ruolo: "backoffice", ufficio_id: "roma" },
      { id: "1", nome: "Federico", cognome: "Bartocci", ruolo: "backoffice", ufficio_id: "roma" },
    ]);
    expect(opts.map((o) => o.label)).toEqual(["Bartocci Federico", "Paparella Francesco"]);
    expect(opts[0].ufficio_id).toBe("roma");
  });

  it("accetta elenco vuoto", () => {
    expect(mapSpecialistOptions(undefined)).toEqual([]);
  });
});
