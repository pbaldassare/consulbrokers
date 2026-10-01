import { normalizeNumeroPolizza, trimTxt } from "@/lib/campobassoPolizze";

export const CATANIA_COMPAGNIA_ALIAS: Record<string, string> = {
  ASSISA: "ASSI00",
  ELBA00: "ELB000",
};

export const CATANIA_RAMO_ALIAS: Record<string, string> = {
  // Decisione broker 01/10/2026: FG1 va ricondotto al ramo Cauzioni esistente.
  FG1: "CA",
};

export const CATANIA_AM_SENZA_MADRE = new Set(["118917057", "118862287"]);

export type CataniaPolizzaRiga = Record<string, unknown>;

export type CataniaPolizzaGruppo = {
  chiave: string;
  numero: string;
  codiceCompagnia: string;
  codiceCliente: string;
  righe: CataniaPolizzaRiga[];
  madre: CataniaPolizzaRiga | null;
  quietanze: CataniaPolizzaRiga[];
  appendici: CataniaPolizzaRiga[];
  storni: CataniaPolizzaRiga[];
  promossaDaPq: boolean;
  escluso: boolean;
  motivo: string | null;
};

export function normalizeCataniaNumero(raw: unknown): string {
  return normalizeNumeroPolizza(raw).replace(/[._]+$/g, "");
}

export function mapCataniaCompagnia(raw: unknown): string {
  const code = trimTxt(raw).toUpperCase();
  return CATANIA_COMPAGNIA_ALIAS[code] ?? code;
}

export function mapCataniaRamo(raw: unknown): string {
  const code = trimTxt(raw).toUpperCase();
  return CATANIA_RAMO_ALIAS[code] ?? code;
}

export function mapCataniaProduttore(raw: unknown): string | null {
  const value = trimTxt(raw).replace(/\s+/g, " ");
  if (!value) return null;
  if (/TRANQUILLO/i.test(value) && /INTERFIDI/i.test(value)) return "INTERFIDI SRL";
  return value.toUpperCase();
}

export function mapCataniaAe(raw: unknown): string | null {
  const value = trimTxt(raw).toUpperCase();
  return value === "RONDINELLA SALVATORE" ? value : null;
}

export function mapCataniaSpecialist(raw: unknown): string | null {
  const value = trimTxt(raw).toUpperCase();
  if (value === "TURCO ALIDA") return "Turco Alida";
  if (value === "GUARRACINO GAETANO") return "Guarracino Gaetano";
  return value || null;
}

function tipo(row: CataniaPolizzaRiga): string {
  return trimTxt(row.TipoDoc || row.TipoTit).toUpperCase();
}

function rowDate(row: CataniaPolizzaRiga): string {
  return trimTxt(row["Iniz Gar"] || row["Iniz Pol"]);
}

export function groupCataniaPolizze(rows: CataniaPolizzaRiga[]): CataniaPolizzaGruppo[] {
  const grouped = new Map<string, CataniaPolizzaRiga[]>();
  for (const row of rows) {
    const numero = normalizeCataniaNumero(row.Polizza);
    const compagnia = mapCataniaCompagnia(row.CdComp);
    const cliente = trimTxt(row.CdClie).toUpperCase();
    const key = `${numero}|${compagnia}|${cliente}`;
    const current = grouped.get(key);
    if (current) current.push(row);
    else grouped.set(key, [row]);
  }

  return [...grouped.entries()].map(([chiave, righe]) => {
    const [numero, codiceCompagnia, codiceCliente] = chiave.split("|");
    const sorted = [...righe].sort((a, b) => rowDate(a).localeCompare(rowDate(b)));
    const pi = sorted.filter((row) => tipo(row) === "PI");
    const pq = sorted.filter((row) => tipo(row) === "PQ");
    const appendici = sorted.filter((row) => tipo(row) === "AM");
    const storni = sorted.filter((row) => tipo(row) === "PS");
    const madre = pi[0] ?? pq[0] ?? null;
    const promossaDaPq = !pi.length && !!pq.length;
    const quietanze = pi.length ? pq : pq.slice(1);
    const soloAppendici = !pi.length && !pq.length && appendici.length > 0;
    const escluso = soloAppendici && CATANIA_AM_SENZA_MADRE.has(numero);

    return {
      chiave,
      numero,
      codiceCompagnia,
      codiceCliente,
      righe: sorted,
      madre,
      quietanze,
      appendici,
      storni,
      promossaDaPq,
      escluso,
      motivo: escluso ? "Appendice senza polizza madre" : null,
    };
  });
}
