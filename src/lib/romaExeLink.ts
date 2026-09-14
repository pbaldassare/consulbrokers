import { resolveRomaExeRamo, type CatalogoRamoCBnet, type RomaExeRamoRisolto } from "@/lib/romaExeRami";
import {
  resolveRomaExeCompagnia,
  type CatalogoCompagniaCBnet,
  type CatalogoGruppoCompagnia,
  type RomaExeCompagniaRisolta,
} from "@/lib/romaExeCompagnie";

export type RomaExeRefs = {
  ramo: RomaExeRamoRisolto | null;
  compagnia: RomaExeCompagniaRisolta | null;
};

/** Collega rami + compagnia EXE ai record CBnet già in catalogo. */
export function resolveRomaExeRefs(
  input: {
    ramoCodice?: string | number | null;
    ramoDescrizione?: string | null;
    compagniaNome?: string | null;
  },
  cataloghi: {
    rami: CatalogoRamoCBnet[];
    compagnie: CatalogoCompagniaCBnet[];
    gruppi?: CatalogoGruppoCompagnia[];
  },
): RomaExeRefs {
  return {
    ramo: resolveRomaExeRamo(input.ramoCodice, input.ramoDescrizione, cataloghi.rami),
    compagnia: resolveRomaExeCompagnia(input.compagniaNome, cataloghi.compagnie, cataloghi.gruppi ?? []),
  };
}
