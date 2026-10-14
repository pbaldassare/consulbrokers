import * as XLSX from "xlsx";
import { format } from "date-fns";
import { formatTipoSinistro } from "@/lib/tipiSinistro";
import { isSinistroAperto, labelStatoSinistro } from "@/lib/sinistriStati";
import { formatDateIT } from "@/lib/formatDate";
import { resolveClienteNome, type ClienteEcAnagrafica } from "@/lib/ecClienteAnagrafica";

export type SinistroReportRow = {
  id?: string;
  numero_sinistro?: string | null;
  stato?: string | null;
  tipo_sinistro?: string | null;
  tipo_sinistro_personalizzato?: string | null;
  data_evento?: string | null;
  data_apertura?: string | null;
  data_denuncia?: string | null;
  citta_sinistro?: string | null;
  provincia_sinistro?: string | null;
  luogo_sinistro?: string | null;
  indirizzo_sinistro?: string | null;
  importo_riserva?: number | null;
  importo_liquidato?: number | null;
  compagnia_id?: string | null;
  compagnie?: { nome?: string | null } | null;
  controparte?: string | null;
  targa_veicolo?: string | null;
  numero_polizza?: string | null;
  clienti?: ClienteEcAnagrafica | ClienteEcAnagrafica[] | null;
};

function clienteNome(s: SinistroReportRow): string {
  const c = Array.isArray(s.clienti) ? s.clienti[0] : s.clienti;
  return resolveClienteNome(c);
}

export type ZonaAgg = {
  name: string;
  sinistri: number;
  aperti: number;
  chiusi: number;
  riserva: number;
  liquidato: number;
};

export type FrequenzaAgg = {
  key: string;
  label: string;
  sinistri: number;
  aperti: number;
  chiusi: number;
};

export type CountAgg = {
  name: string;
  value: number;
};

export type StackTipoAgg = {
  name: string;
  aperti: number;
  chiusi: number;
};

export type SinistriReportKpi = {
  totale: number;
  aperti: number;
  chiusi: number;
  conZona: number;
  riserva: number;
  liquidato: number;
};

const MESI_IT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

function normalizeLabel(raw?: string | null): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

