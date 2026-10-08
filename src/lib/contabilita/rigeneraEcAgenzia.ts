import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { buildECAgenziaPdf, type ECAgenziaData, type ECAgenziaTitolo } from "@/lib/ec-agenzia-pdf";
import { getProvvigioneEC } from "@/lib/getProvvigioneEC";
import { calcolaRitenutaAcconto, resolvePercentualeRA } from "@/lib/resolvePercentualeRA";
import { resolveCompagniaCollegataNome } from "@/lib/ecAgenziaDisplay";
import { buildTestoRicercaEcAgenzia, type EcAgenziaRigaArchivio } from "@/lib/contabilita/ecAgenziaArchivio";
import { logAttivita } from "@/lib/logAttivita";

/**
 * Rigenerazione di un E/C Agenzia già archiviato: stesso riferimento, data,
 * periodo e stesse righe (polizze/premi/clienti/MI), ricalcolando solo le
 * provvigioni con la regola corrente di `getProvvigioneEC`.
 */

type ArchivioRow = {
  id: string;
  documento_id: string;
  compagnia_id: string;
  riferimento: string | null;
  periodo_testo: string | null;
  data_estratto_conto: string | null;
  righe: EcAgenziaRigaArchivio[] | null;
};

type TitoloEc = {
  id: string;
  numero_titolo: string | null;
  riga: number | string | null;
  premio_lordo: number | null;
  pag_diretto_compagnia: boolean | null;
  provvigioni_firma: number | null;
  provvigioni_quietanza: number | null;
  sostituisce_polizza: string | null;
  garanzia_da: string | null;
  garanzia_a: string | null;
  durata_da: string | null;
  durata_a: string | null;
  ufficio_id: string | null;
  compagnia_rapporti: { percentuale_ra: number | null } | null;
  rami: { codice: string | null; descrizione: string | null } | null;
};

export type RigaDiff = { polizza: string; prima: number; dopo: number };

