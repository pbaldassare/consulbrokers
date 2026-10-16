/** Deriva RIUSCITA / FALLITA da severity e dettagli_json (registro attività). */
export type LogAttivitaStato = "RIUSCITA" | "FALLITA";

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function isExplicitFalse(v: unknown): boolean {
  return v === false || v === "false";
}

function hasErrorField(d: Record<string, unknown>): boolean {
  for (const key of ["error", "errore", "messaggio_errore"] as const) {
    const val = d[key];
    if (val == null || val === "") continue;
    if (typeof val === "string" && val.trim().length > 0) return true;
    if (typeof val !== "string") return true;
  }
  return false;
}

/** Allineato a public.log_attivita_is_fallita (colonna esito_fallita). */
export function logAttivitaIsFallita(dettagliJson: unknown): boolean {
  const d = asRecord(dettagliJson);
  if (!d) return false;
  if (isExplicitFalse(d.ok) || isExplicitFalse(d.success)) return true;
  return hasErrorField(d);
}

export function statoLogAttivita(
  dettagliJson: unknown,
  _severity?: string | null,
  esitoFallita?: boolean | null,
): LogAttivitaStato {
  if (esitoFallita === true) return "FALLITA";
  if (esitoFallita === false) return "RIUSCITA";
  return logAttivitaIsFallita(dettagliJson) ? "FALLITA" : "RIUSCITA";
}

export function labelOperazioneLog(azione: string | null, dettagliJson: unknown): string {
  const d = asRecord(dettagliJson);
  const desc = d?.descrizione;
  if (typeof desc === "string" && desc.trim()) return desc.trim();
  if (!azione) return "—";
  return azione.replace(/_/g, " ");
}
