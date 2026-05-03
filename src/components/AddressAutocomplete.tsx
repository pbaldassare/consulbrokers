import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export interface AddressComponents {
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (components: AddressComponents) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GooglePlaceResult {
  place_id?: string;
  formatted_address?: string;
  name?: string;
  address_components?: GoogleAddressComponent[];
}

interface GoogleAutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

interface AutocompleteServiceInstance {
  getPlacePredictions: (
    request: {
      input: string;
      types: string[];
      componentRestrictions: { country: string };
      language?: string;
    },
    callback: (predictions: GoogleAutocompletePrediction[] | null, status: string) => void
  ) => void;
}

type AutocompleteServiceCtor = new () => AutocompleteServiceInstance;

interface GoogleGeocoderResult {
  formatted_address?: string;
  address_components?: GoogleAddressComponent[];
}

interface GoogleGeocoderInstance {
  geocode: (
    request: { placeId?: string; address?: string; componentRestrictions?: { country: string } },
    callback: (results: GoogleGeocoderResult[] | null, status: string) => void
  ) => void;
}

type GeocoderCtor = new () => GoogleGeocoderInstance;

interface GoogleAutocompleteSessionToken {}

type AutocompleteSessionTokenCtor = new () => GoogleAutocompleteSessionToken;

interface PlacesServiceInstance {
  getDetails: (
    request: { placeId: string; fields: string[]; sessionToken?: GoogleAutocompleteSessionToken },
    callback: (result: GooglePlaceResult | null, status: string) => void
  ) => void;
}

type PlacesServiceCtor = new (attrContainer: HTMLElement | unknown) => PlacesServiceInstance;

interface GoogleMapsGlobal {
  maps?: {
    importLibrary?: (libraryName: string) => Promise<Record<string, unknown>>;
    Geocoder?: GeocoderCtor;
    GeocoderStatus?: { OK: string };
    places?: {
      AutocompleteService?: AutocompleteServiceCtor;
      AutocompleteSessionToken?: AutocompleteSessionTokenCtor;
      PlacesService?: PlacesServiceCtor;
      PlacesServiceStatus?: { OK: string; ZERO_RESULTS?: string };
      AutocompleteServiceStatus?: { OK: string; ZERO_RESULTS?: string };
    };
  }
}

declare global {
  interface Window {
    google?: GoogleMapsGlobal;
    gm_authFailure?: () => void;
  }
}

let googleScriptLoaded = false;
let googleScriptPromise: Promise<void> | null = null;
let googleAuthFailed = false;
const authFailureListeners = new Set<() => void>();

function hasPlacesServices(): boolean {
  const places = window.google?.maps?.places;
  return Boolean(places?.AutocompleteService && places?.PlacesService);
}

async function waitForPlaces(timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (hasPlacesServices()) {
      return;
    }
    const importLibrary = window.google?.maps?.importLibrary;
    if (typeof importLibrary === "function") {
      try {
        await importLibrary("places");
        if (hasPlacesServices()) return;
      } catch {
        // fall through and retry polling
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Google Places Autocomplete non disponibile (timeout)");
}

async function ensurePlacesLibrary(): Promise<void> {
  if (hasPlacesServices()) return;
  await waitForPlaces();
}

if (typeof window !== "undefined") {
  window.gm_authFailure = () => {
    googleAuthFailed = true;
    console.error(
      "[AddressAutocomplete] Google Maps auth failure: chiave API non valida, dominio non autorizzato, o Places API non abilitata. " +
        "Verifica https://console.cloud.google.com/google/maps-apis/credentials"
    );
    authFailureListeners.forEach((fn) => fn());
  };
}

function loadGoogleMapsScript(): Promise<void> {
  if (googleScriptLoaded && hasPlacesServices()) {
    return Promise.resolve();
  }
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    if (hasPlacesServices()) {
      googleScriptLoaded = true;
      resolve();
      return;
    }
    if (!GOOGLE_MAPS_API_KEY) {
      googleScriptPromise = null;
      reject(new Error("VITE_GOOGLE_MAPS_API_KEY non configurata"));
      return;
    }

    // Reuse pre-existing script tag if present
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    );
    const handleReady = () => {
      ensurePlacesLibrary()
        .then(() => {
          googleScriptLoaded = true;
          resolve();
        })
        .catch((error) => {
          googleScriptPromise = null;
          reject(error);
        });
    };
    const handleErr = () => {
      googleScriptPromise = null;
      reject(new Error("Failed to load Google Maps script (network/blocked)"));
    };

    if (existing) {
      if (window.google?.maps) {
        handleReady();
      } else {
        existing.addEventListener("load", handleReady, { once: true });
        existing.addEventListener("error", handleErr, { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=it&loading=async&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = handleReady;
    script.onerror = handleErr;
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

function cleanProvinceName(name: string): string {
  return name
    .replace(/^(Città\s+Metropolitana\s+di\s+|Provincia\s+di\s+|Libero\s+Consorzio\s+Comunale\s+di\s+)/i, "")
    .trim();
}

function parseAddressText(text: string): Partial<AddressComponents> {
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^italia$/i.test(part));

  const capMatch = text.match(/\b\d{5}\b/);
  const cap = capMatch?.[0] || "";
  const provinciaIndex = parts.findIndex((part) => /^\(?[A-Z]{2}\)?$/i.test(part));
  const provincia = provinciaIndex >= 0 ? parts[provinciaIndex].replace(/[^A-Za-z]/g, "").toUpperCase() : "";

  let citta = "";
  if (cap) {
    const capPart = parts.find((part) => part.includes(cap));
    citta = capPart?.replace(cap, "").trim() || "";
  }
  if (!citta && provinciaIndex > 0) citta = parts[provinciaIndex - 1];

  const addressParts = provinciaIndex >= 0 ? parts.slice(0, Math.max(0, provinciaIndex - 1)) : parts.slice(0, 2);
  let indirizzo = addressParts.join(", ").replace(cap, "").trim();
  if (/^\d+[A-Za-z]?$/i.test(addressParts[0] || "") && addressParts[1]) {
    indirizzo = `${addressParts[1]}, ${addressParts[0]}`;
  }

  return { indirizzo, cap, citta, provincia };
}

function mergeAddressComponents(primary: AddressComponents, fallback: Partial<AddressComponents>): AddressComponents {
  return {
    indirizzo: primary.indirizzo || fallback.indirizzo || "",
    cap: primary.cap || fallback.cap || "",
    citta: primary.citta || fallback.citta || "",
    provincia: primary.provincia || fallback.provincia || "",
  };
}

function extractAddressComponents(place: GooglePlaceResult, fallbackText = ""): AddressComponents {
  const components = place.address_components || [];
  let street_number = "";
  let route = "";
  let cap = "";

  let cittaLocality = "";
  let cittaLevel3 = "";
  let cittaPostalTown = "";
  let cittaSublocality = "";
  let cittaLevel2 = "";
  let provinciaShort = "";
  let provinciaLong = "";

  for (const c of components) {
    const types: string[] = c.types;
    if (types.includes("street_number")) street_number = c.long_name;
    else if (types.includes("route")) route = c.long_name;
    else if (types.includes("postal_code")) cap = c.long_name;
    else if (types.includes("locality")) cittaLocality = c.long_name;
    else if (types.includes("postal_town")) cittaPostalTown = c.long_name;
    else if (types.includes("administrative_area_level_3")) cittaLevel3 = c.long_name;
    else if (types.includes("sublocality") || types.includes("sublocality_level_1")) cittaSublocality = c.long_name;
    else if (types.includes("administrative_area_level_2")) {
      provinciaShort = c.short_name;
      provinciaLong = c.long_name;
      cittaLevel2 = c.long_name;
    }
  }

  const citta =
    cittaLocality || cittaPostalTown || cittaLevel3 || cittaSublocality || cleanProvinceName(cittaLevel2) || "";

  let provincia = "";
  const cleanedShort = cleanProvinceName(provinciaShort || "");
  if (cleanedShort && /^[A-Za-z]{2}$/.test(cleanedShort)) {
    provincia = cleanedShort.toUpperCase();
  } else if (provinciaLong) {
    const cleanedLong = cleanProvinceName(provinciaLong);
    provincia = cleanedLong.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
  }

  if (!cap) console.warn("[AddressAutocomplete] CAP non disponibile");
  if (!citta) console.warn("[AddressAutocomplete] Città non disponibile");
  if (!provincia) console.warn("[AddressAutocomplete] Provincia non disponibile");

  let indirizzo = [route, street_number].filter(Boolean).join(", ");
  if (!indirizzo && place.formatted_address) {
    // Fallback: take first segment before comma
    indirizzo = place.formatted_address.split(",")[0].trim();
  }

  const parsed = mergeAddressComponents(
    { indirizzo, cap, citta, provincia },
    parseAddressText(fallbackText || place.formatted_address || "")
  );

  if (!parsed.cap) console.warn("[AddressAutocomplete] CAP non disponibile");
  if (!parsed.citta) console.warn("[AddressAutocomplete] Città non disponibile");
  if (!parsed.provincia) console.warn("[AddressAutocomplete] Provincia non disponibile");

  return parsed;
}

const AddressAutocomplete = ({
  value,
  onChange,
  onSelect,
  placeholder = "Cerca indirizzo...",
  id,
  className,
  disabled,
}: AddressAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<GoogleAutocompleteInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError("Chiave Google Maps mancante");
      return;
    }
    const onAuthFail = () => setError("Autocomplete non disponibile — verifica chiave/dominio Google Maps");
    authFailureListeners.add(onAuthFail);
    if (googleAuthFailed) onAuthFail();
    loadGoogleMapsScript()
      .then(() => setReady(true))
      .catch((e) => {
        console.error(e);
        setError("Autocomplete non disponibile");
      });
    return () => { authFailureListeners.delete(onAuthFail); };
  }, []);

  const initAutocomplete = useCallback(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return;
    const Autocomplete = AutocompleteCtorCached ?? window.google?.maps?.places?.Autocomplete;
    if (!Autocomplete) {
      setReady(false);
      setError("Autocomplete non disponibile");
      return;
    }

    const ac = new Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "it" },
      fields: ["address_components", "formatted_address", "place_id", "name", "geometry"],
    });

    const handleParsed = (place: GooglePlaceResult) => {
      const parsed = extractAddressComponents(place);
      onChange(parsed.indirizzo || place.formatted_address || "");
      onSelect?.(parsed);
    };

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (place.address_components && place.address_components.length > 0) {
        handleParsed(place);
        return;
      }
      // Fallback: fetch full details via PlacesService
      const PlacesService = window.google?.maps?.places?.PlacesService;
      if (place.place_id && PlacesService && inputRef.current) {
        try {
          const svc = new PlacesService(inputRef.current);
          svc.getDetails(
            {
              placeId: place.place_id,
              fields: ["address_components", "formatted_address", "name", "geometry"],
            },
            (result, status) => {
              const okStatus = window.google?.maps?.places?.PlacesServiceStatus?.OK ?? "OK";
              if (status === okStatus && result) handleParsed(result);
              else console.warn("[AddressAutocomplete] getDetails fallito:", status);
            }
          );
        } catch (err) {
          console.warn("[AddressAutocomplete] PlacesService non disponibile:", err);
        }
      } else {
        console.warn("[AddressAutocomplete] place senza address_components né place_id");
      }
    });

    autocompleteRef.current = ac;
  }, [ready, onChange, onSelect]);

  useEffect(() => {
    initAutocomplete();
  }, [initAutocomplete]);

  useEffect(() => {
    return () => {
      document.querySelectorAll(".pac-container").forEach((el) => el.remove());
    };
  }, []);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoComplete="off"
      />
      {ready && !error && (
        <MapPin className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      )}
      {error && (
        <p className="text-xs text-destructive mt-1">{error} — inserisci CAP, città e provincia manualmente.</p>
      )}
    </div>
  );
};

export default AddressAutocomplete;
