/**
 * AM / PR / PS / DP / AP sui portafogli già importati (Milano, Potenza, Parma).
 *
 * - AM / AP → titolo appendice di modifica sulla polizza già presente
 * - PR → titolo regolazione (messa a cassa se c'è Dt Incasso)
 * - PS → storno: marca il corrispondente e inserisce il titolo negativo
 * - DP → non è un titolo: rettifica le provvigioni della polizza collegata
 */
import {
  excelSerialToIso,
  money,
  normalizeNumeroPolizza,
  trimTxt,
} from "@/lib/campobassoPolizze";
import { frazionamentoToRate } from "@/lib/frazionamento";
import { mapRateToFrazionamento } from "@/lib/campobassoPolizze";

export const SEDI_EXTRA_UFFICI = {
  MI: { filiale: "MI", ufficioId: "193e0821-4105-4ad6-a72e-0ebb6c116797" },
  PZ: { filiale: "PZ", ufficioId: "e4f0d1f5-e344-4920-b178-d8754904a108" },
  PR: { filiale: "PR", ufficioId: "a0d09b81-777d-43be-9615-e9d051786e2c" },
} as const;

export type SedeExtraCodice = keyof typeof SEDI_EXTRA_UFFICI;

export const SEDI_EXTRA_COMPAGNIA_ALIAS: Record<string, string> = {
  VIT000: "VIT104",
};

export const SEDI_EXTRA_TIPI = new Set(["AM", "PR", "PS", "DP", "AP"]);

const STOPWORDS = new Set([
  "DI", "DEL", "DELLA", "DELLE", "DEI", "DEGLI", "E", "C", "SAS", "SRL", "SRLS",
  "SPA", "SNC", "SS", "SOC", "COOP", "COOPERATIVA", "SOCIETA", "SOCIETÀ", "&",
  "THE", "DA", "IN",
]);

