/** Parsing testuale di indirizzi italiani (fallback senza Google Places). */
export function parseAddressText(text: string): {
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
} {
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^italia$/i.test(part));

  const capMatch = text.match(/\b\d{5}\b/);
  const cap = capMatch?.[0] || "";
  const provinciaIndex = parts.findIndex((part) => /^\(?[A-Z]{2}\)?$/i.test(part));
  const provinciaMatch = text.match(/\b([A-Z]{2})\b(?=\s*,\s*Italia\b|\s*$)/i);
  const provincia = provinciaIndex >= 0
    ? parts[provinciaIndex].replace(/[^A-Za-z]/g, "").toUpperCase()
    : (provinciaMatch?.[1] || "").toUpperCase();

  let citta = "";
  if (cap) {
    const capPart = parts.find((part) => part.includes(cap));
    citta = capPart?.replace(cap, "").replace(new RegExp(`\\b${provincia}\\b`, "i"), "").trim() || "";
  }
  if (!citta && provinciaIndex > 0) citta = parts[provinciaIndex - 1];

  const addressParts = provinciaIndex >= 0 ? parts.slice(0, Math.max(0, provinciaIndex - 1)) : parts.slice(0, 2);
  let indirizzo = addressParts.join(", ").replace(cap, "").trim();
  if (/^\d+[A-Za-z]?$/i.test(addressParts[0] || "") && addressParts[1]) {
    indirizzo = `${addressParts[1]}, ${addressParts[0]}`;
  }

  return { indirizzo, cap, citta, provincia };
}
