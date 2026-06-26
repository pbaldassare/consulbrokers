// Edge function: notifica messa a cassa all'agenzia/direzione/broker (rapporto)
// Invocata dopo l'aggiornamento di titoli.data_messa_cassa.
// Deduplica: una sola email per titolo salvo force=true (reinvio manuale).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

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
}

/** Importo da mostrare in email: garantito con importo 0 → premio lordo. */
function resolveImportoEmail(t: {
  importo_incassato?: number | null;
  premio_lordo?: number | null;
  conferimento_gestito?: boolean | null;
  tipo_pagamento?: string | null;
}): number | null {
  const incassato = t.importo_incassato != null ? Number(t.importo_incassato) : null;
  const lordo = t.premio_lordo != null ? Number(t.premio_lordo) : null;
  const isGarantito = !!t.conferimento_gestito || String(t.tipo_pagamento || "").toLowerCase() === "garantito";
  if (isGarantito && (incassato == null || incassato === 0)) {
    return lordo;
  }
  if (incassato != null && incassato > 0) return incassato;
  return lordo;
}

const payloadSchema = z.object({
  titolo_id: z.string().uuid("titolo_id deve essere un UUID valido"),
  /** Reinvio manuale: ignora deduplicazione. */
  force: z.boolean().optional(),
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

    const { titolo_id: titoloId, force = false } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!force) {
      const { data: giaInviata } = await supabase
        .from("log_attivita")
        .select("id")
        .eq("entita_tipo", "titolo")
        .eq("entita_id", titoloId)
        .eq("azione", "notifica_messa_cassa_inviata")
        .limit(1)
        .maybeSingle();

      if (giaInviata) {
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "already_sent" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Carica titolo con tutte le relazioni utili
    const { data: t, error: tErr } = await supabase
      .from("titoli")
      .select(`
        id, numero_titolo, riga, sostituisce_polizza,
        premio_lordo, importo_incassato,
        data_messa_cassa, data_pagamento, tipo_pagamento, banca_pagamento,
        conferimento_gestito, fondi_ricevuti,
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

    const cliente: any = t.clienti;
    const clienteNome = cliente?.ragione_sociale || `${cliente?.cognome ?? ""} ${cliente?.nome ?? ""}`.trim();

    const compagniaNome = compagnia?.nome || "—";

    const ramo: any = t.rami;
    const ramoLabel = ramo ? `${ramo.descrizione || ""}${ramo.codice ? ` (${ramo.codice})` : ""}`.trim() : "—";

    const tipoPagLabels: Record<string, string> = {
      bonifico: "Bonifico bancario",
      contanti: "Contanti",
      assegno: "Assegno",
      pos: "POS / Carta",
      rid: "RID / Addebito SEPA",
      garantito: "Copertura garantita (incasso in attesa fondi)",
    };

    const isGarantito = !!t.conferimento_gestito || String(t.tipo_pagamento || "").toLowerCase() === "garantito";
    const modalita = isGarantito
      ? "Copertura garantita"
      : (tipoPagLabels[String(t.tipo_pagamento || "").toLowerCase()] || (t.tipo_pagamento || "—"));

    const numeroPolizza = t.numero_titolo || "—";
    const decorrenza = fmtDate(t.garanzia_da);
    const dataMessaCassa = fmtDate(t.data_messa_cassa);
    const importo = fmtEuro(resolveImportoEmail(t));

    const subject = isGarantito
      ? `Comunicazione copertura garantita — Polizza ${numeroPolizza} — ${clienteNome}`
      : `Comunicazione messa a cassa — Polizza ${numeroPolizza} — ${clienteNome}`;

    const introGarantito = isGarantito
      ? `<p style="margin:0 0 14px;">In data <strong>${escapeHtml(dataMessaCassa)}</strong> abbiamo garantito la copertura del seguente premio per Vostro conto, in attesa dell'incasso effettivo dei fondi dal cliente, come da accordi:</p>`
      : `<p style="margin:0 0 14px;">In data odierna abbiamo incassato per Vostro conto a mezzo <strong>${escapeHtml(modalita)}</strong> il seguente premio, come da accordi:</p>`;

    const html = `
<!doctype html>
<html lang="it">
<body style="margin:0;padding:0;background:#f5f7f6;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e0e6e4;">
        <tr><td style="background:#0d4f47;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:600;">
          Consulbrokers — ${isGarantito ? "Avviso copertura garantita" : "Avviso incasso"}
        </td></tr>
        <tr><td style="padding:24px;font-size:14px;line-height:1.55;">
          <p style="margin:0 0 14px;">Spettabile Compagnia,</p>
          ${introGarantito}
          <table role="presentation" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 18px;">
            <tr><td style="width:42%;color:#55615e;">Contraente</td><td><strong>${escapeHtml(clienteNome)}</strong></td></tr>
            <tr style="background:#f7faf9;"><td style="color:#55615e;">Ramo</td><td>${escapeHtml(ramoLabel)}</td></tr>
            <tr><td style="color:#55615e;">Polizza</td><td><strong>${escapeHtml(numeroPolizza)}</strong></td></tr>
            <tr style="background:#f7faf9;"><td style="color:#55615e;">Decorrenza</td><td>${escapeHtml(decorrenza)}</td></tr>
            <tr><td style="color:#55615e;">Premio</td><td><strong>${escapeHtml(importo)}</strong></td></tr>
            ${isGarantito ? `<tr><td style="color:#55615e;">Messa a cassa</td><td>${escapeHtml(dataMessaCassa)}</td></tr>` : ""}
          </table>
          <p style="margin:0;">È gradita l'occasione per porgere cordiali saluti.</p>
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
        from: "ConsulNet <noreply@cbnet.it>",
        apply_branding: true,
      },
    });

    if (sendErr) {
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
          garantito: isGarantito,
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

    await supabase.from("log_attivita").insert({
      azione: "notifica_messa_cassa_inviata",
      entita_tipo: "titolo",
      entita_id: titoloId,
      severity: "info",
      dettagli_json: {
        destinatario: recipient,
        oggetto: subject,
        send_id: (sendRes as any)?.id ?? null,
        garantito: isGarantito,
        force,
      },
    });

    return new Response(
      JSON.stringify({ ok: true, recipient, send_id: (sendRes as any)?.id ?? null, garantito: isGarantito }),
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
