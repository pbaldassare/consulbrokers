/**
 * Armonizzazione mandati EXE (Direzione / pluri / broker) → compagnie + rapporti CBnet.
 *
 * - Colonna brand = direzione/gruppo.
 * - Ragione sociale aggiuntiva = controparte (agenzia o broker).
 * - Un codice EXE = un compagnia_rapporti (codice EXE####).
 * - Non si creano doppioni RM2 del brand. Le agenzie Roma non si mischiano con San Donà.
 */

import {
  canonRomaExeCompagnia,
  isSedeLocaleNome,
  normalizeCompagniaNome,
  normKey,
  resolveGruppoCompagnia,
  splitExeEmail,
  normalizeIbanExe,
  type CatalogoCompagniaCBnet,
  type CatalogoGruppoCompagnia,
  type CompagniaTipoCBnet,
} from "@/lib/romaExeCompagnie";

export type TipoMandatoExe = "direzione" | "pluri" | "broker";

export type RomaExeCompagniaExcelRiga = {
  exeCodice: string;
  brandNome: string;
  aggiuntiva: string | null;
  tipoMandato: TipoMandatoExe;
  indirizzo?: string | null;
  cap?: string | null;
  citta?: string | null;
  provincia?: string | null;
  telefono?: string | null;
  emailRaw?: string | null;
  banca?: string | null;
  iban?: string | null;
};

export type ControparteMatch = {
  id: string | null;
  nome: string;
  codice: string | null;
  tipo: CompagniaTipoCBnet;
  esito: "esistente" | "da_creare" | "direzione";
};

export type RomaExeMandatoRisolto = RomaExeCompagniaExcelRiga & {
  skip: boolean;
  motivo: string;
  brandCanonical: string;
  direzioneId: string | null;
  direzioneNome: string | null;
  gruppoId: string | null;
  gruppoNome: string | null;
  controparte: ControparteMatch | null;
  tipoRapporto: "Direzione" | "Agenzia" | "Broker";
  codiceRapporto: string;
};

const GRUPPO_PREFERITO: Record<string, string> = {
  UNIPOLSAI: "Unipol Assicurazioni S.p.a.",
  UNIPOLASSICURAZIONISPA: "Unipol Assicurazioni S.p.a.",
  REALEMUTUA: "Societa' Reale Mutua di Assicurazioni",
  ITAS: "Itas Mutua",
  EUROPASSISTANCEITALIA: "EUROP ASSISTANCE ITALIA",
  EUROPASSISTANCEITALIASPA: "EUROP ASSISTANCE ITALIA",
  TUTELALEGALESPA: "Tutela Legale Spa",
  BERKSHIREHATHAWAY: "Berkshire Hathaway International Insurance Limite",
  BERKSHIREHATHAWAYINTERNATIONALINSURANCELIMITED: "Berkshire Hathaway International Insurance Limite",
  GLOBALASSISTANCE: "GLOBAL ASSISTANCE",
  GLOBALASSISTANCEENTIPUBBLICI: "GLOBAL ASSISTANCE",
};

export function parseTipoMandato(raw: string | null | undefined): TipoMandatoExe {
  const t = String(raw ?? "").trim().toLowerCase();
  if (t.includes("broker")) return "broker";
  if (t.includes("pluri")) return "pluri";
  return "direzione";
}

export function cleanAggiuntiva(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (/^ragione sociale aggiuntiva$/i.test(s)) return null;
  if (/^direzione$/i.test(s)) return null;
  return s;
}

export function normalizeControparteNome(value: string | null | undefined): string {
  return normalizeCompagniaNome(value)
    .replace(/\bENTI PUBBLICI\b/g, " ")
    .replace(/\bBROKER\b/g, " ")
    .replace(/\bTUTELA\s+ASSICURA\b/g, "TUTELASSICURA")
    .replace(/\s+/g, " ")
    .trim();
}

export function codiceRapportoExe(exeCodice: string): string {
  const n = String(exeCodice).replace(/\D/g, "");
  return `EXE${n.padStart(4, "0")}`;
}

