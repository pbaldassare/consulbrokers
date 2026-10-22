/** URL pubblico CBnet (mai localhost nei link inviati per email). */
export const CBNET_PUBLIC_ORIGIN = "https://cbnet.it";

export function passwordResetRedirectUrl(requestOrigin?: string): string {
  const fallback = `${CBNET_PUBLIC_ORIGIN}/reset-password`;
  if (!requestOrigin) return fallback;
  try {
    const u = new URL(requestOrigin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return fallback;
    return `${u.origin}/reset-password`;
  } catch {
    return fallback;
  }
}
