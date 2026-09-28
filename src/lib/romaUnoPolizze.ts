/**
 * Mapping polizze gestionale Roma Uno → titoli CBnet.
 *
 * Scope: solo TipoTit PI / PQ. AM PR AP PS DP fuori.
 * - PI = polizza (incassabile se ha Dt Incasso).
 * - PQ con PI = quietanza figlia.
 * - Solo PQ = si genera la madre (premio 0, non incassata) e le PQ restano quietanze.
 * - Gruppo = numero + compagnia + cliente (3211620 VIS non si fonde).
 */

import { frazionamentoToRate } from "@/lib/frazionamento";
import {
  excelSerialToIso,
  mapRateToFrazionamento,
  mapValuta,
  money,
  normalizeNumeroPolizza,
  padClienteCodice,
  trimTxt,
} from "@/lib/campobassoPolizze";

export const ROMA_UNO_UFFICIO_ID = "cdb3a9e1-2603-4147-819e-2bf5729c6731";
export const ROMA_UNO_UFFICIO_CODICE = "009";
export const ROMA_UNO_FILIALE = "RM";

export const ROMA_UNO_TIPI_CARICABILI = new Set(["PI", "PQ"]);

export type RomaUnoPolizzaRiga = {
  ID?: string | number | null;
  CdClie?: string | number | null;
  "Nome CLiente"?: string | null;
  CdComp?: string | null;
  "Nome Compagnia"?: string | null;
  "%Riparto"?: string | number | null;
  CdRamo?: string | null;
  Ramo?: string | null;
  Polizza?: string | number | null;
  Appendice?: string | null;
  Descrizione?: string | null;
  "Rif/Cig"?: string | null;
  Comp_Contabile?: unknown;
  Comp_Assicurativa?: unknown;
  "Iniz Pol"?: unknown;
  "Scad Pol"?: unknown;
  "Iniz Gar"?: unknown;
  "Scad Gar"?: unknown;
  TipoDoc?: string | null;
  TipoTit?: string | null;
  Valuta?: string | null;
  Cambio?: string | number | null;
  Premio?: string | number | null;
  Imponibile?: string | number | null;
  Tasse?: string | number | null;
  Attive?: string | number | null;
  "Nome Specialist"?: string | null;
  "Nome A/E"?: string | null;
  "Nome Produttore"?: string | null;
  CdProd?: string | number | null;
  "Dt Copertura"?: unknown;
  "Dt Incasso"?: unknown;
  TipoInc?: string | null;
  ContoInc?: string | null;
  "Mesi Disd"?: string | number | null;
  Rate?: string | number | null;
  Rinnovo?: string | null;
  "Tipo Portafoglio"?: string | null;
  rg?: string | number | null;
};

export type RomaUnoCatalogs = {
  clientiByCodice: Record<string, string>;
  ramiByCodice: Record<string, { id: string; descrizione: string }>;
  compagnieByCodice: Record<string, string>;
  produttoriByKey: Record<string, string>;
};

export type RomaUnoTitoloTipo = "polizza" | "quietanza";

export type RomaUnoTitoloPianificato = {
  tipo: RomaUnoTitoloTipo;
  esito: "da_creare" | "saltata";
  motivo: string;
  generata: boolean;
  chiave: string;
  fileId: string | null;
  fileTipoTit: string;
  numeroTitolo: string;
  riga: number;
  stato: "attivo" | "incassato";
  clienteId: string | null;
  codiceCliente: string;
  compagniaId: string | null;
  compagniaCodice: string | null;
  compagniaNome: string | null;
  ramoId: string | null;
  prodottoNome: string | null;
  garanziaDa: string | null;
  garanziaA: string | null;
  durataDa: string | null;
  durataA: string | null;
  dataScadenza: string | null;
  dataCompetenza: string | null;
  dataMessaCassa: string | null;
  dataIncasso: string | null;
  dataCopertura: string | null;
  importoIncassato: number | null;
  premioNetto: number;
  premioLordo: number;
  tasse: number;
  provvigioni: number;
  frazionamento: string;
  rate: number;
  anniDurata: number;
  percentualeRiparto: number;
  tacitoRinnovo: boolean;
  emittenda: boolean;
  sostituiscePolizza: string | null;
  sostituisceRiga: number | null;
  cigRif: string | null;
  descrizione: string | null;
  note: string | null;
  specialist: string | null;
  aeNome: string | null;
  produttoreNome: string | null;
  produttoreId: string | null;
  tipoIncasso: string | null;
  contoIncasso: string | null;
  tipoPortafoglio: string | null;
  valuta: string;
  cambio: number;
  disdettaMesi: number | null;
  compContabile: string | null;
  compAssicurativa: string | null;
};

