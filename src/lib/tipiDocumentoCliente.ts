/** Tipologie documento caricabili manualmente su anagrafica cliente (backoffice). */
export const TIPI_DOCUMENTO_CLIENTE_STAFF: { value: string; label: string }[] = [
  { value: "incarico", label: "Incarico" },
  { value: "mandato", label: "Mandato" },
  { value: "lettera_incarico", label: "Lettera d'incarico" },
  { value: "contratto_brokeraggio", label: "Contratto di brokeraggio" },
  { value: "privacy_gdpr", label: "Privacy / GDPR" },
  { value: "documento_identita", label: "Documento identità" },
  { value: "visura", label: "Visura / camerale" },
  { value: "quietanza", label: "Quietanza" },
  { value: "appendice", label: "Appendice" },
  { value: "comunicazione_compagnia", label: "Comunicazione compagnia" },
  { value: "altro", label: "Altro" },
];

export function labelTipoDocumento(categoria: string | null | undefined): string {
  if (!categoria) return "—";
  const hit = TIPI_DOCUMENTO_CLIENTE_STAFF.find((t) => t.value === categoria);
  if (hit) return hit.label;
  return categoria.replace(/_/g, " ");
}
