/**
 * Import anagrafiche gestionale Milano / Parma / Potenza → clienti CBnet.
 *
 * Decisioni chiuse (2026-09-28):
 * - CF / P.IVA mancanti: si inventano (formato + checksum validi).
 * - `_nuovo_cliente`: si importa come azienda, ragione "Nuovo cliente {Sede} {codice}", P.IVA inventata.
 * - Specialist: Milano = profilo sede, Parma = Chiara Lurdo, Potenza = utente sede da creare.
 * - Non attivi: esclusi.
 * - Doppione P.IVA 03630431215: una sola anagrafica a Milano (si salta Potenza 008528).
 * - Unit di altre città: restano sulla sede del file (come Campobasso).
 * - Forma giuridica non deducibile → `altro`.
 * - GruFin vuoto → dal tipo (Linea Persona / Aziende Private / Enti Territoriali).
 * - Email mancante → mail sede (Parma/Potenza aggiornate; Milano già gestionemilano@…).
 */
import {
  CAMPOBASSO_SKIP_CODICI,
  interpretCodiceFiscale,
  isDummyTaxId,
  normalizeTaxId,
  padPartitaIva,
  resolveCampobassoCliente,
  trimTxt,
  type CampobassoRiga,
  type CampobassoRisolto,
  type CatalogoClienteCBnet,
} from "@/lib/campobassoClienti";
import { COMUNE_CATASTALE, inventCodiceFiscale, inventPartitaIva } from "@/lib/inventFiscalIds";
import { inferFormaGiuridica, splitNomeCognome } from "@/lib/romaExeClienti";
import { validateCF } from "@/lib/validateCF";
import { validatePIVA } from "@/lib/validatePIVA";

export type TreSediKey = "MI" | "PR" | "PZ";

export const TRE_SEDI = {
  MI: {
    key: "MI" as const,
    label: "Milano",
    ufficioId: "193e0821-4105-4ad6-a72e-0ebb6c116797",
    email: "gestionemilano@consulbrokers.it",
    filiale: "SEDE MILANO",
    specialistProfiloId: "1de5dd91-2f4e-47eb-9b28-5b19de57ef1f",
    specialistContatto: "Sede Milano",
  },
  PR: {
    key: "PR" as const,
    label: "Parma",
    ufficioId: "a0d09b81-777d-43be-9615-e9d051786e2c",
    email: "parma@consulbrokers.it",
    filiale: "Ufficio di Parma",
    specialistProfiloId: "e7c99ebd-66da-4376-aa01-0b4d37e3c5b9",
    specialistContatto: "Chiara Lurdo",
  },
  PZ: {
    key: "PZ" as const,
    label: "Potenza",
    ufficioId: "e4f0d1f5-e344-4920-b178-d8754904a108",
    email: "potenza@consulbrokers.it",
    filiale: "Ufficio di Potenza",
    specialistProfiloId: "0386b979-4d7b-47cd-99dd-340b0dc0d0b7",
    specialistContatto: "Sede Potenza",
  },
} as const;

/** Potenza AREA & PARTNERS: stessa P.IVA di Milano SRIB EUROPA — resta solo Milano. */
export const SKIP_CODICI_TRE_SEDI: Record<TreSediKey, Set<string>> = {
  MI: new Set(),
  PR: new Set(),
  PZ: new Set(["008528"]),
};

export const PIVA_DOPPIONE_MILANO = "03630431215";

export type TreSediRisolto = CampobassoRisolto & {
  sede: TreSediKey;
  ufficioId: string;
  sedeEmail: string;
  note: string | null;
  cfInventato: boolean;
  pivaInventata: boolean;
  indirizzoPlaceholder: boolean;
};

export function isNuovoClientePlaceholder(nome: string | null | undefined): boolean {
  return trimTxt(nome).replace(/\s+/g, "_").toLowerCase() === "_nuovo_cliente";
}

export function isSedeUnitAltraCitta(unit: string | null | undefined, sede: TreSediKey): boolean {
  const u = trimTxt(unit).toUpperCase();
  if (!u) return false;
  if (!/\b(SEDE|UFFICIO)\b/.test(u) && u !== "UFFICIO CAUZIONI") return false;
  if (sede === "MI" && (u.includes("MILANO") || u.includes("CAUZIONI"))) return false;
  if (sede === "PR" && (u.includes("PARMA") || u.includes("CAUZIONI"))) return false;
  if (sede === "PZ" && (u.includes("POTENZA") || u.includes("BASILICATA") || u.includes("CAUZIONI"))) {
    return false;
  }
  return /\b(SEDE|UFFICIO)\b/.test(u);
}