export function normalizeDenominazione(raw: unknown): string {
  return trimTxt(raw)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function denominazioneKeys(raw: unknown): string[] {
  const n = normalizeDenominazione(raw);
  if (!n) return [];
  const tokens = n.split(" ").filter((w) => w.length > 1 && !STOPWORDS.has(w));
  const meaningful = tokens.length ? tokens : n.split(" ").filter(Boolean);
  const sorted = [...meaningful].sort().join(" ");
  return [...new Set([n, sorted, meaningful.join(" ")].filter(Boolean))];
}

export function buildClienteNameIndex(
  rows: Array<{ id: string; ragione?: string | null; nome?: string | null; cognome?: string | null }>,
): Map<string, string> {
  const counts = new Map<string, Set<string>>();
  const add = (key: string, id: string) => {
    if (!key) return;
    const set = counts.get(key) ?? new Set<string>();
    set.add(id);
    counts.set(key, set);
  };
  for (const r of rows) {
    for (const key of denominazioneKeys(r.ragione)) add(key, r.id);
    const nc = `${trimTxt(r.nome)} ${trimTxt(r.cognome)}`;
    const cn = `${trimTxt(r.cognome)} ${trimTxt(r.nome)}`;
    for (const key of denominazioneKeys(nc)) add(key, r.id);
    for (const key of denominazioneKeys(cn)) add(key, r.id);
  }
  const index = new Map<string, string>();
  for (const [key, ids] of counts) {
    if (ids.size === 1) index.set(key, [...ids][0]);
  }
  return index;
}

export function matchClienteByNome(nomeFile: unknown, index: Map<string, string>): string | null {
  for (const key of denominazioneKeys(nomeFile)) {
    const id = index.get(key);
    if (id) return id;
  }
  return null;
}

export type SediExtraExistingTitolo = {
  id: string;
  numero_titolo: string;
  riga: number;
  filiale: string;
  ufficio_id: string;
  compagnia_id: string;
  cliente_anagrafica_id: string | null;
  premio_lordo: number;
  stato: string;
  sostituisce_polizza: string | null;
  garanzia_da: string | null;
  id_legacy: number | null;
  is_appendice_modifica?: boolean | null;
  is_regolazione?: boolean | null;
  provvigioni_firma?: number | null;
  provvigioni_quietanza?: number | null;
};

export type SediExtraCatalogs = {
  compagnieByCodice: Record<string, string>;
  ramiByCodice: Record<string, { id: string; descrizione: string }>;
  existing: SediExtraExistingTitolo[];
  clientiNameIndex?: Map<string, string>;
};

export type SediExtraRiga = Record<string, unknown>;

export type SediExtraAzione =
  | "insert_am"
  | "insert_ap"
  | "insert_pr"
  | "insert_ps"
  | "update_dp"
  | "skip";

export type SediExtraPianificato = {
  azione: SediExtraAzione;
  motivo: string;
  sede: SedeExtraCodice;
  fileTipo: string;
  fileId: string | null;
  numeroBase: string;
  numeroTitolo: string;
  riga: number;
  stato: "attivo" | "incassato" | "stornato";
  clienteId: string | null;
  compagniaId: string | null;
  ramoId: string | null;
  ufficioId: string;
  filiale: string;
  garanziaDa: string | null;
  garanziaA: string | null;
  durataDa: string | null;
  durataA: string | null;
  dataScadenza: string | null;
  dataCompetenza: string | null;
  dataMessaCassa: string | null;
  dataIncasso: string | null;
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
  isAppendiceModifica: boolean;
  isRegolazione: boolean;
  sostituiscePolizza: string | null;
  sostituisceRiga: number | null;
  madreId: string | null;
  targetId: string | null;
  dataStorno: string | null;
  clienteNome: string | null;
  descrizione: string | null;
  note: string | null;
  prodottoNome: string | null;
  specialist: string | null;
  aeNome: string | null;
  produttoreNome: string | null;
  tipoIncasso: string | null;
  contoIncasso: string | null;
  tipoPortafoglio: string | null;
  valuta: string;
  cambio: number;
  appendice: string | null;
  cigRif: string | null;
  idLegacy: number | null;
};

function normNumero(raw: unknown): string {
  return normalizeNumeroPolizza(raw).replace(/\.+$/, "").replace(/_+$/, "");
}

function mapCompagnia(raw: unknown, catalogs: SediExtraCatalogs): { codice: string; id: string | null } {
  const codice = SEDI_EXTRA_COMPAGNIA_ALIAS[trimTxt(raw).toUpperCase()] || trimTxt(raw).toUpperCase();
  return { codice, id: catalogs.compagnieByCodice[codice] ?? null };
}

function yearsBetween(from: string | null, to: string | null): number {
  if (!from || !to) return 1;
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return 1;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000 / 365));
}

export function matchExistingTitoli(
  existing: SediExtraExistingTitolo[],
  opts: { numero: string; compagniaId: string; ufficioId: string },
): SediExtraExistingTitolo[] {
  const n = normNumero(opts.numero);
  return existing.filter(
    (t) =>
      t.ufficio_id === opts.ufficioId &&
      t.compagnia_id === opts.compagniaId &&
      normNumero(t.numero_titolo) === n,
  );
}

export function pickCorrispondenteStorno(
  candidati: SediExtraExistingTitolo[],
  premioPs: number,
): SediExtraExistingTitolo | null {
  const abs = Math.abs(premioPs);
  const byImporto = candidati.filter((t) => Math.abs(Math.abs(Number(t.premio_lordo || 0)) - abs) < 0.05);
  const pool = byImporto.length ? byImporto : candidati;
  if (!pool.length) return null;
  const figlia = pool.find((t) => t.sostituisce_polizza);
  return figlia || pool.find((t) => !t.sostituisce_polizza) || pool[0];
}

