import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

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

interface GoogleAutocompleteInstance {
  addListener: (eventName: "place_changed", handler: () => void) => void;
  getPlace: () => GooglePlaceResult;
}

type AutocompleteCtor = new (
  input: HTMLInputElement,
  options: {
    types: string[];
    componentRestrictions: { country: string };
    fields: string[];
  }
) => GoogleAutocompleteInstance;

interface PlacesServiceInstance {
  getDetails: (
    request: { placeId: string; fields: string[] },
    callback: (result: GooglePlaceResult | null, status: string) => void
  ) => void;
}

type PlacesServiceCtor = new (attrContainer: HTMLElement | unknown) => PlacesServiceInstance;

interface GoogleMapsGlobal {
  maps?: {
    importLibrary?: (libraryName: string) => Promise<Record<string, unknown>>;
    places?: {
      Autocomplete?: AutocompleteCtor;
      PlacesService?: PlacesServiceCtor;
      PlacesServiceStatus?: { OK: string };
    };
  };
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
let AutocompleteCtorCached: AutocompleteCtor | null = null;
const authFailureListeners = new Set<() => void>();

function hasPlacesAutocomplete(): boolean {
  return Boolean(AutocompleteCtorCached || window.google?.maps?.places?.Autocomplete);
}

async function waitForPlaces(timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.google?.maps?.places?.Autocomplete) {
      AutocompleteCtorCached = window.google.maps.places.Autocomplete;
      return;
    }
    // Try modern importLibrary if available
    const importLibrary = window.google?.maps?.importLibrary;
    if (typeof importLibrary === "function") {
      try {
        const places = await importLibrary("places");
        const Ctor = (places?.Autocomplete as AutocompleteCtor | undefined) ?? window.google?.maps?.places?.Autocomplete;
        if (Ctor) {
          AutocompleteCtorCached = Ctor;
          return;
        }
      } catch {
        // fall through and retry polling
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Google Places Autocomplete non disponibile (timeout)");
}

async function ensurePlacesLibrary(): Promise<void> {
  if (AutocompleteCtorCached) return;
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
  if (googleScriptLoaded && hasPlacesAutocomplete()) {
    return Promise.resolve();
  }
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    if (hasPlacesAutocomplete()) {
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

function extractAddressComponents(place: GooglePlaceResult): AddressComponents {
  const components = place.address_components || [];
  let street_number = "";
  let route = "";
  let cap = "";
  let citta = "";

  let cittaLocality = "";
  let cittaLevel3 = "";
  let cittaPostalTown = "";
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
    else if (types.includes("administrative_area_level_2")) {
      provinciaShort = c.short_name;
      provinciaLong = c.long_name;
    }
  }

  // Fallback chain: locality → postal_town → admin_level_3
  citta = cittaLocality || cittaPostalTown || cittaLevel3 || "";

  // Provincia: prefer 2-letter short code; if missing, derive from long name (first 2 chars uppercase as last resort)
  let provincia = provinciaShort || "";
  if (!provincia && provinciaLong) {
    // Some Italian metropolitan areas return long name only (e.g. "Roma Capitale")
    provincia = provinciaLong.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
  }
  provincia = provincia.toUpperCase().slice(0, 2);

  if (!cap) console.warn("[AddressAutocomplete] CAP non disponibile dall'autocomplete Google");
  if (!citta) console.warn("[AddressAutocomplete] Città non disponibile dall'autocomplete Google");
  if (!provincia) console.warn("[AddressAutocomplete] Provincia non disponibile dall'autocomplete Google");

  const indirizzo = [route, street_number].filter(Boolean).join(", ");
  return { indirizzo, cap, citta, provincia };
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
      fields: ["address_components", "formatted_address"],
    });

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place.address_components) return;

      const parsed = extractAddressComponents(place);
      onChange(parsed.indirizzo);
      onSelect?.(parsed);
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
