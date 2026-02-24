import { supabase } from "@/integrations/supabase/client";

export const logAttivita = async (params: {
  azione: string;
  entita_tipo: string;
  entita_id: string;
  dettagli_json?: Record<string, unknown>;
}) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("log_attivita").insert([{
    user_id: user.id,
    azione: params.azione,
    entita_tipo: params.entita_tipo,
    entita_id: params.entita_id,
    dettagli_json: (params.dettagli_json as any) || null,
  }]);
};
