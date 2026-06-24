import {
  extractUfficioIds,
  isConsulbrokersContoTipo,
  type ContoBancarioConSedi,
} from "@/lib/contiBancariSedi";

export interface FilterContiBancariContext {
  ruolo?: string | null;
  ufficioId?: string | null;
}

/** Admin e CFO vedono tutti i conti attivi; gli altri solo quelli con la propria sede abilitata. */
export const bypassesSedeFilterContiBancari = (ruolo?: string | null): boolean =>
  ruolo === "admin" || ruolo === "cfo";

export const contoBancarioVisibilePerSede = (
  conto: ContoBancarioConSedi,
  ctx: FilterContiBancariContext,
): boolean => {
  if (!isConsulbrokersContoTipo(conto.tipo)) return true;
  if (bypassesSedeFilterContiBancari(ctx.ruolo)) return true;
  if (!ctx.ufficioId) return false;
  return extractUfficioIds(conto).includes(ctx.ufficioId);
};

export const filterContiBancariPerSede = <T extends ContoBancarioConSedi>(
  conti: T[],
  ctx: FilterContiBancariContext,
): T[] => conti.filter((c) => contoBancarioVisibilePerSede(c, ctx));
