import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export type RichiestaQuietanzaRiga = {
  id: string;
  numero_titolo: string | null;
  ramo_nome: string | null;
  cliente_nome_display: string | null;
  premio_lordo: number | null;
  garanzia_a: string | null;
  data_scadenza: string | null;
  tacito_rinnovo: boolean | null;
  compagnia_id: string | null;
  compagnia_nome: string | null;
  polizza_id?: string | null;
};

export async function resolveAgenziaEmail(compagniaId: string): Promise<{
  email: string;
  nome: string;
}> {
  const { data: comp } = await supabase
    .from("compagnie")
    .select("nome, email_messe_a_cassa, mail, mail_avvisi, pec")
    .eq("id", compagniaId)
    .maybeSingle();

  const { data: rapp } = await supabase
    .from("compagnia_rapporti")
    .select("email_messe_a_cassa")
    .eq("compagnia_id", compagniaId)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  const email =
    (rapp as { email_messe_a_cassa?: string | null } | null)?.email_messe_a_cassa?.trim() ||
    (comp as any)?.email_messe_a_cassa?.trim() ||
    (comp as any)?.mail_avvisi?.trim() ||
    (comp as any)?.mail?.trim() ||
    (comp as any)?.pec?.trim() ||
    "";

  return {
    email,
    nome: ((comp as any)?.nome as string) || "",
  };
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}

function fmtEuro(n: number | null | undefined): string {
  const v = Number(n) || 0;
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function defaultOggettoRichiestaQuietanza(agenziaNome: string): string {
  const oggi = format(new Date(), "dd/MM/yyyy");
  return `Richiesta Quietanza — ${agenziaNome || "Agenzia"} — ${oggi}`;
}

export function defaultCorpoRichiestaQuietanza(
  agenziaNome: string,
  righe: RichiestaQuietanzaRiga[],
): string {
  const rowsHtml = righe
    .map((r) => {
      const scadenza = r.garanzia_a || r.data_scadenza;
      return `<tr>
  <td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(r.numero_titolo || "—")}</td>
  <td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(r.ramo_nome || "—")}</td>
  <td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(r.cliente_nome_display || "—")}</td>
  <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">${escapeHtml(fmtEuro(r.premio_lordo))}</td>
  <td style="padding:6px 8px;border:1px solid #ddd;">${escapeHtml(fmtDate(scadenza))}</td>
</tr>`;
    })
    .join("\n");

  return `<p>Spett.le <strong>${escapeHtml(agenziaNome || "Agenzia")}</strong>,</p>
<p>con la presente chiediamo l'emissione delle quietanze relative alle polizze in scadenza elencate di seguito.</p>
<table style="border-collapse:collapse;width:100%;font-size:13px;margin:16px 0;">
  <thead>
    <tr style="background:#f3f4f6;">
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Polizza</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Ramo</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Cliente</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:right;">Premio</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Scadenza</th>
    </tr>
  </thead>
  <tbody>
${rowsHtml}
  </tbody>
</table>
<p>Restiamo in attesa della documentazione e a disposizione per ogni chiarimento.</p>
<p>Cordiali saluti,<br/>Consulbrokers</p>`;
}
