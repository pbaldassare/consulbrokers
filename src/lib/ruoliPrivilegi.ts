/** Ruolo profilo Specialist in Centro Utenti (tendine: lookup `specialist` → backoffice). */
export const RUOLO_SPECIALIST = "backoffice" as const;

/** Stessi privilegi applicativi del Resp. Sede (L3, visibilità sede); in DB ruolo `backoffice`, RLS via is_staff / is_sede_operativo. */
export const RUOLI_EQUIVALENTI_RESPONSABILE_SEDE = [
  "responsabile_sede",
  RUOLO_SPECIALIST,
] as const;

export function haPrivilegiResponsabileSede(ruolo: string | null | undefined): boolean {
  if (!ruolo) return false;
  return (RUOLI_EQUIVALENTI_RESPONSABILE_SEDE as readonly string[]).includes(ruolo);
}

/** RoleGuard: se la lista ammette Resp. Sede, ammette anche Specialist e viceversa. */
export function ruoloConsentito(ruolo: string, allowedRoles: string[]): boolean {
  if (ruolo === "admin") return true;
  if (allowedRoles.includes(ruolo)) return true;
  if (
    haPrivilegiResponsabileSede(ruolo) &&
    allowedRoles.some((r) => haPrivilegiResponsabileSede(r))
  ) {
    return true;
  }
  return false;
}
