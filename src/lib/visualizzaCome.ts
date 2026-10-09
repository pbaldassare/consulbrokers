import { supabase } from "@/integrations/supabase/client";
import { readInvokeErrorMessage } from "@/lib/edgeFunctionError";

/**
 * "Visualizza come" (solo admin@consul.it): entra con la sessione di un altro utente e torna alla propria
 * senza rifare il login. La sessione admin resta in localStorage (come quella di Supabase, condivisa fra le schede)
 * e viene ripristinata da "Esci".
 */
const KEY = "cbnet_visualizza_come_v1";

export type VisualizzaComeStato = {
  nome: string;
  email: string;
  admin: { access_token: string; refresh_token: string };
};

export function leggiVisualizzaCome(): VisualizzaComeStato | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as VisualizzaComeStato) : null;
  } catch {
    return null;
  }
}

export async function avviaVisualizzaCome(utente: { id: string; nome?: string | null; cognome?: string | null }) {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) throw new Error("Sessione scaduta: rientra in CBnet");

  const res = await supabase.functions.invoke("visualizza-come", { body: { user_id: utente.id } });
  const body = res.data as { token_hash?: string; email?: string; error?: string } | null;
  if (res.error || !body?.token_hash || !body.email) {
    throw new Error(await readInvokeErrorMessage(res.data, res.error));
  }

  const stato: VisualizzaComeStato = {
    nome: `${utente.cognome || ""} ${utente.nome || ""}`.trim() || body.email,
    email: body.email,
    admin: { access_token: s.session.access_token, refresh_token: s.session.refresh_token },
  };
  localStorage.setItem(KEY, JSON.stringify(stato));

  const { error } = await supabase.auth.verifyOtp({ token_hash: body.token_hash, type: "magiclink" });
  if (error) {
    localStorage.removeItem(KEY);
    await supabase.auth.setSession(stato.admin);
    throw error;
  }
  // Ricarica completa: niente dati dell'admin rimasti nella cache delle pagine
  window.location.assign("/");
}

export async function esciVisualizzaCome() {
  const stato = leggiVisualizzaCome();
  // Chiude solo la sessione dell'utente visualizzato (scope local), non quella admin salvata
  await supabase.auth.signOut({ scope: "local" });
  localStorage.removeItem(KEY);
  if (stato) await supabase.auth.setSession(stato.admin);
  window.location.assign(stato ? "/utenti-privilegi" : "/login");
}
