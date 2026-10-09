import { supabase } from "@/integrations/supabase/client";
import { readInvokeErrorMessage } from "@/lib/edgeFunctionError";

/**
 * "Visualizza come" (solo admin@consul.it): passa alla sessione di un altro utente e torna alla propria
 * senza logout/login né ricarica della pagina. La sessione admin resta in localStorage
 * (come quella di Supabase, condivisa fra le schede) e viene ripristinata da "Esci".
 */
const KEY = "cbnet_visualizza_come_v1";

export type VisualizzaComeStato = {
  nome: string;
  email: string;
  admin: { access_token: string; refresh_token: string };
};

const listeners = new Set<() => void>();
const notifica = () => listeners.forEach((l) => l());

/** Per useSyncExternalStore: avvisa al cambio in questa scheda e nelle altre (evento storage). */
export function subscribeVisualizzaCome(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Snapshot grezzo (stringa): stabile tra un render e l'altro, come richiede useSyncExternalStore. */
export function snapshotVisualizzaCome(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function parseVisualizzaCome(raw: string | null): VisualizzaComeStato | null {
  try {
    return raw ? (JSON.parse(raw) as VisualizzaComeStato) : null;
  } catch {
    return null;
  }
}

/** Entra come l'utente indicato. Al ritorno la sessione è già quella dell'utente: il chiamante svuota la cache e naviga. */
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
  notifica();
}

/** Torna alla sessione admin salvata. Ritorna false se non è stato possibile (serve un nuovo login). */
export async function esciVisualizzaCome(): Promise<boolean> {
  const stato = parseVisualizzaCome(snapshotVisualizzaCome());
  localStorage.removeItem(KEY);
  notifica();
  if (!stato) return false;
  // Sostituisce la sessione corrente con quella admin (se scaduta la rinnova col refresh token): nessun logout
  const { error } = await supabase.auth.setSession(stato.admin);
  if (error) {
    await supabase.auth.signOut({ scope: "local" });
    return false;
  }
  return true;
}
