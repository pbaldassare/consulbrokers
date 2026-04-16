/**
 * Centralised landing-route logic.
 * Given a profile object returns the first route the user is allowed to see.
 */
export function getDefaultRoute(
  profile: { ruolo?: string | null; permessi_json?: Record<string, boolean> | null } | null | undefined,
): string {
  if (!profile) return "/login";

  if (profile.ruolo === "cliente") return "/cliente";
  if (profile.ruolo === "prospect") return "/prospect";

  // Admin always goes to dashboard
  if (profile.ruolo === "admin") return "/";

  const perms = profile.permessi_json as Record<string, boolean> | null;

  // If user has dashboard permission or no permission map at all → dashboard
  if (!perms || perms.dashboard) return "/";

  // Otherwise redirect to the first allowed area
  if (perms.titoli) return "/portafoglio/attive";
  if (perms.contabilita) return "/contabilita";
  if (perms.portafoglio) return "/portafoglio/documentale";
  if (perms.anagrafiche) return "/archivi/anagrafiche";

  // Fallback – show dashboard anyway
  return "/";
}
