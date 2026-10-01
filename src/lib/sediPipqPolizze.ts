/**
 * Import PI/PQ gestionale sedi Milano / Potenza / Parma → titoli CBnet.
 *
 * Scope: solo TipoTit PI / PQ. AM PR AP PS DP fuori.
 * Regola 28/09/2026: la polizza È la prima rata. Niente figlia 1/1.
 * - PI = polizza (incassabile se ha Dt Incasso). PQ = rate successive.
 * - Solo PQ: la prima PQ (per data garanzia) diventa polizza; le altre restano figlie.
 * Gruppo = numero + compagnia (alias) + codice file cliente.
 */

import { frazionamentoToRate } from "@/lib/frazionamento";
import {
  excelSerialToIso,
  mapRateToFrazionamento,
  mapValuta,
  money,
  normalizeNumeroPolizza,
  trimTxt,
} from "@/lib/campobassoPolizze";
import {
  SEDI_CLIENTE_ALIAS,
  SEDI_COMPAGNIA_ALIAS,
  SEDI_TIPI_PIPQ,
  SEDI_UFFICI,
  buildClienteNameIndex,
  denominazioneKeys,
  fileClienteKey,
  isTipoPipq,
  lookupProduttoreId,
  mapCompagniaCodiceSede,
  matchClienteByNome,
  normalizeDenominazione,
  normalizeProduttoreKey,
  percentualeCommercialeDaAnagrafica,
  yearsBetween,
} from "@/lib/sediImportShared";

export const SEDI_PIPQ = SEDI_UFFICI;
export type SedePipqCodice = keyof typeof SEDI_PIPQ;
export const SEDI_PIPQ_TIPI = SEDI_TIPI_PIPQ;
export const SEDI_PIPQ_COMPAGNIA_ALIAS = SEDI_COMPAGNIA_ALIAS;
export const SEDI_PIPQ_CLIENTE_ALIAS = SEDI_CLIENTE_ALIAS;

export {
  buildClienteNameIndex,
  denominazioneKeys,
  fileClienteKey,
  lookupProduttoreId,
  mapCompagniaCodiceSede,
  matchClienteByNome,
  normalizeDenominazione,
  normalizeProduttoreKey,
  percentualeCommercialeDaAnagrafica,
};

export type SediPipqRiga = {
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
};

export type SediPipqCatalogs = {
  clientiByCodice: Record<string, string>;
  ramiByCodice: Record<string, { id: string; descrizione: string }>;
  compagnieByCodice: Record<string, string>;
  produttoriByKey: Record<string, string>;
  /** `anagrafiche_professionali.percentuale_base` per id produttore. */
  produttoriPercById?: Record<string, number | null | undefined>;
};

export type SediPipqTitoloTipo = "polizza" | "quietanza";

