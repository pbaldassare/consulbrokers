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

declare global {
  interface Window {
    google?: any;
  }
}

let googleScriptLoaded = false;
let googleScriptPromise: Promise<void> | null = null;

function loadGoogleMapsScript(): Promise<void> {
  if (googleScriptLoaded && window.google?.maps?.places) {
    return Promise.resolve();
  }
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      googleScriptLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=it`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      googleScriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

function extractAddressComponents(place: any): AddressComponents {
  const components: any[] = place.address_components || [];
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
  const autocompleteRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;
    loadGoogleMapsScript().then(() => setReady(true)).catch(console.error);
  }, []);

  const initAutocomplete = useCallback(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return;

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
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
      {ready && (
        <MapPin className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      )}
    </div>
  );
};

export default AddressAutocomplete;
