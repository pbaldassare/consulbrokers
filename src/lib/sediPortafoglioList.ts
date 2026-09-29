/**
 * Listing portafoglio sede: classifica PI / PQ / AM / PR / PS e aggrega
 * anagrafiche, compagnie e extra senza SQL ad hoc sul solo `sostituisce_polizza`.
 *
 * - PI = polizza (prima rata), anche se stato=stornato
 * - PQ = rata successiva (figlia, non appendice, non storno)
 * - AM / AP / PR = flag appendice
 * - PS = titolo di storno (compensazione), non la polizza stornata
 * - DP non è un titolo: vive solo nel file gestionale
 */
import { money, normalizeNumeroPolizza, trimTxt } from "@/lib/campobassoPolizze";
import { isAppendice, isPolizzaMadre } from "@/lib/quietanze";
import {
  fileClienteCodiceCanonico,
  fileClienteKey,
  fileTipoTitolo,
  mapCompagniaCodiceSede,
  type SedeCodice,
  type SediTipoFile,
} from "@/lib/sediImportShared";

export type SediTipoGestione = "PI" | "PQ" | "AM" | "AP" | "PR" | "PS" | "altro";

export type SediTitoloListLike = {
  id?: string;
  numero_titolo?: string | null;
  riga?: number | null;
  cliente_anagrafica_id?: string | null;
  compagnia_id?: string | null;
  ufficio_id?: string | null;
  stato?: string | null;
  premio_lordo?: number | null;
  premio_netto?: number | null;
  tasse?: number | null;
  provvigioni?: number | null;
  sostituisce_polizza?: string | null;
  is_appendice_modifica?: boolean | null;
  is_regolazione?: boolean | null;
  is_proroga?: boolean | null;
  causale_storno?: string | null;
  data_storno?: string | null;
  data_messa_cassa?: string | null;
  note?: string | null;
  prodotto_nome?: string | null;
  garanzia_da?: string | null;
  garanzia_a?: string | null;
};

export type SediClienteListLike = {
  id: string;
  codice_ricerca?: string | null;
  codice_cliente?: string | null;
  ragione_sociale?: string | null;
  nome?: string | null;
  cognome?: string | null;
  ufficio_id?: string | null;
};

export type SediCompagniaListLike = {
  id: string;
  codice?: string | null;
  nome?: string | null;
};

export type SediFileRigaListLike = {
  TipoTit?: unknown;
  TipoDoc?: unknown;
  CdClie?: unknown;
  "Nome CLiente"?: unknown;
  CdComp?: unknown;
  "Nome Compagnia"?: unknown;
  Polizza?: unknown;
  Premio?: unknown;
  Attive?: unknown;
  "Dt Incasso"?: unknown;
  [key: string]: unknown;
};

/** Titolo di storno (PS), non la polizza madre con stato=stornato. */
export function isTitoloStorno(t: SediTitoloListLike): boolean {
  if (trimTxt(t.causale_storno)) return true;
  const note = trimTxt(t.note).toLowerCase();
  if (note.includes("storno gestionale ps") || note.includes("storno gestionale")) return true;
  if (t.data_storno && t.sostituisce_polizza) return true;
  const lordo = Number(t.premio_lordo);
  if (t.sostituisce_polizza && Number.isFinite(lordo) && lordo < 0) {
    if (t.stato === "stornato" || note.includes("storno")) return true;
  }
  return false;
}

export function classifyTitoloGestione(t: SediTitoloListLike): SediTipoGestione {
  if (t.is_regolazione) return "PR";
  if (t.is_proroga) return "AP";
  if (t.is_appendice_modifica) return "AM";
  if (isTitoloStorno(t)) return "PS";
  if (isPolizzaMadre(t)) return "PI";
  if (t.sostituisce_polizza && !isAppendice(t)) return "PQ";
  return "altro";
}

export function clienteDisplayNome(c: SediClienteListLike): string {
  return (
    trimTxt(c.ragione_sociale) ||
    `${trimTxt(c.cognome)} ${trimTxt(c.nome)}`.trim() ||
    trimTxt(c.codice_ricerca) ||
    c.id
  );
}

export type SediAnagraficaLista = {
  id: string;
  codice: string;
  nome: string;
  numPolizze: number;
  numTitoli: number;
  lordo: number;
  provvigioni: number;
};

export type SediCompagniaLista = {
  id: string;
  codice: string;
  nome: string;
  numTitoli: number;
  numPolizze: number;
  lordo: number;
};

export type SediCatenaLista = {
  chiave: string;
  numero: string;
  clienteId: string | null;
  compagniaId: string | null;
  polizza: SediTitoloListLike | null;
  quietanze: SediTitoloListLike[];
  extra: SediTitoloListLike[];
};

