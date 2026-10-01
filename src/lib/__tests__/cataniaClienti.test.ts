import { describe, expect, it } from "vitest";
import { cfCheckChar } from "@/lib/inventFiscalIds";
import { validateCF } from "@/lib/validateCF";
import {
  CATANIA_SEDE_EMAIL,
  CATANIA_UFFICIO_ID,
  completePersonaCf,
  firstEmail,
  interpretCataniaFiscal,
  listProduttori,
  mapProduttoreNome,
  pickKeepersCatania,
  resolveCataniaCliente,
  resolveCataniaEmail,
} from "@/lib/cataniaClienti";

describe("ricostruzione fiscale Catania", () => {
  it("completa il CF a 15 caratteri con il check digit", () => {
    const raw = "VNTVCN55L17B384";
    const done = completePersonaCf(raw);
    expect(done.completed).toBe(true);
    expect(done.value).toHaveLength(16);
    expect(done.value).toBe(raw + cfCheckChar(raw));
    expect(validateCF(done.value, { allowPIVAFormat: false }).valid).toBe(true);
  });

  it("lascia null i CF spazzatura (mail / solo lettere)", () => {
    expect(completePersonaCf("pfailla@cbdigita").value).toBeNull();
    expect(completePersonaCf("SALVATORE PATERN").value).toBeNull();
    expect(completePersonaCf("**Errore**").value).toBeNull();
  });

  it("pad P.IVA a 10 cifre e copia la P.IVA dal CF ente", () => {
    expect(interpretCataniaFiscal("8000887087", null)).toEqual({
      cfPersona: null,
      piva: "08000887087",
      cfAzienda: "08000887087",
      completedCf: false,
      paddedPiva: true,
    });
    expect(interpretCataniaFiscal("01982940833", "")).toMatchObject({
      piva: "01982940833",
      cfAzienda: "01982940833",
      cfPersona: null,
    });
  });

  it("ignora P.IVA con lettere (CF troncato nel campo PIva)", () => {
    expect(interpretCataniaFiscal("VNTVCN55L17B384", "VNTVCN55L1").piva).toBeNull();
    expect(interpretCataniaFiscal("VNTVCN55L17B384", "VNTVCN55L1").cfPersona).toHaveLength(16);
  });
});

describe("email e produttori", () => {
  it("prende la prima mail e mette il fallback sede", () => {
    expect(firstEmail("a@x.it; b@y.it, c@z.it")).toBe("a@x.it");
    expect(resolveCataniaEmail("")).toEqual({ email: CATANIA_SEDE_EMAIL, pec: null });
    expect(resolveCataniaEmail("sindaco@comune.it; info@comune.it").email).toBe("sindaco@comune.it");
    expect(resolveCataniaEmail("comune@pec.it")).toEqual({
      email: CATANIA_SEDE_EMAIL,
      pec: "comune@pec.it",
    });
  });

  it("mappa tutti i produttori noti e deduplica", () => {
    expect(mapProduttoreNome("Consulbrokers Digital Srl")).toBe(
      "0be427e0-3fd4-44b5-a141-5d79596ae731",
    );
    expect(mapProduttoreNome("INTERFIDI SRL")).toBe("cbe0e599-5f2e-4be9-b9d4-8b48347368d3");
    expect(listProduttori({ Prod1: "INTERFIDI SRL", Prod2: "INTERFIDI SRL", Prod3: "" })).toEqual([
      "INTERFIDI SRL",
    ]);
    expect(
      listProduttori({ Prod1: "RONDINELLA SALVATORE", Prod2: "INTERFIDI SRL", Prod3: null }),
    ).toHaveLength(2);
  });
});

describe("resolve Catania", () => {
  it("forza sede Catania e specialist Turco, ignora Excel", () => {
    const r = resolveCataniaCliente({
      Codice: "017824",
      Nome: "SEMINARA YLENIA",
      "F/G": "F",
      CF: "SMNYLN96B57C351",
      Specialist: "Gestione Milano",
      Unit: "SEDE NAPOLI",
      Filiale: "Ufficio di Napoli",
      Prod1: "Consulbrokers Digital Srl",
    });
    expect(r.esito).toBe("da_creare");
    expect(r.specialist).toBe("Turco Alida");
    expect(r.cfRicostruito).toBe(true);
    expect(r.tipoCliente).toBe("privato");
    expect(r.cognome).toBe("SEMINARA");
    expect(r.nome).toBe("YLENIA");
  });

  it("salta il doppione con P.IVA già attiva su altra sede", () => {
    const r = resolveCataniaCliente(
      {
        Codice: "006975",
        Nome: "COMUNE DI SANTA MARINA SALINA",
        "F/G": "G",
        GruFin: "Enti Pubblici Territoriali",
        PIva: "00149690836",
      },
      [
        {
          id: "napoli-1",
          ufficio_id: "f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a",
          partita_iva: "00149690836",
          attivo: true,
        },
      ],
    );
    expect(r.esito).toBe("saltato");
    expect(r.motivo).toBe("piva_gia_attiva_altra_sede");
    expect(r.clienteId).toBe("napoli-1");
    expect(r.tipoCliente).toBe("ente");
  });

  it("crea comunque se lo stesso CF è su un'altra sede", () => {
    const cf = completePersonaCf("RNNFNC78E21B885").value;
    const r = resolveCataniaCliente(
      {
        Codice: "017878",
        Nome: "RANNO FRANCESCO",
        "F/G": "F",
        CF: "RNNFNC78E21B885",
      },
      [
        {
          id: "altro",
          ufficio_id: "f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a",
          codice_fiscale: cf,
          attivo: true,
        },
      ],
    );
    expect(r.esito).toBe("da_creare");
    expect(r.codiceFiscale).toBe(cf);
  });

  it("collega se è già a Catania, senza toccare le altre sedi", () => {
    const r = resolveCataniaCliente(
      { Codice: "018000", Nome: "DEL POPOLO CARMELISA", "F/G": "F", CF: "DLPCML80L56C351" },
      [
        {
          id: "ct-1",
          ufficio_id: CATANIA_UFFICIO_ID,
          codice_ricerca: "018000",
          attivo: true,
        },
      ],
    );
    expect(r.esito).toBe("collegare");
    expect(r.motivo).toBe("gia_in_sede_catania");
  });

  it("non importa due volte la stessa P.IVA nel file", () => {
    const a = resolveCataniaCliente({
      Codice: "013960",
      Nome: "COMUNE DI LICATA",
      "F/G": "G",
      PIva: "00237560842",
    });
    const b = resolveCataniaCliente({
      Codice: "099999",
      Nome: "COMUNE DI LICATA BIS",
      "F/G": "G",
      PIva: "00237560842",
    });
    const { keepers, dups } = pickKeepersCatania([a, b]);
    expect(keepers).toHaveLength(1);
    expect(dups[0].motivo).toMatch(/doppione_file/);
  });
});
