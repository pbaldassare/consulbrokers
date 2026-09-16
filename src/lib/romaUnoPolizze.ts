/**
 * Mapping PortafoglioClienti_CB.xlsx (filiale RM) → titoli CBnet Roma Uno.
 *
 * Una riga Excel = polizza viva: si crea la madre + la quietanza in corso
 * (Ult_Garanzia/Ult_Scadenza) e le rate future fino a Scadenza.
 * Non si inventa lo storico dalle origini.
 */

import { derivaFrazionamentoDaRate, frazionamentoMesi } from "@/lib/frazionamento";

export const ROMA_UNO_UFFICIO_ID = "cdb3a9e1-2603-4147-819e-2bf5729c6731";
export const ROMA_UNO_UFFICIO_CODICE = "009";

export const CLIENTE_ALIAS: Record<string, string> = {
  "013275": "RM1-013132", // SGS HOLDING → SAGA (stessa P.IVA)
  "013288": "RM2-17460", // LONGO EMANUELE
  "013507": "RM1-013082", // STUDIO LEGALE GHERA → DITTA GHERA FEDERICO
  "013591": "RM1-013122", // ATI ARTEDIL codice diverso
  "013611": "RM1-013079", // VIS CINECITTÀ → Cinecittà
  "013934": "RM1-013132", // VIS SGS → SAGA
  "013935": "RM1-013324", // VIS ELLED
  "014034": "RM1-013388", // VIS QUALITY LAB
  "014496": "RM1-013066", // ATI PAONESSA / CONSORZIO → ATI PAONESSA / BARATELLA
};

export const PRODUTTORE_ALIAS: Record<string, string> = {
  "MUTTIASS S.R.L.": "MUTTIASS S.r.l.",
  "INTERFIDI SRL": "INTERFIDI S.R.L.",
  "INTERFIDI S.R.L.": "INTERFIDI S.R.L.",
  "CONSULBROKERS DIGITAL SRL": "Consulbrokers Digital Srl",
  "BALLERINI CURZIO": "BALLERINI CURZIO",
  "SCARPA MAURO/MUTTIASS S.R.L.": "SCARPA COSIMO DOMENICO MAURO",
  "DI PIAZZA SANDRO/MUTTIASS S.R.L.": "DI PIAZZA SANDRO",
  "CESCOT/BALLERINI CURZIO": "BALLERINI CURZIO",
};

export type RomaUnoCliente = {
  id: string;
  codice_cliente: string | null;
  ragione_sociale?: string | null;
  partita_iva?: string | null;
  codice_fiscale?: string | null;
  codice_fiscale_azienda?: string | null;
};

export type RomaUnoRamo = {
  id: string;
  codice: string;
  descrizione?: string | null;
  attivo?: boolean | null;
  gruppo_ramo_id?: string | null;
  gruppo_codice?: string | null;
  gruppo_descrizione?: string | null;
};

export type RomaUnoCompagnia = {
  id: string;
  nome: string;
  tipo?: string | null;
  codice?: string | null;
  gruppo?: string | null;
};

export type RomaUnoProduttore = {
  id: string;
  nome?: string | null;
  cognome?: string | null;
};

export type RomaUnoExcelRiga = {
  id?: string | number | null;
  stato?: string | null;
  codice?: string | null;
  nome?: string | null;
  polizza?: string | null;
  gruppo?: string | null;
  ramo?: string | null;
  compagnia?: string | null;
  premio?: unknown;
  provvigioni?: unknown;
  effetto?: unknown;
  scadenza?: unknown;
  ultGaranzia?: unknown;
  ultScadenza?: unknown;
  rinnovo?: string | null;
  fraz?: unknown;
  delega?: unknown;
  produttore?: string | null;
  ae?: string | null;
  specialist?: string | null;
  brand?: string | null;
};

export type RomaUnoTitoloRisolto = {
  excelId: string;
  tipo: "polizza" | "quietanza";
  esito: "da_creare" | "saltata";
  motivo: string;
  numeroTitolo: string;
  numeroExcel: string;
  riga: number;
  stato: string;
  clienteId: string | null;
  compagniaId: string | null;
  ramoId: string | null;
  produttoreId: string | null;
  produttoreNome: string | null;
  garanziaDa: string | null;
  garanziaA: string | null;
  durataDa: string | null;
  durataA: string | null;
  dataScadenza: string | null;
  dataCompetenza: string | null;
  premioLordo: number;
  provvigioni: number;
  frazionamento: string;
  rate: number;
  percentualeRiparto: number;
  tacitoRinnovo: boolean;
  riformaAllaScadenza: boolean;
  sostituiscePolizza: string | null;
  sostituisceRiga: number | null;
  aeNome: string | null;
  specialist: string | null;
  note: string | null;
  prodottoNome: string | null;
  idLegacy: number | null;
};

