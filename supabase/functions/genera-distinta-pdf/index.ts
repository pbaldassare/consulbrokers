import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { data_distinta, ufficio_nome, totale_contanti, totale_assegni, totale_bonifici, totale_pos, totale_generale, saldo_cassa_atteso, differenza_cassa, righe, note } = await req.json();

    // Build HTML for PDF
    const righeHtml = (righe || []).map((r: any, i: number) => `
      <tr style="${i % 2 === 0 ? 'background:#f9fafb;' : ''}">
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${r.tipo_pagamento || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${r.descrizione || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:right;font-family:monospace;">${formatEur(r.importo || 0)}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Helvetica', 'Arial', sans-serif; margin: 40px; color: #1f2937; font-size: 13px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
  .kpi-row { display: flex; gap: 12px; margin-bottom: 20px; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; flex: 1; }
  .kpi-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .kpi-value { font-size: 18px; font-weight: 700; margin-top: 2px; }
  .total { background: #f0f9ff; border-color: #3b82f6; }
  .total .kpi-value { color: #1d4ed8; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #1f2937; color: white; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  th:last-child { text-align: right; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; }
  .sign-block { border-top: 1px solid #1f2937; width: 200px; padding-top: 8px; text-align: center; font-size: 11px; color: #6b7280; }
  .note { margin-top: 20px; padding: 10px; background: #fffbeb; border: 1px solid #fbbf24; border-radius: 6px; font-size: 12px; }
  .quadratura { margin-top: 16px; padding: 10px 16px; background: ${(differenza_cassa || 0) === 0 ? '#f0fdf4' : '#fef2f2'}; border-radius: 8px; border: 1px solid ${(differenza_cassa || 0) === 0 ? '#86efac' : '#fca5a5'}; }
</style></head>
<body>
  <h1>Distinta Giornaliera</h1>
  <div class="subtitle">${data_distinta || '—'} — ${ufficio_nome || 'Ufficio'}</div>

  <div class="kpi-row">
    <div class="kpi"><div class="kpi-label">Contanti</div><div class="kpi-value">${formatEur(totale_contanti || 0)}</div></div>
    <div class="kpi"><div class="kpi-label">Assegni</div><div class="kpi-value">${formatEur(totale_assegni || 0)}</div></div>
    <div class="kpi"><div class="kpi-label">Bonifici</div><div class="kpi-value">${formatEur(totale_bonifici || 0)}</div></div>
    <div class="kpi"><div class="kpi-label">POS</div><div class="kpi-value">${formatEur(totale_pos || 0)}</div></div>
    <div class="kpi total"><div class="kpi-label">Totale Generale</div><div class="kpi-value">${formatEur(totale_generale || 0)}</div></div>
  </div>

  <div class="quadratura">
    <strong>Quadratura Cassa:</strong> Saldo atteso ${formatEur(saldo_cassa_atteso || 0)} — Differenza: <strong>${formatEur(differenza_cassa || 0)}</strong>
  </div>

  <table>
    <thead><tr><th>Tipo Pagamento</th><th>Descrizione</th><th>Importo</th></tr></thead>
    <tbody>${righeHtml || '<tr><td colspan="3" style="text-align:center;padding:20px;color:#9ca3af;">Nessuna riga</td></tr>'}</tbody>
  </table>

  ${note ? `<div class="note"><strong>Note:</strong> ${note}</div>` : ''}

  <div class="footer">
    <div class="sign-block">Firma Operatore</div>
    <div class="sign-block">Firma Responsabile</div>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function formatEur(n: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}
