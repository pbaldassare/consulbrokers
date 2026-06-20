import { useEffect, useMemo, useRef, useState } from "react";
import { formatTipoSinistro } from "@/lib/tipiSinistro";
import { format } from "date-fns";

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY) as string | undefined;
const GOOGLE_MAPS_CHANNEL = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
const VARESE_CENTER = { lat: 45.8206, lng: 8.8251 };
const CACHE_KEY = "cbnet_geocode_cache_v1";

type Sinistro = {
  id: string;
  numero_sinistro?: string | null;
  tipo_sinistro?: string | null;
  tipo_sinistro_personalizzato?: string | null;
  ramo_sinistro?: string | null;
  stato?: string | null;
  data_evento?: string | null;
  luogo_sinistro?: string | null;
  indirizzo_sinistro?: string | null;
  citta_sinistro?: string | null;
  cap_sinistro?: string | null;
  provincia_sinistro?: string | null;
  importo_riserva?: number | null;
};

interface Props {
  sinistri: Sinistro[];
}

function colorForTipo(t?: string | null): string {
  const v = (t || "").toLowerCase();
  if (v.includes("furto") || v.includes("vandal")) return "#dc2626"; // red
  if (v.startsWith("rc_") || v.includes("patrimon") || v.includes("difesa")) return "#2563eb"; // blue
  if (v.startsWith("rca") || v.includes("cristall") || v.includes("urto") || v.includes("auto")) return "#f59e0b"; // amber
  if (v.includes("infortun") || v.includes("malatt")) return "#7c3aed"; // violet
  if (v.includes("incend") || v.includes("evento") || v.includes("grandine") || v.includes("acqua") || v.includes("elettr")) return "#0d9488"; // teal
  return "#64748b"; // slate
}

type MapsLibs = {
  Map: any; Marker: any; Geocoder: any; InfoWindow: any; LatLngBounds: any; SymbolPath: any;
};

async function loadGoogleMapsScript(): Promise<void> {
  const w = window as any;
  if (w.google?.maps?.importLibrary || typeof w.google?.maps?.Map === "function") return;
  if (w.__cbnetGoogleMapsPromise) return w.__cbnetGoogleMapsPromise;
  if (!GOOGLE_MAPS_API_KEY) throw new Error("chiave Google Maps non configurata");

  w.__cbnetGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const callbackName = "__cbnetSinistriMapReady";
    const timeout = window.setTimeout(() => reject(new Error("inizializzazione Google Maps scaduta")), 10000);
    w[callbackName] = () => {
      window.clearTimeout(timeout);
      resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {
      const started = Date.now();
      const waitExisting = () => {
        if (w.google?.maps?.importLibrary || typeof w.google?.maps?.Map === "function") {
          window.clearTimeout(timeout);
          resolve();
          return;
        }
        if (Date.now() - started > 10000) {
          reject(new Error("Google Maps già presente ma non inizializzato"));
          return;
        }
        window.setTimeout(waitExisting, 80);
      };
      waitExisting();
      return;
    }

    const channel = GOOGLE_MAPS_CHANNEL ? `&channel=${encodeURIComponent(GOOGLE_MAPS_CHANNEL)}` : "";
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&language=it&loading=async&callback=${callbackName}&v=weekly${channel}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("caricamento Google Maps fallito"));
    };
    document.head.appendChild(s);
  });

  return w.__cbnetGoogleMapsPromise;
}

async function ensureMapsLibs(): Promise<MapsLibs> {
  await loadGoogleMapsScript();
  const gm: any = (window as any).google?.maps;
  if (!gm) throw new Error("Google Maps non inizializzato");
  if (typeof gm.importLibrary === "function") {
    const [mapsLib, markerLib, geoLib, coreLib] = await Promise.all([
      gm.importLibrary("maps"),
      gm.importLibrary("marker").catch(() => ({})),
      gm.importLibrary("geocoding").catch(() => ({})),
      gm.importLibrary("core").catch(() => ({})),
    ]);
    const libs = {
      Map: mapsLib.Map || gm.Map,
      InfoWindow: mapsLib.InfoWindow || gm.InfoWindow,
      Marker: markerLib.Marker || gm.Marker,
      Geocoder: geoLib.Geocoder || gm.Geocoder,
      LatLngBounds: coreLib.LatLngBounds || mapsLib.LatLngBounds || gm.LatLngBounds,
      SymbolPath: gm.SymbolPath || mapsLib.SymbolPath,
    };
    if (typeof libs.Map !== "function") throw new Error("costruttore mappa non disponibile");
    if (typeof libs.Marker !== "function") throw new Error("marker mappa non disponibili");
    return libs;
  }
  // legacy fallback
  const libs = {
    Map: gm.Map, Marker: gm.Marker, Geocoder: gm.Geocoder,
    InfoWindow: gm.InfoWindow, LatLngBounds: gm.LatLngBounds, SymbolPath: gm.SymbolPath,
  };
  if (typeof libs.Map !== "function") throw new Error("costruttore mappa non disponibile");
  return libs;
}

