import { supabase } from "@/integrations/supabase/client";

export interface EmailAttachment {
  filename: string;
  content: string; // base64
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  reply_to?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
  apply_branding?: boolean;
  template_id?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Invia un'email tramite Resend (edge function `send-email`).
 *
 * NOTA: con `onboarding@resend.dev` Resend permette invio solo verso l'email
 * dell'account proprietario della chiave. Per inviare a indirizzi reali serve
 * verificare un dominio su resend.com.
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
