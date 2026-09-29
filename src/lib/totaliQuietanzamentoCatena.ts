import { getProvvigioneEC, type TitoloProvvigioneEC } from "@/lib/getProvvigioneEC";
import { isCatenaModelloVecchio } from "@/lib/promuoviPrimaQuietanza";

/**
 * Totali premio/provvigioni del quietanzamento di una catena polizza.
 *
 * Nuovo modello: la polizza è la prima rata — si somma madre + quietanze successive.
 * Vecchio modello (madre duplica la prima quietanza sullo stesso periodo): somma solo le rate.
 * Appendici escluse (titoli da incassare a parte).
 */
export type TitoloQuietanzamentoLike = TitoloProvvigioneEC & {
  premio_lordo?: number | null;
};

export function totaliQuietanzamentoCatena(
  madre: TitoloQuietanzamentoLike | null | undefined,
  rate: TitoloQuietanzamentoLike[],
  _appendici?: TitoloQuietanzamentoLike[],
): { premio: number; provvigioni: number; count: number } {
  void _appendici; // esplicitamente fuori dal totale quietanzamento
  if (rate.length > 0) {
    const skipMadre = isCatenaModelloVecchio(madre ?? null, rate);
    let premio = 0;
    let provvigioni = 0;
    let count = 0;
    if (madre && !skipMadre) {
      premio += Number(madre.premio_lordo) || 0;
      provvigioni += getProvvigioneEC(madre);
      count += 1;
    }
    for (const t of rate) {
      premio += Number(t.premio_lordo) || 0;
      provvigioni += getProvvigioneEC(t);
      count += 1;
    }
    return { premio, provvigioni, count };
  }
  if (madre) {
    const premio = Number(madre.premio_lordo) || 0;
    const provvigioni = getProvvigioneEC(madre);
    const count = premio !== 0 || provvigioni !== 0 ? 1 : 0;
    return { premio, provvigioni, count };
  }
  return { premio: 0, provvigioni: 0, count: 0 };
}