function readCache(): Record<string, { lat: number; lng: number }> {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
}
function writeCache(c: Record<string, { lat: number; lng: number }>) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* noop */ }
}

function buildAddress(s: Sinistro): string {
  const parts = [s.indirizzo_sinistro, s.cap_sinistro, s.citta_sinistro, s.provincia_sinistro && `(${s.provincia_sinistro})`, "Italia"]
    .filter(Boolean)
    .join(", ");
  return parts || s.luogo_sinistro || "";
}

const fmtEur = (v?: number | null) => v == null ? "—" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

export function SinistriMap({ sinistri }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mappedCount, setMappedCount] = useState(0);

  const key = useMemo(() => sinistri.map(s => s.id).join("|"), [sinistri]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const libs = await ensureMapsLibs();
        if (cancelled || !containerRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new libs.Map(containerRef.current, {
            center: VARESE_CENTER,
            zoom: 9,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
          infoRef.current = new libs.InfoWindow();
        }
        // clear previous markers
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];

        const cache = readCache();
        const geocoder = new libs.Geocoder();
        const bounds = new libs.LatLngBounds();
        let placed = 0;

        for (const s of sinistri) {
          const addr = buildAddress(s);
          if (!addr) continue;
          let coords = cache[addr];
          if (!coords) {
            try {
              const res: any = await new Promise((resolve, reject) => {
                geocoder.geocode({ address: addr }, (results: any[], status: string) => {
                  if (status === "OK" && results?.[0]) resolve(results[0]);
                  else reject(new Error(status));
                });
              });
              const loc = res.geometry.location;
              coords = { lat: loc.lat(), lng: loc.lng() };
              cache[addr] = coords;
            } catch {
              continue;
            }
          }
          if (cancelled) return;
          const color = colorForTipo(s.tipo_sinistro);
          const marker = new libs.Marker({
            position: coords,
            map: mapRef.current,
            title: s.numero_sinistro || "",
            icon: {
              path: libs.SymbolPath?.CIRCLE ?? 0,
              scale: 9,
              fillColor: color,
              fillOpacity: 0.95,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });
          marker.addListener("click", () => {
            const tipo = formatTipoSinistro(s);
            const dt = s.data_evento ? format(new Date(s.data_evento), "dd/MM/yyyy") : "—";
            const loc = [s.indirizzo_sinistro, s.citta_sinistro].filter(Boolean).join(" — ");
            const html = `
              <div style="font-family:system-ui,sans-serif;min-width:220px;max-width:280px">
                <div style="font-weight:600;color:#0f172a;margin-bottom:4px">${s.numero_sinistro || "Sinistro"}</div>
                <div style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${color};color:#fff;font-size:11px;font-weight:600;margin-bottom:6px">${tipo}</div>
                ${s.ramo_sinistro ? `<div style="font-size:12px;color:#475569;margin-bottom:2px"><b>Garanzia:</b> ${s.ramo_sinistro}</div>` : ""}
                <div style="font-size:12px;color:#475569;margin-bottom:2px"><b>Data:</b> ${dt}</div>
                ${loc ? `<div style="font-size:12px;color:#475569;margin-bottom:2px"><b>Luogo:</b> ${loc}</div>` : ""}
                <div style="font-size:12px;color:#475569"><b>Riserva:</b> ${fmtEur(s.importo_riserva)}</div>
                ${s.stato ? `<div style="margin-top:6px;font-size:11px;color:#64748b">Stato: ${s.stato.replace(/_/g, " ")}</div>` : ""}
              </div>`;
            infoRef.current.setContent(html);
            infoRef.current.open({ anchor: marker, map: mapRef.current });
          });
          markersRef.current.push(marker);
          bounds.extend(coords);
          placed++;
        }

        writeCache(cache);

        if (!cancelled) {
          setMappedCount(placed);
          if (placed > 0) {
            mapRef.current.fitBounds(bounds);
            if (placed === 1) mapRef.current.setZoom(13);
          } else {
            mapRef.current.setCenter(VARESE_CENTER);
            mapRef.current.setZoom(9);
          }
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Errore caricamento mappa");
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [key]);

  const legend: Array<{ label: string; color: string }> = [
    { label: "Furto / Vandalismo", color: "#dc2626" },
    { label: "RC / Patrimoniale", color: "#2563eb" },
    { label: "Auto / RCA / Cristalli", color: "#f59e0b" },
    { label: "Infortuni / Malattia", color: "#7c3aed" },
    { label: "Incendio / Eventi naturali", color: "#0d9488" },
  ];

  return (
    <div className="space-y-2">
      <div className="relative rounded-md overflow-hidden border" style={{ height: 360 }}>
        <div ref={containerRef} className="absolute inset-0" />
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/40 text-sm text-muted-foreground">
            Caricamento mappa…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/40 text-sm text-muted-foreground px-4 text-center">
            Mappa non disponibile: {error}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {legend.map(l => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
        <span className="ml-auto">{mappedCount} di {sinistri.length} sinistri mappati</span>
      </div>
    </div>
  );
}

export default SinistriMap;