function nextSuffix(existing: SediExtraExistingTitolo[], base: string, kind: "AM" | "RG"): number {
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/${kind}(\\d+)$`, "i");
  let max = 0;
  for (const t of existing) {
    const m = String(t.numero_titolo || "").match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function emptyPlan(partial: Partial<SediExtraPianificato> & Pick<SediExtraPianificato, "azione" | "motivo" | "sede" | "fileTipo">): SediExtraPianificato {
  const cfg = SEDI_EXTRA_UFFICI[partial.sede];
  return {
    numeroBase: "",
    numeroTitolo: "",
    riga: 0,
    stato: "attivo",
    clienteId: null,
    compagniaId: null,
    ramoId: null,
    ufficioId: cfg.ufficioId,
    filiale: cfg.filiale,
    garanziaDa: null,
    garanziaA: null,
    durataDa: null,
    durataA: null,
    dataScadenza: null,
    dataCompetenza: null,
    dataMessaCassa: null,
    dataIncasso: null,
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
    isAppendiceModifica: false,
    isRegolazione: false,
    sostituiscePolizza: null,
    sostituisceRiga: null,
    madreId: null,
    targetId: null,
    dataStorno: null,
    clienteNome: null,
    descrizione: null,
    note: null,
    prodottoNome: null,
    specialist: null,
    aeNome: null,
    produttoreNome: null,
    tipoIncasso: null,
    contoIncasso: null,
    tipoPortafoglio: null,
    valuta: "EUR",
    cambio: 1,
    appendice: null,
    cigRif: null,
    fileId: null,
    idLegacy: null,
    ...partial,
  };
}

function fillFromRow(
  riga: SediExtraRiga,
  sede: SedeExtraCodice,
  catalogs: SediExtraCatalogs,
  extra: Partial<SediExtraPianificato> & Pick<SediExtraPianificato, "azione" | "motivo" | "fileTipo">,
): SediExtraPianificato {
  const cfg = SEDI_EXTRA_UFFICI[sede];
  const { id: compagniaId } = mapCompagnia(riga.CdComp, catalogs);
  const ramoCodice = trimTxt(riga.CdRamo).toUpperCase();
  const ramo = ramoCodice ? catalogs.ramiByCodice[ramoCodice] : undefined;
  const premio = money(riga.Premio);
  const imponibile = money(riga.Imponibile);
  const tasse = money(riga.Tasse);
  const attive = money(riga.Attive);
  const garDa = excelSerialToIso(riga["Iniz Gar"]) || excelSerialToIso(riga["Iniz Pol"]);
  const garA = excelSerialToIso(riga["Scad Gar"]) || excelSerialToIso(riga["Scad Pol"]);
  const polDa = excelSerialToIso(riga["Iniz Pol"]) || garDa;
  const polA = excelSerialToIso(riga["Scad Pol"]) || garA;
  const dtInc = excelSerialToIso(riga["Dt Incasso"]);
  const frazionamento = mapRateToFrazionamento(riga.Rate);
  const hasCassa = !!dtInc;
  const fileId = trimTxt(riga.ID) || null;
  return emptyPlan({
    ...extra,
    sede,
    fileId,
    idLegacy: fileId && /^\d+$/.test(fileId) ? Number(fileId) : null,
    numeroBase: normNumero(riga.Polizza),
    compagniaId,
    ramoId: ramo?.id ?? null,
    ufficioId: cfg.ufficioId,
    filiale: cfg.filiale,
    garanziaDa: garDa,
    garanziaA: garA,
    durataDa: polDa,
    durataA: polA,
    dataScadenza: garA,
    dataCompetenza: garDa,
    dataMessaCassa: hasCassa ? dtInc : null,
    dataIncasso: hasCassa ? dtInc : null,
    importoIncassato: hasCassa ? premio : null,
    premioNetto: imponibile,
    premioLordo: premio,
    tasse,
    provvigioni: attive,
    frazionamento,
    rate: frazionamentoToRate(frazionamento, 1),
    anniDurata: yearsBetween(polDa, polA),
    percentualeRiparto: money(riga["%Riparto"]) || 100,
    tacitoRinnovo: trimTxt(riga.Rinnovo).toUpperCase() === "R",
    stato: extra.stato ?? (hasCassa ? "incassato" : "attivo"),
    clienteNome: trimTxt(riga["Nome CLiente"]) || null,
    dataStorno: extra.dataStorno ?? dtInc ?? garDa,
    descrizione: trimTxt(riga.Descrizione) || null,
    prodottoNome: trimTxt(riga.Ramo) || ramo?.descrizione || null,
    specialist: trimTxt(riga["Nome Specialist"]) || null,
    aeNome: trimTxt(riga["Nome A/E"]) || null,
    produttoreNome: trimTxt(riga["Nome Produttore"]) || null,
    tipoIncasso: hasCassa ? trimTxt(riga.TipoInc) || null : null,
    contoIncasso: hasCassa ? trimTxt(riga.ContoInc) || null : null,
    tipoPortafoglio: trimTxt(riga["Tipo Portafoglio"]) || null,
    appendice: trimTxt(riga.Appendice) || extra.fileTipo,
    cigRif: trimTxt(riga["Rif/Cig"]) || null,
    valuta: "EUR",
    cambio: money(riga.Cambio) || 1,
  });
}

export function planSediExtraRiga(
  riga: SediExtraRiga,
  sede: SedeExtraCodice,
  catalogs: SediExtraCatalogs,
  suffixUsed: Map<string, number>,
): SediExtraPianificato {
  const tipo = trimTxt(riga.TipoDoc || riga.TipoTit).toUpperCase();
  if (!SEDI_EXTRA_TIPI.has(tipo)) {
    return emptyPlan({ azione: "skip", motivo: `Tipo ${tipo} fuori perimetro`, sede, fileTipo: tipo });
  }
  const { id: compagniaId } = mapCompagnia(riga.CdComp, catalogs);
  if (!compagniaId) {
    return emptyPlan({
      azione: "skip",
      motivo: `Compagnia non in anagrafica (${trimTxt(riga.CdComp)})`,
      sede,
      fileTipo: tipo,
      numeroBase: normNumero(riga.Polizza),
    });
  }
  const numero = normNumero(riga.Polizza);
  if (!numero) {
    return emptyPlan({ azione: "skip", motivo: "Numero polizza vuoto", sede, fileTipo: tipo });
  }
  const cfg = SEDI_EXTRA_UFFICI[sede];
  const fileId = trimTxt(riga.ID) || null;
  const idLegacy = fileId && /^\d+$/.test(fileId) ? Number(fileId) : null;
  if (idLegacy != null && catalogs.existing.some((t) => t.ufficio_id === cfg.ufficioId && t.id_legacy === idLegacy)) {
    return emptyPlan({
      azione: "skip",
      motivo: `id_legacy ${idLegacy} già importato`,
      sede,
      fileTipo: tipo,
      numeroBase: numero,
      fileId,
      idLegacy,
    });
  }
  const candidati = matchExistingTitoli(catalogs.existing, {
    numero,
    compagniaId,
    ufficioId: cfg.ufficioId,
  });
  const madre = candidati.find((t) => !t.sostituisce_polizza && !t.is_appendice_modifica && !t.is_regolazione) || candidati[0] || null;
  const clienteDaNome = catalogs.clientiNameIndex
    ? matchClienteByNome(riga["Nome CLiente"], catalogs.clientiNameIndex)
    : null;

  if (tipo === "DP") {
    const target = madre || candidati[0] || null;
    if (!target) {
      return fillFromRow(riga, sede, catalogs, {
        azione: "skip",
        motivo: "DP senza polizza collegata",
        fileTipo: tipo,
        numeroTitolo: numero,
        clienteId: clienteDaNome,
        note: "Differenza provvigioni gestionale (DP): polizza collegata assente",
      });
    }
    return fillFromRow(riga, sede, catalogs, {
      azione: "update_dp",
      motivo: "Rettifica provvigioni (DP)",
      fileTipo: tipo,
      targetId: target.id,
      madreId: target.id,
      clienteId: target.cliente_anagrafica_id || clienteDaNome,
      numeroTitolo: target.numero_titolo,
      note: "Differenza provvigioni gestionale (DP): non è un titolo",
    });
  }

  if (tipo === "PS") {
    const target = pickCorrispondenteStorno(candidati, money(riga.Premio));
    if (!target) {
      return fillFromRow(riga, sede, catalogs, {
        azione: "insert_ps",
        motivo: "Storno senza corrispondente: si inserisce il titolo negativo",
        fileTipo: tipo,
        numeroTitolo: numero,
        riga: 1,
        sostituiscePolizza: numero,
        sostituisceRiga: 0,
        targetId: null,
        madreId: null,
        clienteId: clienteDaNome,
        note: "Storno gestionale PS: titolo corrispondente assente in CBnet",
      });
    }
    const maxRiga = Math.max(...candidati.map((t) => Number(t.riga || 0)), Number(target.riga || 0));
    return fillFromRow(riga, sede, catalogs, {
      azione: "insert_ps",
      motivo: "Storno: compensazione e annullo del corrispondente",
      fileTipo: tipo,
      numeroTitolo: target.numero_titolo,
      riga: maxRiga + 1,
      sostituiscePolizza: target.numero_titolo,
      sostituisceRiga: target.riga,
      targetId: target.id,
      madreId: madre?.id ?? target.id,
      clienteId: target.cliente_anagrafica_id || clienteDaNome,
      dataStorno: excelSerialToIso(riga["Dt Incasso"]) || excelSerialToIso(riga["Iniz Gar"]) || excelSerialToIso(riga["Iniz Pol"]),
      note: `Storno gestionale PS su ${target.numero_titolo} riga ${target.riga}`,
    });
  }

  const kind = tipo === "PR" ? "RG" : "AM";
  const suffixKey = `${cfg.ufficioId}|${compagniaId}|${numero}|${kind}`;
  const next = suffixUsed.get(suffixKey) ?? nextSuffix(candidati, numero, kind);
  suffixUsed.set(suffixKey, next + 1);
  const numeroTitolo = `${numero}/${kind}${next}`;
  const isReg = tipo === "PR";
  const azione = tipo === "PR" ? "insert_pr" : tipo === "AP" ? "insert_ap" : "insert_am";
  return fillFromRow(riga, sede, catalogs, {
    azione,
    motivo: madre
      ? `${tipo} su titolo già presente`
      : `${tipo} senza madre in CBnet: si crea comunque il titolo appendice`,
    fileTipo: tipo,
    numeroTitolo,
    riga: 1,
    isAppendiceModifica: !isReg,
    isRegolazione: isReg,
    sostituiscePolizza: madre ? madre.numero_titolo : numero,
    sostituisceRiga: madre ? madre.riga : 0,
    madreId: madre?.id ?? null,
    clienteId: madre?.cliente_anagrafica_id ?? clienteDaNome,
    targetId: madre?.id ?? null,
    note: madre
      ? `TipoDoc gestionale: ${tipo}`
      : `TipoDoc gestionale: ${tipo}\nPolizza madre assente in questo carico`,
  });
}

export function planSediExtraPolizze(
  rows: SediExtraRiga[],
  sede: SedeExtraCodice,
  catalogs: SediExtraCatalogs,
): { pianificati: SediExtraPianificato[]; stats: Record<string, number> } {
  const suffixUsed = new Map<string, number>();
  const pianificati: SediExtraPianificato[] = [];
  const stats: Record<string, number> = {
    AM: 0,
    PR: 0,
    PS: 0,
    DP: 0,
    AP: 0,
    skip: 0,
    altre: 0,
  };
  for (const riga of rows) {
    const tipo = trimTxt(riga.TipoDoc || riga.TipoTit).toUpperCase();
    if (!SEDI_EXTRA_TIPI.has(tipo)) {
      if (tipo) stats.altre += 1;
      continue;
    }
    const plan = planSediExtraRiga(riga, sede, catalogs, suffixUsed);
    pianificati.push(plan);
    if (plan.azione === "skip") stats.skip += 1;
    else stats[tipo] = (stats[tipo] || 0) + 1;
  }
  return { pianificati, stats };
}
