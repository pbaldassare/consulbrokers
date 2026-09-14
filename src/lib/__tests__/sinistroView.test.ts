import { describe, it, expect } from "vitest";
import {
  isSinistroTerzi,
  isPolizzaTerzi,
  resolvePolizzaNumero,
  resolveGaranzia,
  resolveCompagnia,
} from "@/lib/sinistroView";

const cbnet = {
  sinistro_terzi: false,
  ramo_sinistro: "RC Patrimoniale",
  tipo_sinistro: "rc_patrimoniale",
  titoli: { id: "t1", numero_titolo: "POL-123" },
  compagnie: { nome: "Generali" },
  polizze_terzi: null,
};

const terzi = {
  sinistro_terzi: true,
  ramo_sinistro: null,
  tipo_sinistro: "rct_danni_a_persone_e_cose",
  titoli: null,
  compagnie: null,
  polizze_terzi: {
    numero_polizza: "450287342",
    compagnia_nome: "GENERALI ITALIA S.p.A.",
    garanzia_principale: "RC Terzi",
    contraente: "Comune di Varese",
    broker_riferimento: "Marsh",
  },
};

describe("resolvePolizzaNumero", () => {
  it("usa il titolo CBnet quando presente", () => {
    expect(resolvePolizzaNumero(cbnet)).toBe("POL-123");
  });
  it("usa la polizza terzi quando manca il titolo CBnet", () => {
    expect(resolvePolizzaNumero(terzi)).toBe("450287342");
  });
  it("ritorna null se nessuna polizza", () => {
    expect(resolvePolizzaNumero({})).toBeNull();
  });
});

describe("isPolizzaTerzi", () => {
  it("false per polizza CBnet", () => {
    expect(isPolizzaTerzi(cbnet)).toBe(false);
  });
  it("true per polizza terzi", () => {
    expect(isPolizzaTerzi(terzi)).toBe(true);
  });
});

describe("resolveGaranzia", () => {
  it("preferisce ramo_sinistro CBnet", () => {
    expect(resolveGaranzia(cbnet)).toBe("RC Patrimoniale");
  });
  it("usa la garanzia terzi quando manca il ramo", () => {
    expect(resolveGaranzia(terzi)).toBe("RC Terzi");
  });
  it("ricade sulla label del tipo sinistro dal catalogo", () => {
    expect(resolveGaranzia({ tipo_sinistro: "incendio" })).toBe("Incendio");
  });
  it("stringa vuota se nulla è valorizzato", () => {
    expect(resolveGaranzia({})).toBe("");
  });
});

describe("resolveCompagnia", () => {
  it("usa la compagnia CBnet", () => {
    expect(resolveCompagnia(cbnet)).toBe("Generali");
  });
  it("usa il nome compagnia terzi", () => {
    expect(resolveCompagnia(terzi)).toBe("GENERALI ITALIA S.p.A.");
  });
  it("ritorna null se assente", () => {
    expect(resolveCompagnia({})).toBeNull();
  });
});

describe("isSinistroTerzi", () => {
  it("riflette il flag sinistro_terzi", () => {
    expect(isSinistroTerzi(terzi)).toBe(true);
    expect(isSinistroTerzi(cbnet)).toBe(false);
    expect(isSinistroTerzi(null)).toBe(false);
  });
});
