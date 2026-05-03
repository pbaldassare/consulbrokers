/**
 * Version check DISABILITATO.
 * Le funzioni restano come no-op per non rompere import esistenti.
 */
export async function checkAppVersion(): Promise<"reload" | "block" | "ok"> {
  return "ok";
}
export function startVersionPolling(_intervalMs = 60_000) {
  /* no-op */
}