function noteJoin(parts: string[]): string | null {
  const clean = parts.map((p) => p.trim()).filter(Boolean);
  return clean.length ? clean.join(" | ") : null;
}

export function resolveTreSediCliente(
  riga: CampobassoRiga,
  sede: TreSediKey,
  catalogo: CatalogoClienteCBnet[] = [],
  takenTax: Set<string> = new Set(),
): TreSediRisolto {
  const cfg = TRE_SEDI[sede];
  const codice = trimTxt(riga.Codice);
  const nomeRaw = trimTxt(riga.Nome);
  const stato = trimTxt(riga.Stato).toUpperCase();
  const base = resolveCampobassoCliente(riga, catalogo, {
    sedeEmail: cfg.email,
    ufficioId: cfg.ufficioId,
  });

  const extraSkip =
    SKIP_CODICI_TRE_SEDI[sede].has(codice) ||
    (sede === "PZ" && normalizeTaxId(base.partitaIva) === PIVA_DOPPIONE_MILANO);

  if (!codice || CAMPOBASSO_SKIP_CODICI.has(codice) || stato === "NON ATTIVO" || extraSkip) {
    return {
      ...base,
      sede,
      ufficioId: cfg.ufficioId,
      sedeEmail: cfg.email,
      note: extraSkip ? "Saltato: P.IVA 03630431215 già su Milano SRIB EUROPA" : null,
      cfInventato: false,
      pivaInventata: false,
      indirizzoPlaceholder: false,
      esito: "saltato",
      motivo: extraSkip ? "doppione_piva_milano" : "non_attivo_o_escluso",
    };
  }

  const notes: string[] = [];
  let tipoCliente = base.tipoCliente;
  let ragioneSociale = base.ragioneSociale;
  let nome = base.nome;
  let cognome = base.cognome;
  let codiceFiscale = base.codiceFiscale;
  let partitaIva = base.partitaIva;
  let codiceFiscaleAzienda = base.codiceFiscaleAzienda;
  let formaGiuridica = base.formaGiuridica;
  let gruppoFinanziarioKey = base.gruppoFinanziarioKey;
  let cfInventato = false;
  let pivaInventata = false;

  if (isNuovoClientePlaceholder(nomeRaw)) {
    tipoCliente = "azienda";
    ragioneSociale = `Nuovo cliente ${cfg.label} ${codice}`;
    nome = null;
    cognome = null;
    codiceFiscale = null;
    formaGiuridica = "altro";
    gruppoFinanziarioKey = "aziende_private";
    notes.push("Placeholder gestionale _nuovo_cliente");
  }

  if (tipoCliente === "privato") {
    if (!nome || !cognome) {
      const split = splitNomeCognome(nomeRaw || "Cliente");
      nome = nome || split.nome;
      cognome = cognome || split.cognome;
    }
    const cfOk = validateCF(codiceFiscale, { allowPIVAFormat: false }).valid;
    if (!cfOk) {
      if (codiceFiscale) notes.push(`CF gestionale non valido: ${codiceFiscale}`);
      codiceFiscale = inventCodiceFiscale({
        seed: `${sede}:${codice}:${nomeRaw}`,
        cognome: cognome || "CLIENTE",
        nome: nome || "NUOVO",
        comune: COMUNE_CATASTALE[sede],
        taken: takenTax,
      });
      cfInventato = true;
      notes.push("CF generato in import (mancante o non valido nel gestionale)");
    } else {
      takenTax.add(normalizeTaxId(codiceFiscale));
    }
  } else {
    if (!formaGiuridica) formaGiuridica = inferFormaGiuridica(ragioneSociale || nomeRaw) || "altro";
    if (!gruppoFinanziarioKey) {
      gruppoFinanziarioKey = tipoCliente === "ente" ? "enti_territoriali" : "aziende_private";
    }
    const pivaOk = validatePIVA(partitaIva).valid;
    const cfAzOk =
      validatePIVA(codiceFiscaleAzienda).valid ||
      validateCF(codiceFiscaleAzienda, { allowPIVAFormat: true }).valid;
    if (pivaOk) takenTax.add(normalizeTaxId(partitaIva));
    if (cfAzOk && codiceFiscaleAzienda) takenTax.add(normalizeTaxId(codiceFiscaleAzienda));
    if (!pivaOk && !cfAzOk) {
      partitaIva = inventPartitaIva(`${sede}:${codice}:${ragioneSociale || nomeRaw}`, takenTax);
      codiceFiscaleAzienda = partitaIva;
      pivaInventata = true;
      notes.push("P.IVA generata in import (mancante nel gestionale)");
    } else if (!pivaOk && cfAzOk && /^\d{11}$/.test(normalizeTaxId(codiceFiscaleAzienda))) {
      partitaIva = normalizeTaxId(codiceFiscaleAzienda);
    } else if (!cfAzOk && pivaOk) {
      codiceFiscaleAzienda = partitaIva;
    }
  }

  let indirizzo = base.indirizzo;
  let indirizzoPlaceholder = false;
  if (!trimTxt(indirizzo)) {
    indirizzo = "Da completare";
    indirizzoPlaceholder = true;
    notes.push("Indirizzo mancante nel gestionale");
  }

  if (isSedeUnitAltraCitta(base.unit, sede)) {
    notes.push(`Unit gestionale: ${base.unit} (resta sulla sede ${cfg.label})`);
  }

  const cfInfo = interpretCodiceFiscale(riga.CF);
  const pivaCol = padPartitaIva(riga.PIva);
  if (pivaCol.padded) notes.push("P.IVA paddata a 11 cifre");
  if (cfInfo.troncato && tipoCliente !== "privato") {
    notes.push(`CF gestionale non interpretato: ${cfInfo.troncato}`);
  }

  return {
    ...base,
    tipoCliente,
    ragioneSociale,
    nome,
    cognome,
    codiceFiscale,
    partitaIva,
    codiceFiscaleAzienda,
    formaGiuridica,
    gruppoFinanziarioKey,
    indirizzo,
    email: base.email || cfg.email,
    sede,
    ufficioId: cfg.ufficioId,
    sedeEmail: cfg.email,
    note: noteJoin(notes),
    cfInventato,
    pivaInventata,
    indirizzoPlaceholder,
    esito: base.esito === "collegare" ? "collegare" : "da_creare",
    motivo: base.esito === "collegare" ? base.motivo : "nuovo",
  };
}

