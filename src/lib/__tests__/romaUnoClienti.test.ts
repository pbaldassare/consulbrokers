import { describe, expect, it } from "vitest";
import { validateCF } from "@/lib/validateCF";
import { validatePIVA } from "@/lib/validatePIVA";
import {
  ROMA_UNO_INDIRIZZO,
  ROMA_UNO_SEDE_EMAIL,
  inventCodiceFiscalePersona,
  inventPartitaIva,
  isRigaNuovoCliente,
  mapGruFin,
  resolveRomaUnoCliente,
} from "@/lib/romaUnoClienti";

describe("inventari fiscali Roma Uno", () => {
  it("genera CF e P.IVA validi e distinti", () => {
    const used = new Set<string>();
    const cf = inventCodiceFiscalePersona("012905", used);
    const piva = inventPartitaIva("012910", used);
    expect(validateCF(cf, { allowPIVAFormat: false }).valid).toBe(true);
    expect(validatePIVA(piva).valid).toBe(true);
    expect(inventCodiceFiscalePersona("012905", used)).not.toBe(cf);
  });
});

describe("resolveRomaUnoCliente", () => {
  it("salta le righe _nuovo_cliente", () => {
    expect(isRigaNuovoCliente({ Nome: "_nuovo_cliente", Codice: "014039" })).toBe(true);
    const hit = resolveRomaUnoCliente({ Codice: "014039", Nome: "_nuovo_cliente" });
    expect(hit.esito).toBe("saltata");
    expect(hit.clienteId).toBeNull();
  });

  it("tiene la mail del file e collega Roma Uno", () => {
    const hit = resolveRomaUnoCliente({
      Codice: "012905",
      Nome: "IDRAULICA F.LLI SALA S.r.l.",
      Indirizzo: "VIA A. NOVELLA, 19",
      Cap: "41033",
      Comune: "CONCORDIA SULLA SECCHIA",
      Prov: "MO",
      Email: "marcello.tampellini@fratellisala.it",
      "F/G": "G",
      CF: "00192240364",
      GruFin: "Aziende Private",
    });
    expect(hit.email).toBe("marcello.tampellini@fratellisala.it");
    expect(hit.emailFallback).toBe(false);
    expect(hit.tipoCliente).toBe("azienda");
    expect(hit.formaGiuridica).toBe("srl");
    expect(hit.partitaIva).toBe("00192240364");
    expect(hit.pivaInventata).toBe(false);
    expect(hit.codiceCliente).toBe("RM1-012905");
    expect(hit.esito).toBe("da_creare");
  });

  it("usa la mail Roma Uno solo se manca, e inventa la P.IVA obbligatoria", () => {
    const hit = resolveRomaUnoCliente({
      Codice: "012910",
      Nome: "NGS S.r.l.",
      Indirizzo: "VIALE EUROPA, 60",
      Cap: 20090,
      Comune: "CUSAGO",
      Prov: "MI",
      Email: "   ",
      "F/G": "G",
      GruFin: "Aziende Private",
    });
    expect(hit.email).toBe(ROMA_UNO_SEDE_EMAIL);
    expect(hit.emailFallback).toBe(true);
    expect(hit.pivaInventata).toBe(true);
    expect(validatePIVA(hit.partitaIva).valid).toBe(true);
  });

  it("inventa il CF obbligatorio per i privati e l'indirizzo sede se manca", () => {
    const hit = resolveRomaUnoCliente({
      Codice: "019999",
      Nome: "ROSSI MARIO",
      "F/G": "F",
      Email: "mario.rossi@example.com",
    });
    expect(hit.tipoCliente).toBe("privato");
    expect(hit.nome).toBe("MARIO");
    expect(hit.cognome).toBe("ROSSI");
    expect(hit.cfInventato).toBe(true);
    expect(validateCF(hit.codiceFiscale, { allowPIVAFormat: false }).valid).toBe(true);
    expect(hit.indirizzo).toBe(ROMA_UNO_INDIRIZZO);
    expect(hit.indirizzoInventato).toBe(true);
    expect(hit.gruppoKey).toBe("linea_persona");
  });

  it("non inventa il CF se è già valido e collega un esistente senza sovrascrivere", () => {
    const hit = resolveRomaUnoCliente(
      {
        Codice: "088001",
        Nome: "SCALA DR MARIA CRISTINA",
        "F/G": "F",
        CF: "SCLMCR59M52C725G",
        Email: "scala@example.com",
        Indirizzo: "VIA SALVINI 2",
      },
      [{ id: "already", codice_fiscale: "SCLMCR59M52C725G", ufficio_id: "altro" }],
    );
    expect(hit.cfInventato).toBe(false);
    expect(hit.esito).toBe("esistente");
    expect(hit.clienteId).toBe("already");
    expect(hit.motivo).toMatch(/senza sovrascrivere/);
  });

  it("mappa ASD e non crea se è _nuovo_cliente", () => {
    expect(mapGruFin("Ass.ne Sportiva Dilettantistica", "azienda")).toBe("asd");
    expect(mapGruFin("Enti Pubblici Territoriali", "azienda")).toBe("enti_territoriali");
  });
});