export type RomaUnoGruppoPianificato = {
  chiave: string;
  esito: "da_creare" | "saltato";
  motivo: string;
  numero: string;
  codiceCliente: string;
  compagniaCodice: string | null;
  madre: RomaUnoTitoloPianificato | null;
  quietanze: RomaUnoTitoloPianificato[];
};

export function isTipoCaricabile(tipoTit: unknown): boolean {
  return ROMA_UNO_TIPI_CARICABILI.has(trimTxt(tipoTit).toUpperCase());
}

export function romaUnoClienteKey(cdClie: unknown): string {
  return padClienteCodice(cdClie);
}

export function normalizeProduttoreKey(raw: unknown): string {
  const first = trimTxt(raw).split("/")[0];
  return first
    .toUpperCase()
    .replace(/[.'’]/g, "")
    .replace(/\bSRLS?\b/g, "")
    .replace(/\bSPA\b/g, "")
    .replace(/\bSAS\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function lookupProduttoreId(nome: unknown, catalog: Record<string, string>): string | null {
  const key = normalizeProduttoreKey(nome);
  if (!key) return null;
  if (catalog[key]) return catalog[key];
  const compact = key.replace(/\s+/g, "");
  if (catalog[compact]) return catalog[compact];
  for (const [k, id] of Object.entries(catalog)) {
    if (k.includes(key) || key.includes(k)) return id;
  }
  return null;
}

function yearsBetween(from: string | null, to: string | null): number {
  if (!from || !to) return 1;
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return 1;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000 / 365));
}

function noteParts(parts: Array<string | null | undefined>): string | null {
  const rows = parts.map((p) => trimTxt(p)).filter(Boolean);
  return rows.length ? rows.join("\n") : null;
}

type ParsedRow = {
  raw: RomaUnoPolizzaRiga;
  fileId: string | null;
  tipoTit: string;
  numero: string;
  codiceCliente: string;
  clienteNome: string;
  clienteId: string | null;
  cdCompRaw: string;
  compagniaNome: string;
  compagniaId: string | null;
  ramoCodice: string;
  ramoId: string | null;
  prodottoNome: string | null;
  inizPol: string | null;
  scadPol: string | null;
  inizGar: string | null;
  scadGar: string | null;
  dtIncasso: string | null;
  dtCopertura: string | null;
  premio: number;
  imponibile: number;
  tasse: number;
  attive: number;
  rate: number;
  frazionamento: string;
  tacito: boolean;
  riparto: number;
  descrizione: string | null;
  cig: string | null;
  specialist: string | null;
  aeNome: string | null;
  produttoreNome: string | null;
  produttoreId: string | null;
  tipoIncasso: string | null;
  contoIncasso: string | null;
  tipoPortafoglio: string | null;
  valuta: string;
  cambio: number;
  mesiDisd: number | null;
  compContabile: string | null;
  compAssicurativa: string | null;
};

function parseRow(riga: RomaUnoPolizzaRiga, catalogs: RomaUnoCatalogs): ParsedRow {
  const tipoTit = trimTxt(riga.TipoTit || riga.TipoDoc).toUpperCase();
  const codiceCliente = romaUnoClienteKey(riga.CdClie);
  const cdCompRaw = trimTxt(riga.CdComp).toUpperCase();
  const ramoCodice = trimTxt(riga.CdRamo).toUpperCase();
  const ramo = ramoCodice ? catalogs.ramiByCodice[ramoCodice] : undefined;
  const rateN = Number(riga.Rate);
  const produttoreNome = trimTxt(riga["Nome Produttore"]) || null;
  return {
    raw: riga,
    fileId: trimTxt(riga.ID) || null,
    tipoTit,
    numero: normalizeNumeroPolizza(riga.Polizza),
    codiceCliente,
    clienteNome: trimTxt(riga["Nome CLiente"]),
    clienteId: codiceCliente ? catalogs.clientiByCodice[codiceCliente] ?? null : null,
    cdCompRaw,
    compagniaNome: trimTxt(riga["Nome Compagnia"]),
    compagniaId: cdCompRaw ? catalogs.compagnieByCodice[cdCompRaw] ?? null : null,
    ramoCodice,
    ramoId: ramo?.id ?? null,
    prodottoNome: trimTxt(riga.Ramo) || ramo?.descrizione || null,
    inizPol: excelSerialToIso(riga["Iniz Pol"]),
    scadPol: excelSerialToIso(riga["Scad Pol"]),
    inizGar: excelSerialToIso(riga["Iniz Gar"]),
    scadGar: excelSerialToIso(riga["Scad Gar"]),
    dtIncasso: excelSerialToIso(riga["Dt Incasso"]),
    dtCopertura: excelSerialToIso(riga["Dt Copertura"]),
    premio: money(riga.Premio),
    imponibile: money(riga.Imponibile),
    tasse: money(riga.Tasse),
    attive: money(riga.Attive),
    rate: Number.isFinite(rateN) ? rateN : 1,
    frazionamento: mapRateToFrazionamento(riga.Rate),
    tacito: trimTxt(riga.Rinnovo).toUpperCase() === "R",
    riparto: money(riga["%Riparto"]) || 100,
    descrizione: trimTxt(riga.Descrizione) || null,
    cig: trimTxt(riga["Rif/Cig"]) || null,
    specialist: trimTxt(riga["Nome Specialist"]) || null,
    aeNome: trimTxt(riga["Nome A/E"]) || null,
    produttoreNome,
    produttoreId: lookupProduttoreId(produttoreNome, catalogs.produttoriByKey),
    tipoIncasso: trimTxt(riga.TipoInc) || null,
    contoIncasso: trimTxt(riga.ContoInc) || null,
    tipoPortafoglio: trimTxt(riga["Tipo Portafoglio"]) || null,
    valuta: mapValuta(riga.Valuta),
    cambio: money(riga.Cambio) || 1,
    mesiDisd: Number.isFinite(Number(riga["Mesi Disd"])) ? Number(riga["Mesi Disd"]) : null,
    compContabile: excelSerialToIso(riga.Comp_Contabile),
    compAssicurativa: excelSerialToIso(riga.Comp_Assicurativa),
  };
}

function emptyTitolo(
  partial: Partial<RomaUnoTitoloPianificato> & Pick<RomaUnoTitoloPianificato, "tipo" | "chiave" | "numeroTitolo">,
): RomaUnoTitoloPianificato {
  return {
    esito: "da_creare",
    motivo: "",
    generata: false,
    fileId: null,
    fileTipoTit: "",
    riga: 0,
    stato: "attivo",
    clienteId: null,
    codiceCliente: "",
    compagniaId: null,
    compagniaCodice: null,
    compagniaNome: null,
    ramoId: null,
    prodottoNome: null,
    garanziaDa: null,
    garanziaA: null,
    durataDa: null,
    durataA: null,
    dataScadenza: null,
    dataCompetenza: null,
    dataMessaCassa: null,
    dataIncasso: null,
    dataCopertura: null,
    importoIncassato: null,
    premioNetto: 0,
    premioLordo: 0,
    tasse: 0,
    provvigioni: 0,
    frazionamento: "Annuale",
    rate: 1,
    anniDurata: 1,
    percentualeRiparto: 100,
    tacitoRinnovo: false,
    emittenda: false,
    sostituiscePolizza: null,
    sostituisceRiga: null,
    cigRif: null,
    descrizione: null,
    note: null,
    specialist: null,
    aeNome: null,
    produttoreNome: null,
    produttoreId: null,
    tipoIncasso: null,
    contoIncasso: null,
    tipoPortafoglio: null,
    valuta: "EUR",
    cambio: 1,
    disdettaMesi: null,
    compContabile: null,
    compAssicurativa: null,
    ...partial,
  };
}

function fillFromParsed(
  tipo: RomaUnoTitoloTipo,
  parsed: ParsedRow,
  opts: {
    chiave: string;
    numeroTitolo: string;
    riga: number;
    motivo: string;
    cassa: boolean;
    generata?: boolean;
    zeroPremio?: boolean;
    sostituiscePolizza?: string | null;
  },
): RomaUnoTitoloPianificato {
  const polDa = parsed.inizPol || parsed.inizGar;
  const polA = parsed.scadPol || parsed.scadGar;
  const garDa = parsed.inizGar || parsed.inizPol;
  const garA = parsed.scadGar || parsed.scadPol;
  const usePolDates = tipo === "polizza";
  const da = usePolDates ? polDa : garDa;
  const a = usePolDates ? polA : garA;
  const frazionamento = parsed.frazionamento;
  const hasCassa = !opts.generata && opts.cassa && !!parsed.dtIncasso;
  const zero = !!opts.zeroPremio;
  return emptyTitolo({
    tipo,
    esito: "da_creare",
    motivo: opts.motivo,
    generata: !!opts.generata,
    chiave: opts.chiave,
    fileId: parsed.fileId,
    fileTipoTit: parsed.tipoTit,
    numeroTitolo: opts.numeroTitolo,
    riga: opts.riga,
    stato: hasCassa ? "incassato" : "attivo",
    clienteId: parsed.clienteId,
    codiceCliente: parsed.codiceCliente,
    compagniaId: parsed.compagniaId,
    compagniaCodice: parsed.cdCompRaw || null,
    compagniaNome: parsed.compagniaNome || null,
    ramoId: parsed.ramoId,
    prodottoNome: parsed.prodottoNome,
    garanziaDa: da,
    garanziaA: a,
    durataDa: polDa,
    durataA: polA,
    dataScadenza: usePolDates ? polA : a,
    dataCompetenza: da,
    dataMessaCassa: hasCassa ? parsed.dtIncasso : null,
    dataIncasso: hasCassa ? parsed.dtIncasso : null,
    dataCopertura: parsed.dtCopertura,
    importoIncassato: hasCassa ? parsed.premio : null,
    premioNetto: zero ? 0 : parsed.imponibile,
    premioLordo: zero ? 0 : parsed.premio,
    tasse: zero ? 0 : parsed.tasse,
    provvigioni: zero ? 0 : parsed.attive,
    frazionamento,
    rate: frazionamentoToRate(frazionamento, 1),
    anniDurata: yearsBetween(polDa, polA),
    percentualeRiparto: parsed.riparto,
    tacitoRinnovo: parsed.tacito,
    emittenda: /emitt/i.test(opts.numeroTitolo),
    sostituiscePolizza: opts.sostituiscePolizza ?? null,
    sostituisceRiga: opts.sostituiscePolizza ? 0 : null,
    cigRif: parsed.cig,
    descrizione: parsed.descrizione,
    note: noteParts([
      opts.generata ? "Polizza generata: nel file c'era solo PQ" : null,
      parsed.mesiDisd && parsed.mesiDisd !== 0 ? `Mesi disdetta gestionale: ${parsed.mesiDisd}` : null,
    ]),
    specialist: parsed.specialist,
    aeNome: parsed.aeNome,
    produttoreNome: parsed.produttoreNome,
    produttoreId: parsed.produttoreId,
    tipoIncasso: hasCassa ? parsed.tipoIncasso : parsed.tipoIncasso,
    contoIncasso: hasCassa ? parsed.contoIncasso : parsed.contoIncasso,
    tipoPortafoglio: parsed.tipoPortafoglio,
    valuta: parsed.valuta,
    cambio: parsed.cambio,
    disdettaMesi: parsed.mesiDisd,
    compContabile: parsed.compContabile,
    compAssicurativa: parsed.compAssicurativa,
  });
}

function skipGroup(chiave: string, motivo: string, parsed: ParsedRow[]): RomaUnoGruppoPianificato {
  const first = parsed[0];
  return {
    chiave,
    esito: "saltato",
    motivo,
    numero: first?.numero ?? "",
    codiceCliente: first?.codiceCliente ?? "",
    compagniaCodice: first?.cdCompRaw ?? null,
    madre: null,
    quietanze: [],
  };
}

function byGaranzia(a: ParsedRow, b: ParsedRow): number {
  return (a.inizGar || a.inizPol || "").localeCompare(b.inizGar || b.inizPol || "");
}

export function groupRomaUnoRighe(rows: RomaUnoPolizzaRiga[]): RomaUnoPolizzaRiga[][] {
  const map = new Map<string, RomaUnoPolizzaRiga[]>();
  rows.forEach((row, idx) => {
    if (!isTipoCaricabile(row.TipoTit || row.TipoDoc)) return;
    const numero = normalizeNumeroPolizza(row.Polizza) || `__vuoto_${idx}`;
    const comp = trimTxt(row.CdComp).toUpperCase() || `UNK${idx}`;
    const cli = romaUnoClienteKey(row.CdClie) || `CLI${idx}`;
    const key = `${numero}|${comp}|${cli}`;
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  });
  return [...map.values()];
}

export function resolveRomaUnoGruppo(
  rows: RomaUnoPolizzaRiga[],
  catalogs: RomaUnoCatalogs,
  seq = 1,
): RomaUnoGruppoPianificato {
  const parsed = rows.map((r) => parseRow(r, catalogs)).sort(byGaranzia);
  const first = parsed[0];
  const chiave = `rm1:${first?.numero || seq}:${first?.cdCompRaw || "?"}:${first?.codiceCliente || "?"}`;
  if (!first) return skipGroup(`rm1:${seq}`, "Gruppo vuoto", parsed);
  if (!first.numero) return skipGroup(chiave, "Numero polizza vuoto", parsed);
  if (!first.cdCompRaw) return skipGroup(chiave, "Compagnia vuota", parsed);
  if (!first.compagniaId) {
    return skipGroup(chiave, `Compagnia non in anagrafica (${first.cdCompRaw})`, parsed);
  }
  if (!first.clienteId) {
    return skipGroup(chiave, `Cliente non in anagrafica (${first.codiceCliente || "vuoto"})`, parsed);
  }
  if (!first.ramoId) {
    return skipGroup(chiave, `Ramo non mappato (${first.ramoCodice || "vuoto"})`, parsed);
  }
  const hasDates = !!(first.inizPol || first.inizGar) && !!(first.scadPol || first.scadGar);
  if (!hasDates) return skipGroup(chiave, "Date effetto/scadenza mancanti", parsed);

  const pi = parsed.filter((p) => p.tipoTit === "PI");
  const pq = parsed.filter((p) => p.tipoTit === "PQ");
  const numero = first.numero;

  let madre: RomaUnoTitoloPianificato;
  if (pi.length) {
    const source = pi[0];
    madre = fillFromParsed("polizza", source, {
      chiave: `${chiave}:madre`,
      numeroTitolo: numero,
      riga: 0,
      motivo: "Polizza da PI",
      cassa: true,
    });
  } else {
    const source = pq[0];
    madre = fillFromParsed("polizza", source, {
      chiave: `${chiave}:madre`,
      numeroTitolo: numero,
      riga: 0,
      motivo: "Polizza generata da PQ",
      cassa: false,
      generata: true,
      zeroPremio: true,
    });
  }
  madre.clienteId = first.clienteId;

  const quietanze = pq.map((row, idx) =>
    fillFromParsed("quietanza", row, {
      chiave: `${chiave}:q${idx + 1}`,
      numeroTitolo: numero,
      riga: idx + 1,
      motivo: "Quietanza da PQ",
      cassa: true,
      sostituiscePolizza: numero,
    }),
  );

  return {
    chiave,
    esito: "da_creare",
    motivo: madre.motivo,
    numero,
    codiceCliente: first.codiceCliente,
    compagniaCodice: first.cdCompRaw,
    madre,
    quietanze,
  };
}

export function planRomaUnoPolizze(rows: RomaUnoPolizzaRiga[], catalogs: RomaUnoCatalogs): {
  gruppi: RomaUnoGruppoPianificato[];
  daCreare: RomaUnoTitoloPianificato[];
  saltati: RomaUnoGruppoPianificato[];
  stats: Record<string, number>;
} {
  const gruppi = groupRomaUnoRighe(rows).map((g, i) => resolveRomaUnoGruppo(g, catalogs, i + 1));
  const daCreare: RomaUnoTitoloPianificato[] = [];
  const saltati: RomaUnoGruppoPianificato[] = [];
  const stats: Record<string, number> = {
    gruppi: gruppi.length,
    madri: 0,
    madriGenerate: 0,
    quietanze: 0,
    saltati: 0,
    escluseAltriTipi: rows.filter((r) => !isTipoCaricabile(r.TipoTit || r.TipoDoc)).length,
  };
  for (const g of gruppi) {
    if (g.esito === "saltato") {
      saltati.push(g);
      stats.saltati += 1;
      const key = `skip:${g.motivo.split("(")[0].trim()}`;
      stats[key] = (stats[key] || 0) + 1;
      continue;
    }
    if (g.madre) {
      daCreare.push(g.madre);
      stats.madri += 1;
      if (g.madre.generata) stats.madriGenerate += 1;
    }
    daCreare.push(...g.quietanze);
    stats.quietanze += g.quietanze.length;
  }
  return { gruppi, daCreare, saltati, stats };
}

export { excelSerialToIso, mapRateToFrazionamento, money, padClienteCodice, trimTxt };
