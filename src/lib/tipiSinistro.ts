export interface TipoSinistroDef {
  value: string;
  label: string;
  isVeicolo?: boolean;
}

export const TIPI_SINISTRO: TipoSinistroDef[] = [
  { value: "atti_vandalici", label: "Atti vandalici" },
  { value: "atti_vandalici_auto", label: "Atti vandalici auto", isVeicolo: true },
  { value: "auto_guasti_kasko", label: "Auto guasti / Kasko", isVeicolo: true },
  { value: "auto_varie", label: "Auto varie", isVeicolo: true },
  { value: "cristalli", label: "Cristalli", isVeicolo: true },
  { value: "danno_acqua", label: "Danno d'acqua" },
  { value: "danno_indiretto", label: "Danno indiretto" },
  { value: "difesa_legale", label: "Difesa legale" },
  { value: "evento_naturale", label: "Evento naturale" },
  { value: "fenomeno_elettrico", label: "Fenomeno elettrico" },
  { value: "grandine", label: "Grandine" },
  { value: "incendio", label: "Incendio" },
  { value: "furto", label: "Furto" },
  { value: "infortunio_non_mortale", label: "Infortunio non mortale" },
  { value: "malattia", label: "Malattia" },
  { value: "rc_professionale", label: "RC Professionale" },
  { value: "rc_sanitaria", label: "RC Sanitaria" },
  { value: "rca_danni_a_cose", label: "RCA danni a cose", isVeicolo: true },
  { value: "rca_danni_a_persone", label: "RCA danni a persone", isVeicolo: true },
  { value: "rct_danni_a_cose", label: "RCT danni a cose" },
  { value: "rct_danni_a_persone_non_mortale", label: "RCT danni a persone (non mortale)" },
  { value: "rct_danni_a_persone_mortale", label: "RCT danni a persone (mortale)" },
  { value: "rct_danni_a_persone_e_cose", label: "RCT danni a persone e cose" },
  { value: "rc_patrimoniale", label: "RC Patrimoniale" },
  { value: "rischio_montaggio", label: "Rischio montaggio" },
  { value: "urto_veicolo_non_identificato", label: "Urto veicolo non identificato", isVeicolo: true },
];

export const TIPO_SINISTRO_LABELS: Record<string, string> = TIPI_SINISTRO.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }),
  {} as Record<string, string>
);

export const getTipoSinistroLabel = (v?: string | null) =>
  v ? TIPO_SINISTRO_LABELS[v] || v.replace(/_/g, " ") : "—";

/**
 * Formatta il tipo di sinistro mostrando il valore personalizzato (se valorizzato)
 * con prefisso "Personalizzato:", altrimenti la label del tipo predefinito.
 */
export const formatTipoSinistro = (
  s: { tipo_sinistro?: string | null; tipo_sinistro_personalizzato?: string | null } | null | undefined
): string => {
  if (!s) return "—";
  if (s.tipo_sinistro_personalizzato && s.tipo_sinistro_personalizzato.trim()) {
    return `Personalizzato: ${s.tipo_sinistro_personalizzato.trim()}`;
  }
  return getTipoSinistroLabel(s.tipo_sinistro);
};
