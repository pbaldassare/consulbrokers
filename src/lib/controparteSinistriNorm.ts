/** Stessa logica di controparte_denominazione_norm_key in Postgres (token ordinati). */
export function controparteDenominazioneNormKey(raw: string): string {
  const tokens = raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort();
  return tokens.join(" ");
}