export type SediPipqTitolo = {
  tipo: SediPipqTitoloTipo;
  esito: "da_creare" | "saltata";
  motivo: string;
  promossaDaPq: boolean;
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
  percentualeCommerciale: number;
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

export type SediPipqGruppo = {
  chiave: string;
  esito: "da_creare" | "saltato";
  motivo: string;
  numero: string;
  codiceCliente: string;
  compagniaCodice: string | null;
  madre: SediPipqTitolo | null;
  quietanze: SediPipqTitolo[];
};

export function isTipoCaricabile(tipoTit: unknown): boolean {
  return isTipoPipq(tipoTit);
}

function noteParts(parts: Array<string | null | undefined>): string | null {
  const rows = parts.map((p) => trimTxt(p)).filter(Boolean);
  return rows.length ? rows.join("\n") : null;
}

type Parsed = {
  raw: SediPipqRiga;
  fileId: string | null;
  tipoTit: string;
  numero: string;
  codiceCliente: string;
  clienteNome: string;
  clienteId: string | null;
  cdCompRaw: string;
  compagniaCodice: string;
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

function parseRow(riga: SediPipqRiga, catalogs: SediPipqCatalogs): Parsed {
  const tipoTit = trimTxt(riga.TipoTit || riga.TipoDoc).toUpperCase();
  const codiceCliente = fileClienteKey(riga.CdClie);
  const cdCompRaw = trimTxt(riga.CdComp).toUpperCase();
  const compagniaCodice = mapCompagniaCodiceSede(cdCompRaw);
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
    compagniaCodice,
    compagniaNome: trimTxt(riga["Nome Compagnia"]),
    compagniaId: compagniaCodice ? catalogs.compagnieByCodice[compagniaCodice] ?? null : null,
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
  partial: Partial<SediPipqTitolo> & Pick<SediPipqTitolo, "tipo" | "chiave" | "numeroTitolo">,
): SediPipqTitolo {
  return {
    esito: "da_creare",
    motivo: "",
    promossaDaPq: false,
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
    percentualeCommerciale: 100,
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
  tipo: SediPipqTitoloTipo,
  parsed: Parsed,
  catalogs: SediPipqCatalogs,
  opts: {
    chiave: string;
    numeroTitolo: string;
    riga: number;
    motivo: string;
    cassa: boolean;
    promossaDaPq?: boolean;
    sostituiscePolizza?: string | null;
  },
): SediPipqTitolo {
  const polDa = parsed.inizPol || parsed.inizGar;
  const polA = parsed.scadPol || parsed.scadGar;
  const garDa = parsed.inizGar || parsed.inizPol;
  const garA = parsed.scadGar || parsed.scadPol;
  const usePolDates = tipo === "polizza";
  const da = usePolDates ? polDa : garDa;
  const a = usePolDates ? polA : garA;
  const hasCassa = opts.cassa && !!parsed.dtIncasso;
  return emptyTitolo({
    tipo,
    esito: "da_creare",
    motivo: opts.motivo,
    promossaDaPq: !!opts.promossaDaPq,
    chiave: opts.chiave,
    fileId: parsed.fileId,
    fileTipoTit: parsed.tipoTit,
    numeroTitolo: opts.numeroTitolo,
    riga: opts.riga,
    stato: hasCassa ? "incassato" : "attivo",
    clienteId: parsed.clienteId,
    codiceCliente: parsed.codiceCliente,
    compagniaId: parsed.compagniaId,
    compagniaCodice: parsed.compagniaCodice || parsed.cdCompRaw || null,
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
    premioNetto: parsed.imponibile,
    premioLordo: parsed.premio,
    tasse: parsed.tasse,
    provvigioni: parsed.attive,
    frazionamento: parsed.frazionamento,
    rate: frazionamentoToRate(parsed.frazionamento, 1),
    anniDurata: yearsBetween(polDa, polA),
    percentualeRiparto: parsed.riparto,
    percentualeCommerciale:
      percentualeCommercialeDaAnagrafica(parsed.produttoreId, catalogs.produttoriPercById) ?? 100,
    tacitoRinnovo: parsed.tacito,
    emittenda: /emitt/i.test(opts.numeroTitolo),
    sostituiscePolizza: opts.sostituiscePolizza ?? null,
    sostituisceRiga: opts.sostituiscePolizza ? 0 : null,
    cigRif: parsed.cig,
    descrizione: parsed.descrizione,
    note: noteParts([
      opts.promossaDaPq ? "Polizza promossa da PQ: nel file non c'era PI" : null,
      parsed.mesiDisd && parsed.mesiDisd !== 0 ? `Mesi disdetta gestionale: ${parsed.mesiDisd}` : null,
    ]),
    specialist: parsed.specialist,
    aeNome: parsed.aeNome,
    produttoreNome: parsed.produttoreNome,
    produttoreId: parsed.produttoreId,
    tipoIncasso: parsed.tipoIncasso,
    contoIncasso: parsed.contoIncasso,
    tipoPortafoglio: parsed.tipoPortafoglio,
    valuta: parsed.valuta,
    cambio: parsed.cambio,
    disdettaMesi: parsed.mesiDisd,
    compContabile: parsed.compContabile,
    compAssicurativa: parsed.compAssicurativa,
  });
}

function skipGroup(chiave: string, motivo: string, parsed: Parsed[]): SediPipqGruppo {
  const first = parsed[0];
  return {
    chiave,
    esito: "saltato",
    motivo,
    numero: first?.numero ?? "",
    codiceCliente: first?.codiceCliente ?? "",
    compagniaCodice: first?.compagniaCodice ?? first?.cdCompRaw ?? null,
    madre: null,
    quietanze: [],
  };
}

function byGaranzia(a: Parsed, b: Parsed): number {
  return (a.inizGar || a.inizPol || "").localeCompare(b.inizGar || b.inizPol || "");
}

export function groupSediPipqRighe(rows: SediPipqRiga[]): SediPipqRiga[][] {
  return partitionSediPipqRighe(rows).groups;
}

function partitionSediPipqRighe(rows: SediPipqRiga[]): { groups: SediPipqRiga[][]; escluseAltriTipi: number } {
  const map = new Map<string, SediPipqRiga[]>();
  let escluseAltriTipi = 0;
  rows.forEach((row, idx) => {
    if (!isTipoCaricabile(row.TipoTit || row.TipoDoc)) {
      escluseAltriTipi += 1;
      return;
    }
    const numero = normalizeNumeroPolizza(row.Polizza) || `__vuoto_${idx}`;
    const comp = mapCompagniaCodiceSede(row.CdComp) || `UNK${idx}`;
    const cli = fileClienteKey(row.CdClie) || `CLI${idx}`;
    const key = `${numero}|${comp}|${cli}`;
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  });
  return { groups: [...map.values()], escluseAltriTipi };
}

export function resolveSediPipqGruppo(
  rows: SediPipqRiga[],
  catalogs: SediPipqCatalogs,
  seq = 1,
): SediPipqGruppo {
  const parsed = rows.map((r) => parseRow(r, catalogs)).sort(byGaranzia);
  const first = parsed[0];
  const chiave = `sede:${first?.numero || seq}:${first?.compagniaCodice || "?"}:${first?.codiceCliente || "?"}`;
  if (!first) return skipGroup(`sede:${seq}`, "Gruppo vuoto", parsed);
  if (!first.numero) return skipGroup(chiave, "Numero polizza vuoto", parsed);
  if (!first.compagniaCodice) return skipGroup(chiave, "Compagnia vuota", parsed);
  if (!first.compagniaId) {
    return skipGroup(chiave, `Compagnia non in anagrafica (${first.compagniaCodice})`, parsed);
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

  let madre: SediPipqTitolo;
  let quietanzeSource = pq;
  if (pi.length) {
    madre = fillFromParsed("polizza", pi[0], catalogs, {
      chiave: `${chiave}:madre`,
      numeroTitolo: numero,
      riga: 0,
      motivo: "Polizza da PI",
      cassa: true,
    });
  } else {
    const source = pq[0];
    madre = fillFromParsed("polizza", source, catalogs, {
      chiave: `${chiave}:madre`,
      numeroTitolo: numero,
      riga: 0,
      motivo: "Polizza promossa da PQ",
      cassa: true,
      promossaDaPq: true,
    });
    quietanzeSource = pq.slice(1);
  }
  madre.clienteId = first.clienteId;

  const quietanze = quietanzeSource.map((row, idx) =>
    fillFromParsed("quietanza", row, catalogs, {
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
    compagniaCodice: first.compagniaCodice,
    madre,
    quietanze,
  };
}

export function planSediPipqPolizze(rows: SediPipqRiga[], catalogs: SediPipqCatalogs): {
  gruppi: SediPipqGruppo[];
  daCreare: SediPipqTitolo[];
  saltati: SediPipqGruppo[];
  stats: Record<string, number>;
} {
  const { groups, escluseAltriTipi } = partitionSediPipqRighe(rows);
  const gruppi = groups.map((g, i) => resolveSediPipqGruppo(g, catalogs, i + 1));
  const daCreare: SediPipqTitolo[] = [];
  const saltati: SediPipqGruppo[] = [];
  const stats: Record<string, number> = {
    gruppi: gruppi.length,
    madri: 0,
    madriDaPq: 0,
    quietanze: 0,
    saltati: 0,
    escluseAltriTipi,
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
      if (g.madre.promossaDaPq) stats.madriDaPq += 1;
    }
    daCreare.push(...g.quietanze);
    stats.quietanze += g.quietanze.length;
  }
  return { gruppi, daCreare, saltati, stats };
}

export { excelSerialToIso, mapRateToFrazionamento, money, trimTxt };
