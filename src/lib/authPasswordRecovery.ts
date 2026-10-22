/** Indizi URL Supabase recovery (hash implicit o query PKCE). */
export function urlLooksLikePasswordRecovery(href: string): boolean {
  try {
    const u = new URL(href);
    const hash = u.hash || "";
    if (hash.includes("type=recovery") || hash.includes("access_token")) return true;
    if (u.searchParams.get("type") === "recovery") return true;
    if (u.searchParams.has("code")) return true;
    return false;
  } catch {
    return false;
  }
}

export function recoveryCodeFromUrl(href: string): string | null {
  try {
    return new URL(href).searchParams.get("code");
  } catch {
    return null;
  }
}