export function pickKeepersTreSedi(resolved: TreSediRisolto[]): {
  keepers: TreSediRisolto[];
  dups: TreSediRisolto[];
} {
  const seenTax = new Set<string>();
  const keepers: TreSediRisolto[] = [];
  const dups: TreSediRisolto[] = [];
  const sedeRank: Record<TreSediKey, number> = { MI: 0, PR: 1, PZ: 2 };

  const rank = (r: TreSediRisolto) => {
    let n = 0;
    if (r.codiceFiscale && !r.cfInventato) n += 3;
    if (r.partitaIva && !r.pivaInventata && validatePIVA(r.partitaIva).valid) n += 3;
    if (r.indirizzo && !r.indirizzoPlaceholder) n += 1;
    if (r.email !== r.sedeEmail) n += 1;
    if (r.telefono) n += 1;
    return n;
  };

  const sorted = [...resolved].sort((a, b) => {
    if (a.esito !== b.esito) {
      if (a.esito === "collegare") return -1;
      if (b.esito === "collegare") return 1;
    }
    const sede = sedeRank[a.sede] - sedeRank[b.sede];
    if (sede) return sede;
    return rank(b) - rank(a) || a.codice.localeCompare(b.codice);
  });

  for (const r of sorted) {
    if (r.esito === "saltato") {
      dups.push(r);
      continue;
    }
    const keys = [r.codiceFiscale, r.partitaIva, r.codiceFiscaleAzienda]
      .map((x) => normalizeTaxId(x))
      .filter((x) => x.length >= 11 && !isDummyTaxId(x));
    const clash = keys.find((k) => seenTax.has(k));
    if (clash && r.esito === "da_creare") {
      dups.push({ ...r, esito: "saltato", motivo: `doppione_file:${clash}` });
      continue;
    }
    for (const k of keys) seenTax.add(k);
    keepers.push(r);
  }

  return { keepers, dups };
}