function normSpace(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normKey(value: string | null | undefined): string {
  return normSpace(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[`'’]/g, "")
    .toUpperCase();
}

export function normRamoKey(value: string | null | undefined): string {
  return normKey(value)
    .replace(/R\.\s*C\.\s*/g, "RC ")
    .replace(/[^A-Z0-9/&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function money(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = Number(String(value).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Date Excel di questo file arrivano in US (m/d/yy) con raw:false. */
export function parseExcelDateUs(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = normSpace(String(value));
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!us) return null;
  let year = Number(us[3]);
  if (year < 100) year += year <= 29 ? 2000 : 1900;
  const month = Number(us[1]);
  const day = Number(us[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeNumeroPolizza(raw: string | null | undefined): string {
  return normSpace(raw).replace(/\.+$/g, "");
}

export function isVoucherNumero(raw: string | null | undefined): boolean {
  return normKey(raw).includes("VOUCHER");
}

export function mapFrazionamentoCb(fraz: unknown): { frazionamento: string; rate: number } {
  const n = Number(fraz);
  if (n === 12) return { frazionamento: "Mensile", rate: 12 };
  if (n === 4) return { frazionamento: "Trimestrale", rate: 4 };
  if (n === 3) return { frazionamento: "Quadrimestrale", rate: 3 };
  if (n === 2) return { frazionamento: "Semestrale", rate: 2 };
  if (n === 1) return { frazionamento: "Annuale", rate: 1 };
  return { frazionamento: derivaFrazionamentoDaRate(n || 1, 1), rate: n > 0 ? n : 1 };
}

export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

export function futureQuietanzaWindows(
  fromExclusive: string,
  until: string,
  frazionamento: string,
): Array<{ garanziaDa: string; garanziaA: string }> {
  const mesi = frazionamentoMesi(frazionamento, 1);
  if (mesi <= 0 || mesi > 12) return [];
  const out: Array<{ garanziaDa: string; garanziaA: string }> = [];
  let da = fromExclusive;
  while (da < until) {
    let a = addMonthsIso(da, mesi);
    if (a > until) a = until;
    if (a <= da) break;
    out.push({ garanziaDa: da, garanziaA: a });
    da = a;
  }
  return out;
}

export function resolveRomaUnoCliente(
  codiceExcel: string | null | undefined,
  clienti: RomaUnoCliente[],
): RomaUnoCliente | null {
  const code = normSpace(codiceExcel).padStart(6, "0");
  if (!code) return null;
  const wanted = CLIENTE_ALIAS[code] ?? `RM1-${code}`;
  const byCode = clienti.find((c) => normKey(c.codice_cliente) === normKey(wanted));
  if (byCode) return byCode;
  return clienti.find((c) => normKey(c.codice_cliente) === normKey(`RM1-${code}`)) ?? null;
}

export function resolveRomaUnoRamo(
  gruppo: string | null | undefined,
  ramo: string | null | undefined,
  catalogo: RomaUnoRamo[],
): RomaUnoRamo | null {
  const gKey = normRamoKey(gruppo);
  const rKey = normRamoKey(ramo);
  if (!rKey) return null;
  const sameGruppo = catalogo.filter((r) => !gKey || normRamoKey(r.gruppo_descrizione) === gKey);
  const pool = sameGruppo.length ? sameGruppo : catalogo;
  const exact = pool.filter((r) => normRamoKey(r.descrizione) === rKey);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    const preferred = exact.find((r) => r.codice === "NC") ?? exact.find((r) => r.attivo !== false);
    return preferred ?? exact[0];
  }
  return null;
}

function scoreNome(hay: string, needle: string): number {
  if (!needle || needle.length < 4) return 0;
  if (hay === needle) return 1000 + needle.length;
  if (hay.includes(needle)) return 400 + needle.length;
  if (needle.includes(hay) && hay.length >= 8) return 200 + hay.length;
  return 0;
}

export function resolveRomaUnoCompagnia(
  excelNome: string | null | undefined,
  catalogo: RomaUnoCompagnia[],
): { compagnia: RomaUnoCompagnia | null; via: string } {
  const raw = normKey(excelNome);
  if (!raw) return { compagnia: null, via: "vuota" };

  let best: { row: RomaUnoCompagnia; score: number; via: string } | null = null;
  for (const row of catalogo) {
    const nome = normKey(row.nome);
    const score = scoreNome(raw, nome);
    if (score > (best?.score ?? 0)) best = { row, score, via: score >= 1000 ? "esatto" : "contenuto" };
  }
  if (best && best.score >= 200) return { compagnia: best.row, via: best.via };

  const tokens = [
    "ACQUI TERME",
    "ASSISUD",
    "DUAL ITALIA",
    "ETISICURA",
    "GERENZA DI ROMA",
    "GERENZA NORD EST",
    "ASPEVI MILANO",
    "ASPEVI",
    "FURNESS",
    "OLIMPIA",
    "TUA ASSICURAZIONI",
    "ASSICURATI SRL",
    "INSURANCE PLACEMENT",
    "DL ASSISERVICE",
    "CASU ALDO",
    "BENACQUISTA",
    "CLODIO",
    "FINITAL",
    "AMTRUST",
    "REVO",
    "LIBERTY MUTUAL",
    "ROLAND",
    "UNISALUTE",
    "POSTE ASSICURA",
    "METLIFE",
    "CHUBB",
    "ARGOGLOBAL",
    "CNA",
    "EUROP ASSISTANCE",
    "ITAS MUTUA",
    "DAS",
  ];
  for (const token of tokens) {
    if (!raw.includes(token)) continue;
    const hit = catalogo.find((c) => normKey(c.nome).includes(token));
    if (hit) return { compagnia: hit, via: `token:${token}` };
  }

  const brandFallbacks: Array<[string, string]> = [
    ["ALLIANZ", "ALLIANZ"],
    ["GENERALI", "GENERALI"],
    ["ZURICH", "ZURICH"],
    ["REALE MUTUA", "REALE"],
    ["AXA", "AXA"],
    ["HDI", "HDI"],
    ["VITTORIA", "VITTORIA"],
    ["GROUPAMA", "GROUPAMA"],
    ["UNIPOLSAI", "UNIPOL"],
    ["UNIPOL", "UNIPOL"],
    ["AIG", "AIG"],
    ["HELVETIA", "HELVETIA"],
    ["TOKIO MARINE", "TOKIO"],
    ["NOBIS", "NOBIS"],
  ];
  for (const [excelTok, catTok] of brandFallbacks) {
    if (!raw.includes(excelTok)) continue;
    const direzione = catalogo.find(
      (c) => normKey(c.nome).includes(catTok) && String(c.tipo || "").toLowerCase() === "direzione",
    );
    const any = catalogo.find((c) => normKey(c.nome).includes(catTok));
    const hit = direzione ?? any;
    if (hit) return { compagnia: hit, via: `brand:${excelTok}` };
  }
  return { compagnia: null, via: "sconosciuta" };
}

export function resolveRomaUnoProduttore(
  excelNome: string | null | undefined,
  produttori: RomaUnoProduttore[],
): RomaUnoProduttore | null {
  const key = normKey(excelNome);
  if (!key) return null;
  const aliased = PRODUTTORE_ALIAS[key] ?? excelNome;
  const want = normKey(aliased);
  return (
    produttori.find((p) => normKey(p.cognome) === want) ||
    produttori.find((p) => normKey(`${p.nome ?? ""} ${p.cognome ?? ""}`) === want) ||
    null
  );
}

function noteParts(parts: Array<string | null | undefined>): string | null {
  const rows = parts.map((p) => normSpace(p)).filter(Boolean);
  return rows.length ? rows.join(" | ") : null;
}

export function resolveRomaUnoPolizza(
  excel: RomaUnoExcelRiga,
  catalogs: {
    clienti: RomaUnoCliente[];
    rami: RomaUnoRamo[];
    compagnie: RomaUnoCompagnia[];
    produttori: RomaUnoProduttore[];
    duplicateNumbers: Set<string>;
  },
): RomaUnoTitoloRisolto[] {
  const numeroExcel = normalizeNumeroPolizza(excel.polizza);
  const codice = normSpace(excel.codice).padStart(6, "0");
  const { frazionamento, rate } = mapFrazionamentoCb(excel.fraz);
  const effetto = parseExcelDateUs(excel.effetto);
  const scadenza = parseExcelDateUs(excel.scadenza);
  const ultDa = parseExcelDateUs(excel.ultGaranzia) ?? effetto;
  const ultA = parseExcelDateUs(excel.ultScadenza) ?? scadenza;
  const cliente = resolveRomaUnoCliente(codice, catalogs.clienti);
  const ramo = resolveRomaUnoRamo(excel.gruppo, excel.ramo, catalogs.rami);
  const { compagnia, via } = resolveRomaUnoCompagnia(excel.compagnia, catalogs.compagnie);
  const produttore = resolveRomaUnoProduttore(excel.produttore, catalogs.produttori);
  const premio = money(excel.premio);
  const provvigioni = money(excel.provvigioni);
  const delega = money(excel.delega) || 100;
  const rinnovo = normSpace(excel.rinnovo);
  const tacito = /^tacito/i.test(rinnovo);
  const riforma = /riformare/i.test(rinnovo);
  const idLegacy = excel.id != null && String(excel.id).trim() ? Number(excel.id) : null;

  let numeroTitolo = numeroExcel;
  if (catalogs.duplicateNumbers.has(normKey(numeroExcel)) && codice) {
    numeroTitolo = `${numeroExcel}-${codice}`;
  }

  const base = {
    excelId: String(excel.id ?? numeroExcel),
    numeroTitolo,
    numeroExcel,
    stato: "attivo",
    clienteId: cliente?.id ?? null,
    compagniaId: compagnia?.id ?? null,
    ramoId: ramo?.id ?? null,
    produttoreId: produttore?.id ?? null,
    produttoreNome: produttore ? (produttore.cognome || produttore.nome || null) : normSpace(excel.produttore) || null,
    premioLordo: premio,
    provvigioni,
    frazionamento,
    rate,
    percentualeRiparto: delega,
    tacitoRinnovo: tacito,
    riformaAllaScadenza: riforma,
    aeNome: normSpace(excel.ae) || null,
    specialist: normSpace(excel.specialist) || null,
    prodottoNome: normSpace(excel.ramo) || null,
    idLegacy: Number.isFinite(idLegacy) ? idLegacy : null,
  };

  const skip: string[] = [];
  if (isVoucherNumero(numeroExcel)) skip.push("Voucher, non è un titolo");
  if (!numeroExcel) skip.push("Numero polizza vuoto");
  if (!cliente) skip.push(`Cliente non trovato (${codice || excel.nome})`);
  if (!ramo) skip.push(`Ramo non mappato (${excel.gruppo} | ${excel.ramo})`);
  if (!effetto || !scadenza) skip.push("Date effetto/scadenza mancanti");
  if (!ultDa || !ultA) skip.push("Date quietanza (Ult_Garanzia/Ult_Scadenza) mancanti");

  const note = noteParts([
    `Import PortafoglioClienti_CB Roma Uno`,
    excel.nome ? `Cliente Excel: ${normSpace(excel.nome)}` : null,
    excel.compagnia ? `Compagnia Excel: ${normSpace(excel.compagnia)} (${via})` : null,
    !compagnia && excel.compagnia ? "Compagnia catalogo assente: titolo creato senza compagnia_id" : null,
    rinnovo ? `Rinnovo Excel: ${rinnovo}` : null,
    numeroTitolo !== numeroExcel ? `Numero Excel originale: ${numeroExcel}` : null,
    CLIENTE_ALIAS[codice] ? `Cliente Excel ${codice} → ${CLIENTE_ALIAS[codice]}` : null,
  ]);

  const madre: RomaUnoTitoloRisolto = {
    ...base,
    tipo: "polizza",
    esito: skip.length ? "saltata" : "da_creare",
    motivo: skip.length ? skip.join("; ") : "Polizza Roma Uno",
    riga: 1,
    garanziaDa: ultDa,
    garanziaA: ultA,
    durataDa: effetto,
    durataA: scadenza,
    dataScadenza: scadenza,
    dataCompetenza: ultDa,
    sostituiscePolizza: null,
    sostituisceRiga: null,
    note,
  };

  if (madre.esito === "saltata") return [madre];

  const current: RomaUnoTitoloRisolto = {
    ...madre,
    tipo: "quietanza",
    motivo: "Quietanza in corso Excel",
    riga: 2,
    dataScadenza: ultA,
    dataCompetenza: ultDa,
    durataDa: effetto,
    durataA: scadenza,
    sostituiscePolizza: numeroTitolo,
    sostituisceRiga: 1,
  };

  const futures = futureQuietanzaWindows(ultA!, scadenza!, frazionamento).map((w, i) => ({
    ...current,
    motivo: "Quietanza futura da frazionamento",
    riga: 3 + i,
    garanziaDa: w.garanziaDa,
    garanziaA: w.garanziaA,
    dataCompetenza: w.garanziaDa,
    dataScadenza: w.garanziaA,
  }));

  return [madre, current, ...futures];
}