function money(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function monthKey(iso?: string | null): string | null {
  const s = String(iso ?? "").trim().slice(0, 7);
  return /^\d{4}-\d{2}$/.test(s) ? s : null;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MESI_IT[Number(m) - 1] || m} ${y}`;
}

function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Zona = luogo/quartiere, poi città, poi provincia. */
export function resolveZonaSinistro(s: SinistroReportRow): string {
  const luogo = normalizeLabel(s.luogo_sinistro);
  const citta = normalizeLabel(s.citta_sinistro);
  const prov = normalizeLabel(s.provincia_sinistro);
  if (luogo && citta && luogo.toLocaleLowerCase("it") !== citta.toLocaleLowerCase("it")) {
    return `${luogo} — ${citta}`;
  }
  if (luogo) return luogo;
  if (citta) return citta;
  if (prov) return `Prov. ${prov}`;
  return "Non specificato";
}

export function buildSinistriReportKpi(rows: SinistroReportRow[]): SinistriReportKpi {
  let aperti = 0;
  let chiusi = 0;
  let conZona = 0;
  let riserva = 0;
  let liquidato = 0;
  for (const s of rows) {
    if (isSinistroAperto(s.stato)) aperti += 1;
    else chiusi += 1;
    if (resolveZonaSinistro(s) !== "Non specificato") conZona += 1;
    riserva += money(s.importo_riserva);
    liquidato += money(s.importo_liquidato);
  }
  return { totale: rows.length, aperti, chiusi, conZona, riserva, liquidato };
}

function emptyZona(name: string): ZonaAgg {
  return { name, sinistri: 0, aperti: 0, chiusi: 0, riserva: 0, liquidato: 0 };
}

function addToZona(cur: ZonaAgg, s: SinistroReportRow) {
  cur.sinistri += 1;
  if (isSinistroAperto(s.stato)) cur.aperti += 1;
  else cur.chiusi += 1;
  cur.riserva += money(s.importo_riserva);
  cur.liquidato += money(s.importo_liquidato);
}

export function aggregatePerZona(rows: SinistroReportRow[]): ZonaAgg[] {
  const map = new Map<string, ZonaAgg>();
  for (const s of rows) {
    const name = resolveZonaSinistro(s);
    const cur = map.get(name) || emptyZona(name);
    addToZona(cur, s);
    map.set(name, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.sinistri - a.sinistri || a.name.localeCompare(b.name, "it"));
}

/** Primi N + riga Altre, per il grafico. */
export function topZonaChart(rows: ZonaAgg[], limit = 12): ZonaAgg[] {
  if (rows.length <= limit) return rows;
  const head = rows.slice(0, limit);
  const altre = emptyZona("Altre");
  for (const r of rows.slice(limit)) {
    altre.sinistri += r.sinistri;
    altre.aperti += r.aperti;
    altre.chiusi += r.chiusi;
    altre.riserva += r.riserva;
    altre.liquidato += r.liquidato;
  }
  return [...head, altre];
}

export function aggregateFrequenzaMensile(rows: SinistroReportRow[]): FrequenzaAgg[] {
  const map = new Map<string, FrequenzaAgg>();
  let min: string | null = null;
  let max: string | null = null;
  for (const s of rows) {
    const key = monthKey(s.data_evento) || monthKey(s.data_apertura);
    if (!key) continue;
    if (!min || key < min) min = key;
    if (!max || key > max) max = key;
    const cur = map.get(key) || { key, label: monthLabel(key), sinistri: 0, aperti: 0, chiusi: 0 };
    cur.sinistri += 1;
    if (isSinistroAperto(s.stato)) cur.aperti += 1;
    else cur.chiusi += 1;
    map.set(key, cur);
  }
  if (!min || !max) return [];

  const out: FrequenzaAgg[] = [];
  for (let k = min; ; k = nextMonthKey(k)) {
    out.push(map.get(k) || { key: k, label: monthLabel(k), sinistri: 0, aperti: 0, chiusi: 0 });
    if (k === max) break;
    if (out.length > 120) break;
  }
  return out;
}

export function aggregatePerStato(rows: SinistroReportRow[]): CountAgg[] {
  const map = new Map<string, number>();
  for (const s of rows) {
    const name = labelStatoSinistro(s.stato);
    map.set(name, (map.get(name) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "it"));
}

export function aggregatePerTipo(rows: SinistroReportRow[]): StackTipoAgg[] {
  const map = new Map<string, StackTipoAgg>();
  for (const s of rows) {
    const name = formatTipoSinistro(s);
    const cur = map.get(name) || { name, aperti: 0, chiusi: 0 };
    if (isSinistroAperto(s.stato)) cur.aperti += 1;
    else cur.chiusi += 1;
    map.set(name, cur);
  }
  return Array.from(map.values()).sort((a, b) => (b.aperti + b.chiusi) - (a.aperti + a.chiusi));
}

export function aggregatePerCompagnia(rows: SinistroReportRow[], limit = 10): CountAgg[] {
  const map = new Map<string, number>();
  for (const s of rows) {
    const name = normalizeLabel(s.compagnie?.nome) || "Senza compagnia";
    map.set(name, (map.get(name) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "it"))
    .slice(0, limit);
}

export function buildSinistriReportSheets(rows: SinistroReportRow[]) {
  const kpi = buildSinistriReportKpi(rows);
  const zona = aggregatePerZona(rows);
  const frequenza = aggregateFrequenzaMensile(rows);
  const tipo = aggregatePerTipo(rows);
  const stato = aggregatePerStato(rows);

  return {
    riepilogo: [
      { Indicatore: "Sinistri", Valore: kpi.totale },
      { Indicatore: "Aperti", Valore: kpi.aperti },
      { Indicatore: "Chiusi", Valore: kpi.chiusi },
      { Indicatore: "Con zona / luogo", Valore: kpi.conZona },
      { Indicatore: "Riserva €", Valore: kpi.riserva },
      { Indicatore: "Liquidato €", Valore: kpi.liquidato },
    ],
    zona: zona.map((z) => ({
      Zona: z.name,
      Sinistri: z.sinistri,
      Aperti: z.aperti,
      Chiusi: z.chiusi,
      "Riserva €": z.riserva,
      "Liquidato €": z.liquidato,
    })),
    frequenza: frequenza.map((f) => ({
      Mese: f.label,
      Sinistri: f.sinistri,
      Aperti: f.aperti,
      Chiusi: f.chiusi,
    })),
    tipo: tipo.map((t) => ({
      Tipo: t.name,
      Aperti: t.aperti,
      Chiusi: t.chiusi,
      Totale: t.aperti + t.chiusi,
    })),
    stato: stato.map((s) => ({ Stato: s.name, Sinistri: s.value })),
    dettaglio: rows.map((s) => ({
      "N° Sinistro": s.numero_sinistro || "",
      Cliente: clienteNome(s),
      Stato: labelStatoSinistro(s.stato),
      Tipo: formatTipoSinistro(s),
      "Data accadimento": formatDateIT(s.data_evento),
      "Data apertura": formatDateIT(s.data_apertura),
      Zona: resolveZonaSinistro(s),
      Città: s.citta_sinistro || "",
      Provincia: s.provincia_sinistro || "",
      Luogo: s.luogo_sinistro || "",
      Indirizzo: s.indirizzo_sinistro || "",
      Compagnia: s.compagnie?.nome || "",
      Polizza: s.numero_polizza || "",
      Controparte: s.controparte || "",
      Targa: s.targa_veicolo || "",
      "Riserva €": s.importo_riserva ?? "",
      "Liquidato €": s.importo_liquidato ?? "",
    })),
  };
}

export function exportSinistriReportXlsx(rows: SinistroReportRow[]) {
  const sheets = buildSinistriReportSheets(rows);
  const wb = XLSX.utils.book_new();
  const names: Array<[keyof typeof sheets, string]> = [
    ["riepilogo", "Riepilogo"],
    ["zona", "Per zona"],
    ["frequenza", "Frequenza"],
    ["tipo", "Per tipo"],
    ["stato", "Per stato"],
    ["dettaglio", "Dettaglio"],
  ];
  for (const [key, title] of names) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheets[key]), title);
  }
  XLSX.writeFile(wb, `report_sinistri_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
}