export function preferGruppo(
  brand: string,
  gruppi: CatalogoGruppoCompagnia[],
): CatalogoGruppoCompagnia | null {
  const canon = canonRomaExeCompagnia(brand);
  const mapped = GRUPPO_PREFERITO[normKey(canon.brand)] || GRUPPO_PREFERITO[normKey(canon.canonical)];
  if (mapped) {
    const hit = gruppi.find((g) => normKey(g.descrizione) === normKey(mapped));
    if (hit) return hit;
  }
  return resolveGruppoCompagnia(canon.brand, gruppi) ?? resolveGruppoCompagnia(canon.canonical, gruppi);
}

export function matchControparte(
  nome: string | null | undefined,
  catalogo: CatalogoCompagniaCBnet[],
  tipoHint: CompagniaTipoCBnet,
): ControparteMatch {
  const raw = String(nome ?? "").replace(/\s+/g, " ").trim();
  const want = normKey(normalizeControparteNome(raw));
  const candidates = catalogo.filter((c) => {
    if (isSedeLocaleNome(c.nome) && normKey(c.nome) !== want) return false;
    const cn = normKey(normalizeControparteNome(c.nome));
    return cn === want || normKey(c.nome) === want;
  });
  const ranked = [...candidates].sort((a, b) => {
    let sa = 0;
    let sb = 0;
    if (a.tipo === tipoHint) sa += 30;
    if (b.tipo === tipoHint) sb += 30;
    if (a.tipo === "broker" && tipoHint === "broker") sa += 20;
    if (b.tipo === "broker" && tipoHint === "broker") sb += 20;
    if (!String(a.codice ?? "").startsWith("RM2")) sa += 10;
    if (!String(b.codice ?? "").startsWith("RM2")) sb += 10;
    return sb - sa;
  });
  const hit = ranked[0];
  if (hit) {
    return {
      id: hit.id,
      nome: hit.nome,
      codice: hit.codice ?? null,
      tipo: (hit.tipo as CompagniaTipoCBnet) || tipoHint,
      esito: "esistente",
    };
  }
  return {
    id: null,
    nome: raw,
    codice: null,
    tipo: tipoHint,
    esito: "da_creare",
  };
}

export function resolveRomaExeMandato(
  riga: RomaExeCompagniaExcelRiga,
  catalogs: {
    catalogo: CatalogoCompagniaCBnet[];
    gruppi: CatalogoGruppoCompagnia[];
    direzioneByBrand: Map<string, CatalogoCompagniaCBnet>;
  },
): RomaExeMandatoRisolto {
  const canon = canonRomaExeCompagnia(riga.brandNome);
  const codiceRapporto = codiceRapportoExe(riga.exeCodice);
  const base = {
    ...riga,
    brandCanonical: canon.canonical,
    codiceRapporto,
    skip: false,
    motivo: "",
    direzioneId: null as string | null,
    direzioneNome: null as string | null,
    gruppoId: null as string | null,
    gruppoNome: null as string | null,
    controparte: null as ControparteMatch | null,
    tipoRapporto: (riga.tipoMandato === "broker"
      ? "Broker"
      : riga.tipoMandato === "pluri"
        ? "Agenzia"
        : "Direzione") as RomaExeMandatoRisolto["tipoRapporto"],
  };

  if (canon.skip) {
    return { ...base, skip: true, motivo: canon.motivoSkip ?? "Saltata" };
  }

  const gruppo = preferGruppo(riga.brandNome, catalogs.gruppi);
  const direzione =
    catalogs.direzioneByBrand.get(normKey(canon.canonical)) ??
    catalogs.direzioneByBrand.get(normKey(canon.brand));

  if (!gruppo) {
    return {
      ...base,
      direzioneId: direzione?.id ?? null,
      direzioneNome: direzione?.nome ?? null,
      skip: riga.tipoMandato !== "direzione",
      motivo: direzione
        ? "Brand presente ma senza gruppo: niente rapporto N:N"
        : "Brand senza gruppo CBnet: non si crea direzione fittizia",
    };
  }

  const direzioneId = direzione?.id ?? null;
  if (riga.tipoMandato === "direzione" || !riga.aggiuntiva) {
    return {
      ...base,
      direzioneId,
      direzioneNome: direzione?.nome ?? canon.canonical,
      gruppoId: gruppo.id,
      gruppoNome: gruppo.descrizione,
      controparte: direzioneId
        ? {
            id: direzioneId,
            nome: direzione?.nome ?? canon.canonical,
            codice: direzione?.codice ?? null,
            tipo: "direzione",
            esito: "direzione",
          }
        : {
            id: null,
            nome: canon.canonical,
            codice: null,
            tipo: "direzione",
            esito: "da_creare",
          },
      motivo: direzioneId ? "Mandato direzione sul brand esistente" : "Direzione brand da creare",
    };
  }

  const tipoHint: CompagniaTipoCBnet = riga.tipoMandato === "broker" ? "broker" : "plurimandataria";
  const controparte = matchControparte(riga.aggiuntiva, catalogs.catalogo, tipoHint);
  return {
    ...base,
    direzioneId,
    direzioneNome: direzione?.nome ?? canon.canonical,
    gruppoId: gruppo.id,
    gruppoNome: gruppo.descrizione,
    controparte,
    motivo:
      controparte.esito === "esistente"
        ? `Rapporto ${riga.tipoMandato} su ${controparte.nome}`
        : `Da creare controparte ${controparte.nome} + rapporto`,
  };
}

