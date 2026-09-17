// Job feriale 07:00 Europe/Rome: stessa ricerca della pagina Bandi Pubblici
// (tutte le fonti, keyword brokeraggio) + marca scaduti + storico solo partecipati.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bandi-cron-secret",
};

const CRON_SECRET = "bandi-cron-mattina-2026";
const KEYWORD = "brokeraggio";
const KEYWORD_LABEL = "Brokeraggio assicurativo";
const FONTE = "tutte";

type BandoIn = {
  scheda_id?: string | null;
  titolo?: string | null;
  ente?: string | null;
  ente_tipo?: string | null;
  categoria?: string | null;
  importo?: number | null;
  scadenza?: string | null;
  cig?: string | null;
  link?: string | null;
  localita?: string | null;
  regione?: string | null;
  stato?: string | null;
  pdf_url?: string | null;
  keyword?: string | null;
  fonte?: string | null;
  tipo_avviso?: string | null;
  notice_type?: string | null;
  form_type?: string | null;
  aggiudicato?: boolean | null;
  aggiudicatario?: string | null;
  data_decisione?: string | null;
  data_contratto?: string | null;
  servizio_da?: string | null;
  servizio_a?: string | null;
  tipo_procedura?: string | null;
  dataPublicazione?: string | null;
  data_pubblicazione?: string | null;
};

function authorized(req: Request, body: Record<string, unknown>): boolean {
  const header = req.headers.get("x-bandi-cron-secret") || "";
  const fromBody = typeof body.secret === "string" ? body.secret : "";
  if (header === CRON_SECRET || fromBody === CRON_SECRET) return true;
  const auth = req.headers.get("Authorization") || "";
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return !!srk && auth === `Bearer ${srk}`;
}

function toIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const it = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (it) return `${it[3]}-${it[2].padStart(2, "0")}-${it[1].padStart(2, "0")}`;
  return null;
}

function resolveFonte(fonte: string | null | undefined, link?: string | null): string {
  const v = String(fonte || "").toLowerCase();
  if (v === "ted" || v === "mondoappalti" || v === "infordat") return v;
  try {
    const host = link ? new URL(link).hostname.replace(/^www\./, "").toLowerCase() : "";
    if (host.includes("infordat")) return "infordat";
    if (host.includes("mondoappalti")) return "mondoappalti";
  } catch {
    /* ignore */
  }
  return "ted";
}

function mapRow(bando: BandoIn, harvestedAt: string) {
  const schedaId = String(bando.scheda_id || "").trim();
  if (!schedaId) return null;
  const aggiudicato = !!bando.aggiudicato;
  return {
    scheda_id: schedaId,
    titolo: bando.titolo || null,
    oggetto: bando.titolo || null,
    ente: bando.ente || null,
    ente_tipo: bando.ente_tipo || null,
    tipologia: bando.categoria || null,
    importo: bando.importo ?? null,
    scadenza: toIsoDate(bando.scadenza),
    cig: bando.cig || null,
    link: bando.link || null,
    localita: bando.localita || null,
    regione: bando.regione || null,
    stato: aggiudicato ? "scaduto" : (bando.stato || "aperto"),
    pdf_url: bando.pdf_url || null,
    keyword: bando.keyword || bando.categoria || KEYWORD_LABEL,
    fonte: resolveFonte(bando.fonte, bando.link),
    tipo_avviso: bando.tipo_avviso || (aggiudicato ? "esito" : "gara"),
    notice_type: bando.notice_type || null,
    form_type: bando.form_type || null,
    aggiudicato,
    aggiudicatario: bando.aggiudicatario || null,
    data_decisione: toIsoDate(bando.data_decisione),
    data_contratto: toIsoDate(bando.data_contratto),
    servizio_da: toIsoDate(bando.servizio_da),
    servizio_a: toIsoDate(bando.servizio_a),
    tipo_procedura: bando.tipo_procedura || null,
    data_pubblicazione: toIsoDate(bando.dataPublicazione || bando.data_pubblicazione),
    last_harvest_at: harvestedAt,
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (!authorized(req, body)) {
    return json({ error: "Unauthorized" }, 403);
  }

  const action = String(body.action || "full");
  const url = Deno.env.get("SUPABASE_URL")!;
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, srk, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result: Record<string, unknown> = {
    action,
    fonte: FONTE,
    keyword: KEYWORD,
  };

  try {
    if (action !== "archive-only") {
      const cercaResp = await fetch(`${url}/functions/v1/cerca-bandi`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${srk}`,
          apikey: srk,
        },
        body: JSON.stringify({
          action: "start",
          fonte: FONTE,
          keyword: KEYWORD,
        }),
      });
      const cercaJson = await cercaResp.json().catch(() => ({}));
      if (!cercaResp.ok || cercaJson?.error) {
        throw new Error(cercaJson?.error || `cerca-bandi HTTP ${cercaResp.status}`);
      }
      const bandi = Array.isArray(cercaJson?.bandi) ? cercaJson.bandi as BandoIn[] : [];
      const harvestedAt = new Date().toISOString();
      const rows = bandi.map((b) => mapRow(b, harvestedAt)).filter((r): r is NonNullable<typeof r> => !!r);
      result.trovati = bandi.length;
      result.message = cercaJson?.message || null;
      result.warning = cercaJson?.warning || null;

      if (rows.length > 0) {
        const schedaIds = rows.map((r) => r.scheda_id);
        const { data: existing, error: existingErr } = await admin
          .from("bandi_pubblici")
          .select("scheda_id")
          .in("scheda_id", schedaIds);
        if (existingErr) throw existingErr;
        const known = new Set((existing || []).map((r: { scheda_id: string }) => r.scheda_id));
        const { error: upsertErr } = await admin
          .from("bandi_pubblici")
          .upsert(rows, { onConflict: "scheda_id", ignoreDuplicates: false });
        if (upsertErr) throw upsertErr;
        result.salvati = rows.length;
        result.nuovi = rows.filter((r) => !known.has(r.scheda_id)).length;
        result.giaInArchivio = rows.length - Number(result.nuovi);
      } else {
        result.salvati = 0;
        result.nuovi = 0;
        result.giaInArchivio = 0;
      }

      await admin.from("ricerche_bandi").insert({
        regioni: [],
        risultati_count: bandi.length,
        fonte: "cron-mattina",
      });
    }

    if (action !== "search-only") {
      const { data: archivio, error: archErr } = await admin.rpc("bandi_marca_scaduti_e_archivia");
      if (archErr) throw archErr;
      result.archivio = archivio;
    }

    return json({ ok: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Errore job bandi";
    console.error("bandi-cron-mattina", error);
    return json({ ok: false, error: message, ...result }, 500);
  }
});
