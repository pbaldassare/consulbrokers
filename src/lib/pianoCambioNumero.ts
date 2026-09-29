import { isAppendice, isQuietanza, type TitoloLike } from "@/lib/quietanze";

export type PianoCambioNumero =
  | { mode: "noop" }
  | { mode: "detach-quietanza"; titoloId: string; from: string; to: string }
  | { mode: "rename-chain"; titoloId: string; from: string; to: string };

/**
 * Cambio numero:
 * - quietanza → si stacca dalla catena e diventa polizza (stesso id, nuovo numero, senza sostituisce_polizza);
 * - polizza / appendice → rinomina la catena (stesso numero su madre + quietanze).
 */
export function pianoCambioNumero(
  titolo: TitoloLike & { id?: string },
  numeroNuovo: string | null | undefined,
): PianoCambioNumero {
  const to = (numeroNuovo || "").trim();
  const from = (titolo.numero_titolo || "").trim();
  if (!to || !from || to === from) return { mode: "noop" };
  if (isQuietanza(titolo) && titolo.id) {
    return { mode: "detach-quietanza", titoloId: titolo.id, from, to };
  }
  if (titolo.id && !isAppendice(titolo)) {
    return { mode: "rename-chain", titoloId: titolo.id, from, to };
  }
  if (titolo.id) {
    return { mode: "rename-chain", titoloId: titolo.id, from, to };
  }
  return { mode: "noop" };
}
