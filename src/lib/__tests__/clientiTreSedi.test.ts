import { describe, expect, it } from "vitest";
import {
  PIVA_DOPPIONE_MILANO,
  isNuovoClientePlaceholder,
  isSedeUnitAltraCitta,
  pickKeepersTreSedi,
  resolveTreSediCliente,
} from "@/lib/clientiTreSedi";
import { validateCF } from "@/lib/validateCF";
import { validatePIVA } from "@/lib/validatePIVA";

describe("placeholder e unit", () => {
  it("riconosce _nuovo_cliente", () => {
    expect(isNuovoClientePlaceholder("_nuovo_cliente")).toBe(true);
    expect(isNuovoClientePlaceholder("CASTRONUOVO DONATO")).toBe(false);
  });

  it("Unit di altra città resta segnalata, la sede del file no", () => {
    expect(isSedeUnitAltraCitta("SEDE NAPOLI", "MI")).toBe(true);
    expect(isSedeUnitAltraCitta("SEDE DI MILANO", "MI")).toBe(false);
    expect(isSedeUnitAltraCitta("SEDE BARI", "PZ")).toBe(true);
    expect(isSedeUnitAltraCitta("SEDE POTENZA", "PZ")).toBe(false);
    expect(isSedeUnitAltraCitta("BELLIDO FERNANDA", "PR")).toBe(false);
  });
});

describe("resolveTreSediCliente", () => {
  it("inventa CF per privato senza codice e usa mail sede", () => {
    const r = resolveTreSediCliente(
      { Codice: "010001", Nome: "ROSSI MARIO", "F/G": "F", Stato: "Attivo" },
      "MI",
    );
    expect(r.esito).toBe("da_creare");
    expect(r.tipoCliente).toBe("privato");
    expect(r.cfInventato).toBe(true);
    expect(validateCF(r.codiceFiscale, { allowPIVAFormat: false }).valid).toBe(true);
    expect(r.email).toBe("gestionemilano@consulbrokers.it");
    expect(r.indirizzo).toBe("Da completare");
    expect(r.gruppoFinanziarioKey).toBe("linea_persona");
  });

  it("importa _nuovo_cliente come azienda con P.IVA inventata", () => {
    const r = resolveTreSediCliente(
      { Codice: "014024", Nome: "_nuovo_cliente", "F/G": "G", Stato: "Attivo" },
      "MI",
    );
    expect(r.tipoCliente).toBe("azienda");
    expect(r.ragioneSociale).toBe("Nuovo cliente Milano 014024");
    expect(r.formaGiuridica).toBe("altro");
    expect(r.pivaInventata).toBe(true);
    expect(validatePIVA(r.partitaIva).valid).toBe(true);
    expect(r.gruppoFinanziarioKey).toBe("aziende_private");
  });

  it("salta i non attivi e il doppione Potenza della P.IVA Milano", () => {
    const skipStato = resolveTreSediCliente(
      { Codice: "000024", Nome: "EX CLIENTE", Stato: "Non attivo", "F/G": "G" },
      "PZ",
    );
    expect(skipStato.esito).toBe("saltato");
    expect(skipStato.motivo).toBe("non_attivo_o_escluso");

    const skipDup = resolveTreSediCliente(
      {
        Codice: "008528",
        Nome: "AREA & PARTNERS SRL",
        "F/G": "G",
        PIva: PIVA_DOPPIONE_MILANO,
        Stato: "Attivo",
      },
      "PZ",
    );
    expect(skipDup.esito).toBe("saltato");
    expect(skipDup.motivo).toBe("doppione_piva_milano");
  });

  it("default forma altro e GF ente da tipo", () => {
    const r = resolveTreSediCliente(
      { Codice: "009001", Nome: "COMUNE DI TEST", "F/G": "G", Stato: "Attivo", GruFin: "" },
      "PR",
    );
    expect(r.tipoCliente).toBe("ente");
    expect(r.formaGiuridica).toBe("ente_pubblico");
    expect(r.gruppoFinanziarioKey).toBe("enti_territoriali");
    expect(r.email).toBe("parma@consulbrokers.it");
  });

  it("pickKeepers tiene Milano sul doppione P.IVA e scarta Potenza", () => {
    const mi = resolveTreSediCliente(
      {
        Codice: "014263",
        Nome: "SRIB EUROPA SRL EX AREA & PARTNERS",
        "F/G": "G",
        PIva: PIVA_DOPPIONE_MILANO,
        Stato: "Attivo",
      },
      "MI",
    );
    const pz = resolveTreSediCliente(
      {
        Codice: "008528",
        Nome: "AREA & PARTNERS SRL",
        "F/G": "G",
        PIva: PIVA_DOPPIONE_MILANO,
        Stato: "Attivo",
      },
      "PZ",
    );
    const { keepers, dups } = pickKeepersTreSedi([pz, mi]);
    expect(keepers.map((k) => k.codice)).toEqual(["014263"]);
    expect(dups.some((d) => d.codice === "008528")).toBe(true);
  });
});
