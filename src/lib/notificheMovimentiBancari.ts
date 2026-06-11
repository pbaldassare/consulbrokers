// Helper: invia notifiche agli utenti della sede su eventi movimenti bancari.
import { supabase } from "@/integrations/supabase/client";
import { fmtEuro } from "@/lib/formatCurrency";

type Evento = "approvato" | "ricongiunto" | "messo_a_cassa";

interface Params {
  evento: Evento;
  movimentoId: string;
  ufficioId: string | null;
  importo: number;
  clienteLabel: string;
  statoNuovo: string;
  note?: string;
}

const TITOLI: Record<Evento, string> = {
  approvato: "Movimento bancario approvato",
  ricongiunto: "Movimento ricongiunto",
  messo_a_cassa: "Movimento messo a cassa",
};

export async function notificaSedeMovimentoBancario({
  evento, movimentoId, ufficioId, importo, clienteLabel, statoNuovo, note,
}: Params): Promise<void> {
  if (!ufficioId) return;

  // Tutti i profili attivi di quella sede (esclusi cliente/prospect)
  const { data: profili } = await supabase
    .from("profiles")
    .select("id, ruolo, attivo, ufficio_id")
    .eq("ufficio_id", ufficioId)
    .eq("attivo", true);

  const destinatari = (profili ?? []).filter(
    (p: any) => !["cliente", "prospect"].includes(p.ruolo),
  );
  if (destinatari.length === 0) return;

  const messaggio = `${clienteLabel} · ${fmtEuro(importo)} · stato: ${statoNuovo}${note ? ` · ${note}` : ""}`;

  const rows = destinatari.map((p: any) => ({
    destinatario_id: p.id,
    ufficio_id: ufficioId,
    tipo: `mov_bancario_${evento}`,
    titolo: TITOLI[evento],
    messaggio,
    entita_tipo: "movimento_bancario",
    entita_id: movimentoId,
    priorita: "normale",
  }));

  await supabase.from("notifiche").insert(rows as any);
}
