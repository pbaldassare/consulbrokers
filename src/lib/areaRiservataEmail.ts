/** Link fisso del portale cliente (mai origin locale / IP di sviluppo). */
export const PORTALE_CLIENTE_URL = "https://cbnet.it/cliente";

/** Password di primo accesso / reset (allineata al provisioning). */
export const AREA_RISERVATA_PASSWORD = "Leone123!";

export type AreaRiservataEmailMode = "attivazione" | "reset";

export function labelTipoAccessoAreaRiservata(tipo: string): string {
  return tipo === "completa"
    ? "Completo (lettura e caricamento documenti)"
    : "Solo Visualizzazione (consultazione e messaggi)";
}

export function areaRiservataEmailSubject(mode: AreaRiservataEmailMode): string {
  return mode === "reset"
    ? "Password area riservata resettata — Consulbrokers"
    : "Attivazione della Sua Area Riservata Cliente";
}

export function buildAreaRiservataEmail(opts: {
  mode: AreaRiservataEmailMode;
  clienteName: string;
  email?: string | null;
  tipo: string;
}): string {
  const name = opts.clienteName.trim() || "Cliente";
  const username = (opts.email || "").trim() || "—";
  const tipoLabel = labelTipoAccessoAreaRiservata(opts.tipo);
  const intro =
    opts.mode === "reset"
      ? "La password della sua area riservata è stata resettata. Può accedere al portale utilizzando le seguenti credenziali:"
      : "La sua area riservata è stata attivata. Può accedere al portale utilizzando le seguenti credenziali:";

  return `Gentile ${name},

${intro}

Username: ${username}
Password: ${AREA_RISERVATA_PASSWORD}

Tipo di accesso: ${tipoLabel}

Link al portale: ${PORTALE_CLIENTE_URL}

Si consiglia di cambiare la password al primo accesso.

Cordiali saluti,
Consulbrokers S.r.l.`;
}