export function buildDirezioneByBrand(
  catalogo: CatalogoCompagniaCBnet[],
  mapRows: Array<{ exe_nome?: string | null; compagnia_id?: string | null }>,
): Map<string, CatalogoCompagniaCBnet> {
  const byId = new Map(catalogo.map((c) => [c.id, c]));
  const out = new Map<string, CatalogoCompagniaCBnet>();
  const consider = (key: string, row: CatalogoCompagniaCBnet) => {
    const prev = out.get(key);
    if (!prev) {
      out.set(key, row);
      return;
    }
    const score = (c: CatalogoCompagniaCBnet) =>
      (c.tipo === "direzione" ? 40 : 0) + (String(c.codice ?? "").startsWith("RM2") ? 5 : 20);
    if (score(row) > score(prev)) out.set(key, row);
  };
  for (const row of catalogo) {
    const canon = canonRomaExeCompagnia(row.nome);
    if (canon.skip || isSedeLocaleNome(row.nome)) continue;
    consider(normKey(canon.canonical), row);
    consider(normKey(canon.brand), row);
  }
  for (const m of mapRows) {
    if (!m.compagnia_id) continue;
    const row = byId.get(m.compagnia_id);
    if (!row) continue;
    const canon = canonRomaExeCompagnia(m.exe_nome || row.nome);
    consider(normKey(canon.canonical), row);
  }
  return out;
}

export function sanitizeExeTelefono(raw: string | null | undefined): string | null {
  const t = String(raw ?? "").trim();
  if (!t || /^italia$/i.test(t)) return null;
  return t.slice(0, 80);
}

/**
 * Il trigger `trg_block_self_referential_rapporto` vieta un rapporto N:N
 * se compagnia.gruppo_compagnia_id = rapporto.gruppo_compagnia_id.
 * In quel caso si riusa (o si crea) il rapporto principale 1:1.
 */
export type RapportoInsertMode = "insert_nn" | "insert_principale" | "reuse_principale";

export function rapportoInsertMode(input: {
  compagniaGruppoId: string | null | undefined;
  rapportoGruppoId: string;
  principaleId: string | null | undefined;
}): RapportoInsertMode {
  if (input.compagniaGruppoId && input.compagniaGruppoId === input.rapportoGruppoId) {
    return input.principaleId ? "reuse_principale" : "insert_principale";
  }
  return "insert_nn";
}

export function anagraficaFromExcel(riga: RomaExeCompagniaExcelRiga) {
  const mails = splitExeEmail(riga.emailRaw);
  return {
    indirizzo: (riga.indirizzo || "").trim() || null,
    cap: (riga.cap || "").trim() || null,
    comune: (riga.citta || "").trim() || null,
    provincia: (riga.provincia || "").trim().slice(0, 4) || null,
    telefono: sanitizeExeTelefono(riga.telefono),
    mail: mails.mail,
    pec: mails.pec,
    iban: normalizeIbanExe(riga.iban),
    noteBanca: (riga.banca || "").trim() || null,
  };
}
