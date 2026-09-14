import { describe, it, expect } from "vitest";
import {
  parseDataSinistroUS,
  mapGaranziaToTipoSinistro,
  normalizzaCompagnia,
  isComuneVarese,
  buildSinistroTerziPayload,
  type VareseSinistroRow,
} from "@/lib/sinistriTerziMapping";

const COMUNE_ID = "11111111-1111-1111-1111-111111111111";

describe("parseDataSinistroUS", () => {
  it("converte M/D/YY US in ISO", () => {
    expect(parseDataSinistroUS("11/14/22")).toBe("2022-11-14");
    expect(parseDataSinistroUS("2/23/23")).toBe("2023-02-23");
    expect(parseDataSinistroUS("3/1/22")).toBe("2022-03-01");
  });
  it("gestisce anni a 4 cifre e ISO gia' formattato", () => {
    expect(parseDataSinistroUS("5/3/2019")).toBe("2019-05-03");
    expect(parseDataSinistroUS("2022-11-14")).toBe("2022-11-14");
  });
  it("ritorna undefined su input non valido", () => {
    expect(parseDataSinistroUS("")).toBeUndefined();
    expect(parseDataSinistroUS("n/d")).toBeUndefined();
    expect(parseDataSinistroUS("13/40/22")).toBeUndefined();
  });
});

describe("mapGaranziaToTipoSinistro", () => {
  it("mappa i match diretti sul catalogo", () => {
    expect(mapGaranziaToTipoSinistro("RC Patrimoniale")).toEqual({ tipo_sinistro: "rc_patrimoniale" });
    expect(mapGaranziaToTipoSinistro("Incendio (Property)")).toEqual({ tipo_sinistro: "incendio" });
    expect(mapGaranziaToTipoSinistro("Spese Legali")).toEqual({ tipo_sinistro: "difesa_legale" });
  });
  it("usa il personalizzato per le garanzie senza match", () => {
    expect(mapGaranziaToTipoSinistro("All Risks")).toEqual({
      tipo_sinistro_personalizzato: "All Risks",
    });
    expect(mapGaranziaToTipoSinistro("Ricerca Guasto")).toEqual({
      tipo_sinistro_personalizzato: "Ricerca Guasto",
    });
  });
});

describe("normalizzaCompagnia", () => {
  it("consolida le varianti Unipol", () => {
    expect(normalizzaCompagnia("Unipol Assicurazioni SpA")).toBe("Unipol Assicurazioni S.p.A.");
    expect(normalizzaCompagnia("Unipol Assicurazioni S.p.A.")).toBe("Unipol Assicurazioni S.p.A.");
    expect(normalizzaCompagnia("UnipolSai Assicurazioni SpA")).toBe("UnipolSai Assicurazioni S.p.A.");
  });
  it("lascia invariate le altre compagnie", () => {
    expect(normalizzaCompagnia("GENERALI ITALIA S.p.A.")).toBe("GENERALI ITALIA S.p.A.");
  });
});

describe("isComuneVarese", () => {
  it("riconosce l'assicurato Comune di Varese", () => {
    expect(isComuneVarese("Comune di Varese")).toBe(true);
    expect(isComuneVarese("  comune di varese ")).toBe(true);
    expect(isComuneVarese("Conti Guerrino")).toBe(false);
  });
});

describe("buildSinistroTerziPayload", () => {
  const base: VareseSinistroRow = {
    nSinistroMarsh: "23PRO0338089",
    dataSinistro: "11/14/22",
    reclamanteAssicurato: "Comune di Varese",
    nSinistroCompagnia: "2022NC861500 531",
    nPolizza: "111742243",
    garanziaPrincipale: "All Risks",
    compagniaDelegataria: "GROUPAMA ASSICURAZIONI S.p.A.",
  };

  it("collega sempre al Comune di Varese come sinistro terzi con polizza terzi", () => {
    const p = buildSinistroTerziPayload(base, { comuneVareseClienteId: COMUNE_ID });
    expect(p.azione).toBe("crea");
    expect(p.sinistro_terzi).toBe(true);
    expect(p.stato_iniziale).toBe("aperto");
    expect(p.cliente_anagrafica_id).toBe(COMUNE_ID);
    expect(p.data_evento).toBe("2022-11-14");
    expect(p.numero_sinistro_compagnia).toBe("2022NC861500 531");
    expect(p.tipo_sinistro_personalizzato).toBe("All Risks");
    expect(p.polizza_terzi.numero_polizza).toBe("111742243");
    expect(p.polizza_terzi.contraente).toBe("Comune di Varese");
    expect(p.polizza_terzi.broker_riferimento).toBe("Marsh");
    expect(p.polizza_terzi.compagnia_nome).toBe("GROUPAMA ASSICURAZIONI S.p.A.");
    // Reclamante = assicurato -> nessuna controparte
    expect(p.controparte).toBeUndefined();
    expect(p.descrizione.length).toBeGreaterThanOrEqual(20);
  });

  it("valorizza controparte quando il reclamante e' un terzo (garanzia RC)", () => {
    const row: VareseSinistroRow = {
      ...base,
      reclamanteAssicurato: "Conti Guerrino",
      garanziaPrincipale: "RC Terzi",
      compagniaDelegataria: "GENERALI ITALIA S.p.A.",
    };
    const p = buildSinistroTerziPayload(row, { comuneVareseClienteId: COMUNE_ID });
    expect(p.tipo_sinistro).toBe("rct_danni_a_persone_e_cose");
    expect(p.controparte).toBe("Conti Guerrino");
    expect(p.cliente_anagrafica_id).toBe(COMUNE_ID);
  });
});