export type PianoRigenerazione = {
  archivio: ArchivioRow;
  righeNuove: EcAgenziaRigaArchivio[];
  titoliPerRiga: TitoloEc[];
  diff: RigaDiff[];
  mancanti: string[];
  totaleProvvPrima: number;
  totaleProvvDopo: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const chiaveRiga = (numero: string | null, riga: number | string | null) =>
  `${(numero || "").trim()}${riga ? " - " + riga : ""}`.trim();

async function fetchTitoliPerArchivio(a: ArchivioRow): Promise<Map<string, TitoloEc[]>> {
  const numeri = Array.from(
    new Set((a.righe || []).map((r) => (r.polizza || "").split(" - ")[0].trim()).filter(Boolean)),
  );
  const map = new Map<string, TitoloEc[]>();
  for (let i = 0; i < numeri.length; i += 100) {
    const chunk = numeri.slice(i, i + 100);
    const { data, error } = await supabase
      .from("titoli")
      .select(
        "id, numero_titolo, riga, premio_lordo, pag_diretto_compagnia, provvigioni_firma, provvigioni_quietanza, sostituisce_polizza, garanzia_da, garanzia_a, durata_da, durata_a, ufficio_id, compagnia_rapporti:compagnia_rapporto_id(percentuale_ra), rami:ramo_id(codice, descrizione)",
      )
      .eq("compagnia_id", a.compagnia_id)
      .eq("stato", "incassato")
      .in("numero_titolo", chunk);
    if (error) throw error;
    for (const t of (data || []) as unknown as TitoloEc[]) {
      const k = chiaveRiga(t.numero_titolo, t.riga);
      const arr = map.get(k) || [];
      arr.push(t);
      map.set(k, arr);
    }
  }
  return map;
}

export async function pianificaRigenerazione(a: ArchivioRow): Promise<PianoRigenerazione> {
  const titoliMap = await fetchTitoliPerArchivio(a);
  const righeNuove: EcAgenziaRigaArchivio[] = [];
  const titoliPerRiga: TitoloEc[] = [];
  const diff: RigaDiff[] = [];
  const mancanti: string[] = [];
  let prima = 0;
  let dopo = 0;

  for (const r of a.righe || []) {
    const candidati = titoliMap.get((r.polizza || "").trim()) || [];
    // Se più titoli condividono numero+riga, preferisci quello con premio coincidente.
    const t =
      candidati.find((c) => r2(c.pag_diretto_compagnia ? 0 : Number(c.premio_lordo) || 0) === r2(r.premio || 0)) ||
      candidati[0];
    prima += Number(r.provvigioni) || 0;
    if (!t) {
      mancanti.push(r.polizza);
      righeNuove.push(r);
      dopo += Number(r.provvigioni) || 0;
      continue;
    }
    const nuova = r2(getProvvigioneEC(t));
    if (r2(Number(r.provvigioni) || 0) !== nuova) {
      diff.push({ polizza: r.polizza, prima: Number(r.provvigioni) || 0, dopo: nuova });
    }
    righeNuove.push({ ...r, provvigioni: nuova });
    titoliPerRiga.push(t);
    dopo += nuova;
  }

  return {
    archivio: a,
    righeNuove,
    titoliPerRiga,
    diff,
    mancanti,
    totaleProvvPrima: r2(prima),
    totaleProvvDopo: r2(dopo),
  };
}

async function buildDati(piano: PianoRigenerazione): Promise<ECAgenziaData> {
  const a = piano.archivio;
  const { data: compagnia } = await supabase
    .from("compagnie")
    .select("id, nome, codice, indirizzo, cap, comune, provincia, codice_fiscale, partita_iva, iban, intestato_a, percentuale_ra, conto_bancario_id, gruppo_compagnia, gruppi_compagnia(descrizione)")
    .eq("id", a.compagnia_id)
    .maybeSingle();
  const comp = compagnia as any;

  let conto: any = null;
  if (comp?.conto_bancario_id) {
    const { data } = await supabase.from("conti_bancari").select("iban, intestato_a").eq("id", comp.conto_bancario_id).maybeSingle();
    conto = data;
  }
  if (!conto) {
    const { data } = await supabase.from("conti_bancari").select("iban, intestato_a")
      .eq("tipo", "agenzia").eq("is_default", true).eq("attivo", true).maybeSingle();
    conto = data;
  }

  // Sede mittente: ufficio più frequente fra i titoli, fallback Napoli.
  const counts = new Map<string, number>();
  piano.titoliPerRiga.forEach((t) => { if (t.ufficio_id) counts.set(t.ufficio_id, (counts.get(t.ufficio_id) || 0) + 1); });
  const { data: sedi } = await supabase.from("uffici")
    .select("id, nome_ufficio, indirizzo, cap, citta, provincia, email, telefono").eq("attivo", true);
  const topId = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
  const sede: any =
    (sedi || []).find((s: any) => s.id === topId) ||
    (sedi || []).find((s: any) => `${s.nome_ufficio} ${s.citta}`.toLowerCase().includes("napoli")) ||
    {};

  const titoliByKey = new Map(piano.titoliPerRiga.map((t) => [chiaveRiga(t.numero_titolo, t.riga), t]));
  const rows: ECAgenziaTitolo[] = piano.righeNuove.map((r) => {
    const t = titoliByKey.get((r.polizza || "").trim());
    const dFrom = t?.garanzia_da || t?.durata_da;
    const dTo = t?.garanzia_a || t?.durata_a;
    const periodo = dFrom || dTo
      ? `${dFrom ? format(new Date(dFrom), "dd/MM/yyyy") : "—"} ${dTo ? format(new Date(dTo), "dd/MM/yyyy") : ""}`.trim()
      : "";
    return {
      polizza: r.polizza,
      cig: r.cig,
      cliente: r.cliente,
      ramo: t?.rami ? t.rami.descrizione || t.rami.codice || "" : "",
      periodo,
      tp: "AM",
      premio: Number(r.premio) || 0,
      provvigioni: Number(r.provvigioni) || 0,
      mi: r.mi,
    };
  });

  const compagniaRA = Number(comp?.percentuale_ra) || null;
  const ritenutaAcconto = piano.titoliPerRiga.reduce((sum, t) => {
    const ra = resolvePercentualeRA({
      rapporto_percentuale_ra: t.compagnia_rapporti?.percentuale_ra,
      compagnia_percentuale_ra: compagniaRA,
    });
    return sum + calcolaRitenutaAcconto(getProvvigioneEC(t), ra);
  }, 0);

  return {
    sedeNome: sede.nome_ufficio || "",
    sedeIndirizzo: sede.indirizzo || "",
    sedeCap: sede.cap || "",
    sedeCitta: sede.citta || "",
    sedeProvincia: sede.provincia || "",
    sedeEmail: sede.email || "",
    sedeTelefono: sede.telefono || "",
    riferimento: a.riferimento || "",
    dataDocumento: a.data_estratto_conto ? format(new Date(a.data_estratto_conto), "dd/MM/yyyy") : "",
    periodoTesto: a.periodo_testo || "",
    modalitaPagamento: "Bonifico",
    agenziaNome: comp?.nome || "",
    compagniaCollegata: resolveCompagniaCollegataNome(comp),
    agenziaIndirizzo: comp?.indirizzo || "",
    agenziaCap: comp?.cap || "",
    agenziaCitta: comp?.comune || "",
    agenziaProvincia: comp?.provincia || "",
    agenziaCF: comp?.codice_fiscale || "",
    agenziaPIVA: comp?.partita_iva || "",
    iban: conto?.iban || comp?.iban || "",
    intestatoA: conto?.intestato_a || comp?.intestato_a || comp?.nome || "",
    titoli: rows,
    totalePremio: rows.reduce((s, r) => s + r.premio, 0),
    totaleProvvigioni: rows.reduce((s, r) => s + r.provvigioni, 0),
    ritenutaAcconto,
  };
}

/** Rigenera e sostituisce il PDF archiviato. Non alloca nuovi progressivi. */
export async function eseguiRigenerazione(piano: PianoRigenerazione): Promise<void> {
  if (piano.mancanti.length) {
    throw new Error(`Titoli non trovati per: ${piano.mancanti.join(", ")}`);
  }
  const a = piano.archivio;
  const dati = await buildDati(piano);
  const bytes = await buildECAgenziaPdf(dati);
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });

  const { data: doc, error: docErr } = await supabase
    .from("documenti").select("id, nome_file, path_storage").eq("id", a.documento_id).maybeSingle();
  if (docErr) throw docErr;
  if (!doc) throw new Error("Documento archiviato non trovato");

  const nomeFile = (doc as any).nome_file || `EC_Agenzia_${(a.riferimento || "").replace(/\//g, "-")}.pdf`;
  const path = `${a.compagnia_id}/ec_agenzia/${Date.now()}_rettifica_${nomeFile}`;
  const { error: upErr } = await supabase.storage
    .from("documenti_generali")
    .upload(path, blob, { contentType: "application/pdf", upsert: false });
  if (upErr) throw upErr;

  const { error: updDocErr } = await supabase.from("documenti").update({ path_storage: path } as any).eq("id", a.documento_id);
  if (updDocErr) throw updDocErr;

  const { error: updArchErr } = await supabase
    .from("ec_agenzia_archivio" as any)
    .update({
      righe: piano.righeNuove,
      testo_ricerca: buildTestoRicercaEcAgenzia(a.riferimento || "", piano.righeNuove),
    } as any)
    .eq("id", a.id);
  if (updArchErr) throw updArchErr;

  await logAttivita({
    azione: "rigenera_ec_agenzia",
    entita_tipo: "agenzia",
    entita_id: a.compagnia_id,
    severity: "warning",
    dettagli_json: {
      riferimento: a.riferimento,
      documento_id: a.documento_id,
      path_precedente: (doc as any).path_storage,
      path_nuovo: path,
      totale_provvigioni_prima: piano.totaleProvvPrima,
      totale_provvigioni_dopo: piano.totaleProvvDopo,
      righe_modificate: piano.diff,
    },
  });
}

export async function caricaArchivioByDocumento(documentoId: string): Promise<ArchivioRow | null> {
  const { data, error } = await supabase
    .from("ec_agenzia_archivio" as any)
    .select("id, documento_id, compagnia_id, riferimento, periodo_testo, data_estratto_conto, righe")
    .eq("documento_id", documentoId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ArchivioRow) || null;
}

/** Scansiona tutti gli E/C archiviati e restituisce quelli con provvigioni da correggere. */
export async function trovaEcAgenziaDaCorreggere(): Promise<PianoRigenerazione[]> {
  const all: ArchivioRow[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from("ec_agenzia_archivio" as any)
      .select("id, documento_id, compagnia_id, riferimento, periodo_testo, data_estratto_conto, righe")
      .order("created_at")
      .range(from, from + 499);
    if (error) throw error;
    const rows = (data || []) as unknown as ArchivioRow[];
    all.push(...rows);
    if (rows.length < 500) break;
  }
  const out: PianoRigenerazione[] = [];
  for (const a of all) {
    if (!a.righe?.length) continue;
    const p = await pianificaRigenerazione(a);
    if (p.diff.length) out.push(p);
  }
  return out;
}
