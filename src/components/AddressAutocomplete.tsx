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

function extractAddressComponents(place: google.maps.places.PlaceResult): AddressComponents {
  const components = place.address_components || [];
  let street_number = "";
  let route = "";
  let cap = "";
  let citta = "";
  let provincia = "";

  for (const c of components) {
    const types = c.types;
    if (types.includes("street_number")) street_number = c.long_name;
    else if (types.includes("route")) route = c.long_name;
    else if (types.includes("postal_code")) cap = c.long_name;
    else if (types.includes("locality") || types.includes("administrative_area_level_3")) {
      if (!citta) citta = c.long_name;
    }
    else if (types.includes("administrative_area_level_2")) provincia = c.short_name;
  }

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
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
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

  // Cleanup pac-container on unmount
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
