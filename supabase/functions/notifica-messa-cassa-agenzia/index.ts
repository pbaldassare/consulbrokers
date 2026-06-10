// Edge function: notifica messa a cassa all'agenzia/direzione/broker (rapporto)
// Invocata dopo l'aggiornamento di titoli.data_messa_cassa.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_EMAIL = "pscarpelli@consulbrokers.it";

function fmtEuro(n: number | null | undefined): string {
  const v = typeof n === "number" ? n : Number(n);
  if (!isFinite(v)) return "—";
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("it-IT");
  } catch {
    return String(s);
  }
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const payloadSchema = z.object({
  titolo_id: z.string().uuid("titolo_id deve essere un UUID valido"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ success: false, error: "Payload non valido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({
        success: false,
        error: "Payload non valido",
        details: parsed.error.flatten(),
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { titolo_id: titoloId } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Carica titolo con tutte le relazioni utili
    const { data: t, error: tErr } = await supabase
      .from("titoli")
      .select(`
        id, numero_titolo, riga, sostituisce_polizza,
        premio_lordo, importo_incassato,
        data_messa_cassa, data_pagamento, tipo_pagamento, banca_pagamento,
        garanzia_da, garanzia_a, data_competenza, data_scadenza,
        compagnia_id, compagnia_rapporto_id, ramo_id, ufficio_id, ae_anagrafica_id,
        cliente_anagrafica_id,
        clienti!titoli_cliente_anagrafica_id_fkey(id, cognome, nome, ragione_sociale, codice_fiscale, partita_iva),
        compagnie(id, nome, email_messe_a_cassa),
        compagnia_rapporti(id, nome_rapporto, codice_rapporto, sede_denominazione, sede_citta, email_messe_a_cassa, referente_compagnia),
        rami(id, descrizione, codice),
        uffici(id, nome_ufficio)
      `)
      .eq("id", titoloId)
      .maybeSingle();

    if (tErr) throw tErr;
    if (!t) {
      return new Response(JSON.stringify({ error: "titolo non trovato" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Risolvi destinatario: rapporto → compagnia → fallback
    const rapporto: any = t.compagnia_rapporti;
    const compagnia: any = t.compagnie;
    const recipient =
      (rapporto?.email_messe_a_cassa && String(rapporto.email_messe_a_cassa).trim()) ||
      (compagnia?.email_messe_a_cassa && String(compagnia.email_messe_a_cassa).trim()) ||
      FALLBACK_EMAIL;

    // AE (specialist)
    let aeNome = "";
    if (t.ae_anagrafica_id) {
      const { data: ae } = await supabase
        .from("anagrafiche_professionali")
        .select("nome, cognome, ragione_sociale")
        .eq("id", t.ae_anagrafica_id)
        .maybeSingle();
      if (ae) {
        aeNome = (ae as any).ragione_sociale || `${(ae as any).nome ?? ""} ${(ae as any).cognome ?? ""}`.trim();
      }
    }

    const cliente: any = t.clienti;
    const clienteNome = cliente?.ragione_sociale || `${cliente?.cognome ?? ""} ${cliente?.nome ?? ""}`.trim();
    const clienteCF = cliente?.codice_fiscale || cliente?.partita_iva || "—";

    const compagniaNome = compagnia?.nome || "—";
    const rapportoNome = rapporto
      ? `${rapporto.nome_rapporto || rapporto.sede_denominazione || ""}${rapporto.codice_rapporto ? ` (cod. ${rapporto.codice_rapporto})` : ""}`.trim() || "—"
      : "—";
    const enteDestinatario = rapporto?.nome_rapporto || rapporto?.sede_denominazione || compagniaNome;

    const ramo: any = t.rami;
    const ramoLabel = ramo ? `${ramo.descrizione || ""}${ramo.codice ? ` (${ramo.codice})` : ""}`.trim() : "—";

    const ufficio: any = t.uffici;
    const sedeLabel = ufficio?.nome_ufficio || "—";

    const tipoPagLabels: Record<string, string> = {
      bonifico: "Bonifico bancario",
      contanti: "Contanti",
      assegno: "Assegno",
      pos: "POS / Carta",
      rid: "RID / Addebito SEPA",
    };
    const modalita = tipoPagLabels[String(t.tipo_pagamento || "").toLowerCase()] || (t.tipo_pagamento || "—");
    const banca = t.banca_pagamento ? ` — ${escapeHtml(t.banca_pagamento)}` : "";

    const numeroPolizza = t.numero_titolo || "—";
    const periodoRata = `${fmtDate(t.garanzia_da)} – ${fmtDate(t.garanzia_a)}`;
    const importo = fmtEuro(t.importo_incassato ?? t.premio_lordo);
    const dataMessaCassa = fmtDate(t.data_messa_cassa);

    const subject = `Comunicazione messa a cassa — Polizza ${numeroPolizza} — ${clienteNome}`;

    const html = `
<!doctype html>
<html lang="it">
<body style="margin:0;padding:0;background:#f5f7f6;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e0e6e4;">
        <tr><td style="background:#0d4f47;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:600;">
          Consulbrokers — Comunicazione formale di messa a cassa
        </td></tr>
        <tr><td style="padding:24px;font-size:14px;line-height:1.55;">
          <p style="margin:0 0 14px;">Spettabile <strong>${escapeHtml(enteDestinatario)}</strong>,</p>
          <p style="margin:0 0 14px;">con la presente si comunica formalmente l'avvenuta <strong>messa a cassa</strong> del premio relativo alla polizza in oggetto:</p>
          <table role="presentation" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 18px;">
            <tr><td style="width:42%;color:#55615e;">Cliente</td><td><strong>${escapeHtml(clienteNome)}</strong> &nbsp;<span style="color:#55615e;">(${escapeHtml(clienteCF)})</span></td></tr>
            <tr style="background:#f7faf9;"><td style="color:#55615e;">Compagnia</td><td>${escapeHtml(compagniaNome)}</td></tr>
            <tr><td style="color:#55615e;">Rapporto</td><td>${escapeHtml(rapportoNome)}</td></tr>
            <tr style="background:#f7faf9;"><td style="color:#55615e;">Polizza n°</td><td><strong>${escapeHtml(numeroPolizza)}</strong></td></tr>
            <tr><td style="color:#55615e;">Ramo</td><td>${escapeHtml(ramoLabel)}</td></tr>
            <tr style="background:#f7faf9;"><td style="color:#55615e;">Periodo rata</td><td>${escapeHtml(periodoRata)}</td></tr>
            <tr><td style="color:#55615e;">Importo incassato</td><td><strong>${escapeHtml(importo)}</strong></td></tr>
            <tr style="background:#f7faf9;"><td style="color:#55615e;">Modalità di pagamento</td><td>${escapeHtml(modalita)}${banca}</td></tr>
            <tr><td style="color:#55615e;">Data messa a cassa</td><td>${escapeHtml(dataMessaCassa)}</td></tr>
            <tr style="background:#f7faf9;"><td style="color:#55615e;">Specialist di riferimento</td><td>${escapeHtml(aeNome || "—")}</td></tr>
            <tr><td style="color:#55615e;">Sede gestore</td><td>${escapeHtml(sedeLabel)}</td></tr>
          </table>
          <p style="margin:0 0 14px;">Si richiede cortese conferma di registrazione della presente messa a cassa nei vostri sistemi.</p>
          <p style="margin:0;">Cordiali saluti,<br/><strong>Consulbrokers S.p.A.</strong></p>
        </td></tr>
        <tr><td style="background:#fafbfb;color:#7a8784;padding:14px 24px;font-size:11px;border-top:1px solid #e0e6e4;">
          Messaggio generato automaticamente dal gestionale CBnet. Non rispondere a questa email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Invoca la funzione send-email (Resend wrapper esistente)
    const { data: sendRes, error: sendErr } = await supabase.functions.invoke("send-email", {
      body: {
        to: recipient,
        subject,
        html,
        apply_branding: false,
      },
    });

    if (sendErr) {
      // Non propaghiamo 500: la messa a cassa è già avvenuta, la notifica è best-effort.
      console.error("send-email failed:", sendErr);
      await supabase.from("log_attivita").insert({
        azione: "notifica_messa_cassa_errore",
        entita_tipo: "titolo",
        entita_id: titoloId,
        severity: "warning",
        dettagli_json: {
          destinatario: recipient,
          oggetto: subject,
          errore: (sendErr as any)?.message ?? String(sendErr),
        },
      });
      return new Response(
        JSON.stringify({
          ok: false,
          fallback: true,
          recipient,
          error: (sendErr as any)?.message ?? "send-email failed",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Log attività
    await supabase.from("log_attivita").insert({
      azione: "notifica_messa_cassa_inviata",
      entita_tipo: "titolo",
      entita_id: titoloId,
      severity: "info",
      dettagli_json: {
        destinatario: recipient,
        oggetto: subject,
        send_id: (sendRes as any)?.id ?? null,
      },
    });

    return new Response(
      JSON.stringify({ ok: true, recipient, send_id: (sendRes as any)?.id ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("notifica-messa-cassa-agenzia error:", err);
    return new Response(
      JSON.stringify({ ok: false, fallback: true, error: err?.message ?? String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
