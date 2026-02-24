import { supabase } from "@/integrations/supabase/client";

const MAX_PER_HOUR = 30;

/**
 * Check if user can upload. Returns { allowed, remaining } or throws.
 */
export const checkUploadRate = async (userId: string): Promise<{ allowed: boolean; remaining: number }> => {
  const oraRif = new Date();
  oraRif.setMinutes(0, 0, 0);
  const oraStr = oraRif.toISOString();

  // Upsert or get current count
  const { data: existing } = await supabase
    .from("upload_rate_limit")
    .select("id, conteggio")
    .eq("user_id", userId)
    .eq("ora_riferimento", oraStr)
    .maybeSingle();

  if (!existing) {
    // First upload this hour
    await supabase.from("upload_rate_limit").insert({
      user_id: userId,
      ora_riferimento: oraStr,
      conteggio: 1,
    });
    return { allowed: true, remaining: MAX_PER_HOUR - 1 };
  }

  if (existing.conteggio >= MAX_PER_HOUR) {
    return { allowed: false, remaining: 0 };
  }

  await supabase
    .from("upload_rate_limit")
    .update({ conteggio: existing.conteggio + 1 })
    .eq("id", existing.id);

  return { allowed: true, remaining: MAX_PER_HOUR - existing.conteggio - 1 };
};

/**
 * Check file size against system setting.
 * Returns max MB from impostazioni_sistema or default 10.
 */
export const getMaxFileSizeMB = async (): Promise<number> => {
  const { data } = await supabase
    .from("impostazioni_sistema")
    .select("valore_json")
    .eq("chiave", "limiti_upload_file_mb")
    .maybeSingle();

  if (data?.valore_json && typeof data.valore_json === "object" && "valore" in (data.valore_json as any)) {
    return Number((data.valore_json as any).valore) || 10;
  }
  return 10;
};
