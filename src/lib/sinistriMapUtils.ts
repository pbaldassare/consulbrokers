/** Colori marker mappa sinistri per tipo (condiviso UI + report PDF). */
export function colorForTipo(t?: string | null): string {
  const v = (t || "").toLowerCase();
  if (v.includes("furto") || v.includes("vandal")) return "#dc2626";
  if (v.startsWith("rc_") || v.includes("patrimon") || v.includes("difesa")) return "#2563eb";
  if (v.startsWith("rca") || v.includes("cristall") || v.includes("urto") || v.includes("auto")) return "#f59e0b";
  if (v.includes("infortun") || v.includes("malatt")) return "#7c3aed";
  if (v.includes("incend") || v.includes("evento") || v.includes("grandine") || v.includes("acqua") || v.includes("elettr")) return "#0d9488";
  return "#64748b";
}

export const GEOCODE_CACHE_KEY = "cbnet_geocode_cache_v1";

export const VARESE_CENTER = { lat: 45.8206, lng: 8.825 };
export const REGGIO_CALABRIA_CENTER = { lat: 38.1113, lng: 15.6471 };
export const ITALY_CENTER = { lat: 42.5, lng: 12.5 };

const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  varese: VARESE_CENTER,
  "reggio calabria": REGGIO_CALABRIA_CENTER,
  milano: { lat: 45.4642, lng: 9.19 },
  "san dona di piave": { lat: 45.6297, lng: 12.5644 },
  "san donà di piave": { lat: 45.6297, lng: 12.5644 },
};

export type SinistroGeo = {
  id: string;
  tipo_sinistro?: string | null;
  luogo_sinistro?: string | null;
  indirizzo_sinistro?: string | null;
  citta_sinistro?: string | null;
  cap_sinistro?: string | null;
  provincia_sinistro?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export function normalizeCittaLabel(value?: string | null): string {
  return (value || "").trim().replace(/\s+/g, " ");
}

export function knownCityCenter(citta?: string | null): { lat: number; lng: number } | null {
  const n = normalizeCittaLabel(citta).toLowerCase();
  if (!n) return null;
  if (CITY_CENTERS[n]) return CITY_CENTERS[n];
  for (const [key, center] of Object.entries(CITY_CENTERS)) {
    if (n.includes(key) || key.includes(n)) return center;
  }
  return null;
}

export function isCalabriaCoords(lat: number, lng: number): boolean {
  return lat >= 37.85 && lat <= 39.55 && lng >= 15.45 && lng <= 17.35;
}

function textLooksCalabria(...parts: Array<string | null | undefined>): boolean {
  const t = parts.filter(Boolean).join(" ").toLowerCase();
  return /reggio\s*calabria|\bcalabria\b|\bcatanzaro\b|\bcosenza\b|\bcrotone\b|\bvibo\b|\b\(rc\)/.test(t);
}

/** Città più frequente sui sinistri, altrimenti sede/nome cliente. */
export function resolveMapAreaLabel(opts: {
  clienteCitta?: string | null;
  clienteNome?: string | null;
  sinistri: Array<{ citta_sinistro?: string | null }>;
}): string {
  const counts = new Map<string, number>();
  for (const s of opts.sinistri) {
    const c = normalizeCittaLabel(s.citta_sinistro);
    if (!c) continue;
    const key = c.toLowerCase();
    const prev = counts.get(key);
    if (!prev) counts.set(key, 1);
    else counts.set(key, prev + 1);
  }
  let bestKey = "";
  let bestN = 0;
  const display = new Map<string, string>();
  for (const s of opts.sinistri) {
    const c = normalizeCittaLabel(s.citta_sinistro);
    if (c) display.set(c.toLowerCase(), c);
  }
  for (const [key, n] of counts) {
    if (n > bestN) {
      bestKey = key;
      bestN = n;
    }
  }
  if (bestKey) return display.get(bestKey) || bestKey;
  const sede = normalizeCittaLabel(opts.clienteCitta);
  if (sede) return sede;
  const nome = normalizeCittaLabel(opts.clienteNome);
  if (/varese/i.test(nome)) return "Varese";
  return sede || "Italia";
}

export function resolveMapFallbackCenter(areaLabel?: string | null): { lat: number; lng: number } {
  return knownCityCenter(areaLabel) || ITALY_CENTER;
}

/** Indirizzo + città + zona/luogo, se valorizzati. */
export function buildSinistroLuogoLabel(s: SinistroGeo): string {
  const indirizzo = normalizeCittaLabel(s.indirizzo_sinistro);
  const citta = [s.cap_sinistro, s.citta_sinistro, s.provincia_sinistro ? `(${s.provincia_sinistro})` : null]
    .filter(Boolean)
    .join(" ");
  const luogo = normalizeCittaLabel(s.luogo_sinistro);
  const parts = [indirizzo, citta].filter(Boolean);
  if (luogo && !parts.some((p) => p.toLowerCase().includes(luogo.toLowerCase()))) {
    parts.push(luogo);
  }
  return parts.join(" — ");
}

export function resolveSinistroCoords(
  s: Pick<SinistroGeo, "lat" | "lng">,
): { lat: number; lng: number } | null {
  if (s.lat == null || s.lng == null) return null;
  const lat = Number(s.lat);
  const lng = Number(s.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Coordinate persistite, scartate se sono il vecchio lock Calabria
 * ma il sinistro è in un'altra città (es. Varese).
 */
export function resolveStoredSinistroCoords(s: SinistroGeo): { lat: number; lng: number } | null {
  const stored = resolveSinistroCoords(s);
  if (!stored) return null;
  if (
    isCalabriaCoords(stored.lat, stored.lng) &&
    !textLooksCalabria(s.citta_sinistro, s.provincia_sinistro, s.luogo_sinistro, s.indirizzo_sinistro)
  ) {
    return null;
  }
  return stored;
}

export function buildSinistroAddress(s: SinistroGeo, fallbackCitta?: string | null): string {
  const local = [
    s.indirizzo_sinistro,
    s.cap_sinistro,
    s.citta_sinistro,
    s.provincia_sinistro && `(${s.provincia_sinistro})`,
  ].filter(Boolean);
  if (local.length) return [...local, "Italia"].join(", ");
  const luogo = normalizeCittaLabel(s.luogo_sinistro);
  if (luogo) return /italia/i.test(luogo) ? luogo : `${luogo}, Italia`;
  const fallback = normalizeCittaLabel(fallbackCitta);
  if (fallback) return `${fallback}, Italia`;
  return "";
}

export function readGeocodeCache(): Record<string, { lat: number; lng: number }> {
  try {
    return JSON.parse(sessionStorage.getItem(GEOCODE_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function writeGeocodeCache(c: Record<string, { lat: number; lng: number }>) {
  try {
    sessionStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(c));
  } catch {
    /* noop */
  }
}

/** Mappa hex custom → colori supportati da Google Static Maps. */
export function staticMapColor(hex: string): string {
  const map: Record<string, string> = {
    "#dc2626": "red",
    "#2563eb": "blue",
    "#f59e0b": "orange",
    "#7c3aed": "purple",
    "#0d9488": "green",
    "#64748b": "gray",
  };
  return map[hex.toLowerCase()] || "gray";
}
