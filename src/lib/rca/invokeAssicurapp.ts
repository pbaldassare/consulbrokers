import { supabase } from "@/integrations/supabase/client";
import type { RcaPreventivoRow } from "@/lib/rca/preventivi";
import type { AssicurappOffer } from "@/lib/rca/assicurapp";

export type AssicurappRcaResponse = {
  ok: boolean;
  preventivo: RcaPreventivoRow;
  quote_uid: string | null;
  offerte: AssicurappOffer[];
  pending: boolean;
  error?: string;
};

export async function invokeAssicurappRca(
  azione: "quota" | "poll",
  preventivoId: string,
): Promise<AssicurappRcaResponse> {
  const { data, error } = await supabase.functions.invoke("assicurapp-rca", {
    body: { azione, preventivo_id: preventivoId },
  });
  if (error) throw new Error(error.message || "Errore chiamata Assicurapp");
  const payload = (data || {}) as AssicurappRcaResponse;
  if (payload.error && !payload.ok) throw new Error(payload.error);
  return payload;
}

export type AssicurappDatiResponse = {
  ok: boolean;
  dati?: Record<string, unknown> | null;
  fonte?: string;
  error?: string;
  tentativi?: string[];
};

export async function invokeAssicurappDatiEsterni(args: {
  targa: string;
  cf?: string;
}): Promise<AssicurappDatiResponse> {
  const { data, error } = await supabase.functions.invoke("assicurapp-rca", {
    body: { azione: "dati", targa: args.targa, cf: args.cf || "" },
  });
  if (error) throw new Error(error.message || "Errore interrogazione Euroherc / ANIA");
  const payload = (data || {}) as AssicurappDatiResponse;
  if (payload.error && !payload.ok) throw new Error(payload.error);
  return payload;
}
