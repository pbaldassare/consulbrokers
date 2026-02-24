import { supabase } from "@/integrations/supabase/client";

/**
 * Log a performance measurement to the performance_log table.
 * Fire-and-forget — does not block calling code.
 */
export const logPerformance = (params: {
  tipo: string;
  durata_ms: number;
  dettagli_json?: Record<string, unknown>;
}) => {
  supabase.from("performance_log").insert([{
    tipo: params.tipo,
    durata_ms: params.durata_ms,
    dettagli_json: (params.dettagli_json as any) || {},
  }]).then(() => {});
};