export type SediPortafoglioLista = {
  sede: SedeCodice | null;
  anagrafiche: {
    conPortafoglio: SediAnagraficaLista[];
    senzaPortafoglioCount: number;
  };
  compagnie: SediCompagniaLista[];
  polizze: SediTitoloListLike[];
  quietanze: SediTitoloListLike[];
  extra: {
    AM: SediTitoloListLike[];
    AP: SediTitoloListLike[];
    PR: SediTitoloListLike[];
    PS: SediTitoloListLike[];
    altro: SediTitoloListLike[];
  };
  catene: SediCatenaLista[];
  stats: Record<string, number>;
};

function moneyOf(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function emptyTipoStats(): Record<SediTipoGestione, number> {
  return { PI: 0, PQ: 0, AM: 0, AP: 0, PR: 0, PS: 0, altro: 0 };
}

export function listSediPortafoglio(input: {
  sede?: SedeCodice | null;
  clienti: SediClienteListLike[];
  titoli: SediTitoloListLike[];
  compagnie: SediCompagniaListLike[];
}): SediPortafoglioLista {
  const byCliente = new Map<string, SediTitoloListLike[]>();
  const byCompagnia = new Map<string, SediTitoloListLike[]>();
  const classified = input.titoli.map((t) => ({ t, tipo: classifyTitoloGestione(t) }));
  const tipoCount = emptyTipoStats();
  const polizze: SediTitoloListLike[] = [];
  const quietanze: SediTitoloListLike[] = [];
  const extra = { AM: [] as SediTitoloListLike[], AP: [] as SediTitoloListLike[], PR: [] as SediTitoloListLike[], PS: [] as SediTitoloListLike[], altro: [] as SediTitoloListLike[] };

  let lordo = 0;
  let provvigioni = 0;
  let incassati = 0;
  let attivi = 0;
  let stornati = 0;

  for (const { t, tipo } of classified) {
    tipoCount[tipo] += 1;
    lordo += moneyOf(t.premio_lordo);
    provvigioni += moneyOf(t.provvigioni);
    if (t.stato === "incassato") incassati += 1;
    else if (t.stato === "attivo") attivi += 1;
    else if (t.stato === "stornato") stornati += 1;
    if (tipo === "PI") polizze.push(t);
    else if (tipo === "PQ") quietanze.push(t);
    else extra[tipo].push(t);
    const cli = t.cliente_anagrafica_id;
    if (cli) {
      const list = byCliente.get(cli) ?? [];
      list.push(t);
      byCliente.set(cli, list);
    }
    const comp = t.compagnia_id;
    if (comp) {
      const list = byCompagnia.get(comp) ?? [];
      list.push(t);
      byCompagnia.set(comp, list);
    }
  }

  const conPortafoglio: SediAnagraficaLista[] = [];
  let senzaPortafoglioCount = 0;
  for (const c of input.clienti) {
    const rows = byCliente.get(c.id) ?? [];
    if (!rows.length) {
      senzaPortafoglioCount += 1;
      continue;
    }
    conPortafoglio.push({
      id: c.id,
      codice: trimTxt(c.codice_ricerca) || trimTxt(c.codice_cliente),
      nome: clienteDisplayNome(c),
      numPolizze: rows.filter((t) => classifyTitoloGestione(t) === "PI").length,
      numTitoli: rows.length,
      lordo: rows.reduce((s, t) => s + moneyOf(t.premio_lordo), 0),
      provvigioni: rows.reduce((s, t) => s + moneyOf(t.provvigioni), 0),
    });
  }
  conPortafoglio.sort((a, b) => b.lordo - a.lordo || a.nome.localeCompare(b.nome));

  const compagnie: SediCompagniaLista[] = input.compagnie
    .map((c) => {
      const rows = byCompagnia.get(c.id) ?? [];
      if (!rows.length) return null;
      return {
        id: c.id,
        codice: trimTxt(c.codice),
        nome: trimTxt(c.nome) || trimTxt(c.codice) || c.id,
        numTitoli: rows.length,
        numPolizze: rows.filter((t) => classifyTitoloGestione(t) === "PI").length,
        lordo: rows.reduce((s, t) => s + moneyOf(t.premio_lordo), 0),
      };
    })
    .filter((c): c is SediCompagniaLista => !!c)
    .sort((a, b) => b.numTitoli - a.numTitoli || a.nome.localeCompare(b.nome));

  const cateneMap = new Map<string, SediCatenaLista>();
  for (const { t, tipo } of classified) {
    const numero = normalizeNumeroPolizza(t.numero_titolo).replace(/\/(AM|PR|RG)\d+$/i, "") || "?";
    const chiave = `${numero}|${t.compagnia_id || "?"}|${t.cliente_anagrafica_id || "?"}`;
    const catena = cateneMap.get(chiave) ?? {
      chiave,
      numero,
      clienteId: t.cliente_anagrafica_id ?? null,
      compagniaId: t.compagnia_id ?? null,
      polizza: null,
      quietanze: [],
      extra: [],
    };
    if (tipo === "PI") catena.polizza = t;
    else if (tipo === "PQ") catena.quietanze.push(t);
    else catena.extra.push(t);
    cateneMap.set(chiave, catena);
  }

  return {
    sede: input.sede ?? null,
    anagrafiche: { conPortafoglio, senzaPortafoglioCount },
    compagnie,
    polizze,
    quietanze,
    extra,
    catene: [...cateneMap.values()],
    stats: {
      clientiSede: input.clienti.length,
      clientiConTitoli: conPortafoglio.length,
      clientiSenzaTitoli: senzaPortafoglioCount,
      titoli: input.titoli.length,
      ...tipoCount,
      compagnieUsate: compagnie.length,
      incassati,
      attivi,
      stornati,
      lordo: Math.round(lordo * 100) / 100,
      provvigioni: Math.round(provvigioni * 100) / 100,
    },
  };
}

export type SediFileAnagrafica = {
  codiceFile: string;
  codiceCanonico: string;
  nome: string;
  numRighe: number;
  tipi: Partial<Record<SediTipoFile, number>>;
};

export type SediFileCompagnia = {
  codiceFile: string;
  codiceCanonico: string;
  nome: string;
  numRighe: number;
};

export type SediFileLista = {
  anagrafiche: SediFileAnagrafica[];
  compagnie: SediFileCompagnia[];
  perTipo: Record<SediTipoFile, SediFileRigaListLike[]>;
  stats: Record<string, number>;
};

export function listSediFile(rows: SediFileRigaListLike[]): SediFileLista {
  const perTipo: Record<SediTipoFile, SediFileRigaListLike[]> = {
    PI: [], PQ: [], AM: [], AP: [], PR: [], PS: [], DP: [], altro: [],
  };
  const anag = new Map<string, SediFileAnagrafica>();
  const comp = new Map<string, SediFileCompagnia>();

  for (const r of rows) {
    const tipo = fileTipoTitolo(r.TipoTit || r.TipoDoc);
    perTipo[tipo].push(r);
    const codiceFile = fileClienteKey(r.CdClie);
    const codiceCanonico = fileClienteCodiceCanonico(r.CdClie);
    const anagKey = codiceCanonico || normalizeNumeroPolizza(r["Nome CLiente"]) || "?";
    const a = anag.get(anagKey) ?? {
      codiceFile,
      codiceCanonico,
      nome: trimTxt(r["Nome CLiente"]),
      numRighe: 0,
      tipi: {},
    };
    a.numRighe += 1;
    a.tipi[tipo] = (a.tipi[tipo] || 0) + 1;
    if (!a.nome) a.nome = trimTxt(r["Nome CLiente"]);
    anag.set(anagKey, a);

    const codiceFileComp = trimTxt(r.CdComp).toUpperCase();
    const codiceCanonicoComp = mapCompagniaCodiceSede(r.CdComp);
    if (codiceCanonicoComp) {
      const c = comp.get(codiceCanonicoComp) ?? {
        codiceFile: codiceFileComp,
        codiceCanonico: codiceCanonicoComp,
        nome: trimTxt(r["Nome Compagnia"]),
        numRighe: 0,
      };
      c.numRighe += 1;
      if (!c.nome) c.nome = trimTxt(r["Nome Compagnia"]);
      comp.set(codiceCanonicoComp, c);
    }
  }

  const anagrafiche = [...anag.values()].sort((a, b) => b.numRighe - a.numRighe || a.nome.localeCompare(b.nome));
  const compagnie = [...comp.values()].sort((a, b) => b.numRighe - a.numRighe || a.nome.localeCompare(b.nome));
  const lordo = rows.reduce((s, r) => s + money(r.Premio), 0);
  const provvigioni = rows.reduce((s, r) => s + money(r.Attive), 0);

  return {
    anagrafiche,
    compagnie,
    perTipo,
    stats: {
      righe: rows.length,
      PI: perTipo.PI.length,
      PQ: perTipo.PQ.length,
      AM: perTipo.AM.length,
      AP: perTipo.AP.length,
      PR: perTipo.PR.length,
      PS: perTipo.PS.length,
      DP: perTipo.DP.length,
      altro: perTipo.altro.length,
      anagrafiche: anagrafiche.length,
      compagnie: compagnie.length,
      lordo: Math.round(lordo * 100) / 100,
      provvigioni: Math.round(provvigioni * 100) / 100,
    },
  };
}
