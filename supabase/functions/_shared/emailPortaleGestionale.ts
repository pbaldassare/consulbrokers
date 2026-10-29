/** Cliente/prospect e gestionale non possono condividere la stessa posta. */

export const MESSAGGIO_EMAIL_MISTA =
  "Questa mail è già usata da un account cliente o del gestionale. I due tipi non possono avere la stessa posta.";

export function ruoloPortale(ruolo: string | null | undefined): boolean {
  const r = (ruolo ?? "").trim().toLowerCase();
  return r === "cliente" || r === "prospect";
}

export function emailConflittoPortaleGestionale(
  ruoloEsistente: string | null | undefined,
  ruoloNuovo: string | null | undefined,
): boolean {
  if (!ruoloEsistente || !ruoloNuovo) return false;
  return ruoloPortale(ruoloEsistente) !== ruoloPortale(ruoloNuovo);
}

function patternMail(email: string): string {
  return email.trim().toLowerCase().replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

export async function messaggioConflittoEmail(
  admin: { from: (table: string) => any },
  email: string,
  ruoloNuovo: string,
  escludiId?: string,
): Promise<string | null> {
  const mail = email.trim().toLowerCase();
  if (!mail) return null;
  const { data, error } = await admin.from("profiles").select("id, ruolo, email").ilike("email", patternMail(mail));
  if (error) return `Controllo mail non riuscito: ${error.message}`;
  for (const row of data ?? []) {
    if (escludiId && row.id === escludiId) continue;
    if ((row.email ?? "").trim().toLowerCase() !== mail) continue;
    if (emailConflittoPortaleGestionale(row.ruolo, ruoloNuovo)) return MESSAGGIO_EMAIL_MISTA;
  }
  return null;
}
