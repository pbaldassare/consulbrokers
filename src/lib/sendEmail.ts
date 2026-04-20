import { supabase } from "@/integrations/supabase/client";

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  reply_to?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Invia un'email tramite Resend (edge function `send-email`).
 *
 * Esempio:
 *   await sendEmail({
 *     to: "cliente@esempio.it",
 *     subject: "Benvenuto",
 *     html: "<h1>Ciao!</h1>",
 *   });
 *
 * NOTA: finché non viene verificato un dominio reale su resend.com,
 * il mittente di default è `onboarding@resend.dev` e l'invio funziona
 * solo verso l'email dell'account Resend proprietario della chiave.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: params,
  });

  if (error) {
    console.error("sendEmail error:", error);
    return { success: false, error: error.message };
  }

  if (data?.error) {
    return { success: false, error: data.error };
  }

  return { success: true, id: data?.id };
}
