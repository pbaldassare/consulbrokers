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
import { money, trimTxt } from "@/lib/campobassoPolizze";
import { baseNumeroPolizza } from "@/lib/quietanze";
import {
  fileClienteCodici,
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
  if (t.sostituisce_polizza === undefined) return "altro";
  return t.sostituisce_polizza ? "PQ" : "PI";
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

type Acc = { numPolizze: number; numTitoli: number; lordo: number; provvigioni: number };

function bumpAcc(map: Map<string, Acc>, id: string, tipo: SediTipoGestione, t: SediTitoloListLike) {
  const acc = map.get(id) ?? { numPolizze: 0, numTitoli: 0, lordo: 0, provvigioni: 0 };
  acc.numTitoli += 1;
  if (tipo === "PI") acc.numPolizze += 1;
  acc.lordo += moneyOf(t.premio_lordo);
  acc.provvigioni += moneyOf(t.provvigioni);
  map.set(id, acc);
}

export function listSediPortafoglio(input: {
  sede?: SedeCodice | null;
  clienti: SediClienteListLike[];
  titoli: SediTitoloListLike[];
  compagnie: SediCompagniaListLike[];
}): SediPortafoglioLista {
  const compagnieById = new Map(input.compagnie.map((c) => [c.id, c]));
  const accCli = new Map<string, Acc>();
  const accComp = new Map<string, Acc>();
  const cateneMap = new Map<string, SediCatenaLista>();
  const tipoCount: Record<SediTipoGestione, number> = { PI: 0, PQ: 0, AM: 0, AP: 0, PR: 0, PS: 0, altro: 0 };
  const polizze: SediTitoloListLike[] = [];
  const quietanze: SediTitoloListLike[] = [];
  const extra = { AM: [] as SediTitoloListLike[], AP: [] as SediTitoloListLike[], PR: [] as SediTitoloListLike[], PS: [] as SediTitoloListLike[], altro: [] as SediTitoloListLike[] };

  let lordo = 0;
  let provvigioni = 0;
  let incassati = 0;
  let attivi = 0;
  let stornati = 0;

  for (const t of input.titoli) {
    const tipo = classifyTitoloGestione(t);
    tipoCount[tipo] += 1;
    const rowLordo = moneyOf(t.premio_lordo);
    const rowProvv = moneyOf(t.provvigioni);
    lordo += rowLordo;
    provvigioni += rowProvv;
    if (t.stato === "incassato") incassati += 1;
    else if (t.stato === "attivo") attivi += 1;
    else if (t.stato === "stornato") stornati += 1;
    if (tipo === "PI") polizze.push(t);
    else if (tipo === "PQ") quietanze.push(t);
    else extra[tipo].push(t);
    if (t.cliente_anagrafica_id) bumpAcc(accCli, t.cliente_anagrafica_id, tipo, t);
    if (t.compagnia_id) bumpAcc(accComp, t.compagnia_id, tipo, t);

    const numero = baseNumeroPolizza(t.numero_titolo) || "?";
    const chiave = `${numero}|${t.compagnia_id || "?"}|${t.cliente_anagrafica_id || "?"}`;
    let catena = cateneMap.get(chiave);
    if (!catena) {
      catena = {
        chiave,
        numero,
        clienteId: t.cliente_anagrafica_id ?? null,
        compagniaId: t.compagnia_id ?? null,
        polizza: null,
        quietanze: [],
        extra: [],
      };
      cateneMap.set(chiave, catena);
    }
    if (tipo === "PI") catena.polizza = t;
    else if (tipo === "PQ") catena.quietanze.push(t);
    else catena.extra.push(t);
  }

  const conPortafoglio: SediAnagraficaLista[] = [];
  for (const c of input.clienti) {
    const acc = accCli.get(c.id);
    if (!acc) continue;
    conPortafoglio.push({
      id: c.id,
      codice: trimTxt(c.codice_ricerca) || trimTxt(c.codice_cliente),
      nome: clienteDisplayNome(c),
      ...acc,
    });
  }
  const senzaPortafoglioCount = input.clienti.length - conPortafoglio.length;
  conPortafoglio.sort((a, b) => b.lordo - a.lordo || a.nome.localeCompare(b.nome));

  const compagnie: SediCompagniaLista[] = [];
  for (const [id, acc] of accComp) {
    const c = compagnieById.get(id);
    if (!c) continue;
    compagnie.push({
      id,
      codice: trimTxt(c.codice),
      nome: trimTxt(c.nome) || trimTxt(c.codice) || id,
      ...acc,
    });
  }
  compagnie.sort((a, b) => b.numTitoli - a.numTitoli || a.nome.localeCompare(b.nome));

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
  let lordo = 0;
  let provvigioni = 0;

  for (const r of rows) {
    const tipo = fileTipoTitolo(r.TipoTit || r.TipoDoc);
    perTipo[tipo].push(r);
    lordo += money(r.Premio);
    provvigioni += money(r.Attive);
    const { file: codiceFile, canonico: codiceCanonico } = fileClienteCodici(r.CdClie);
    const nomeCli = trimTxt(r["Nome CLiente"]);
    const anagKey = codiceCanonico || nomeCli.toUpperCase() || "?";
    let a = anag.get(anagKey);
    if (!a) {
      a = { codiceFile, codiceCanonico, nome: nomeCli, numRighe: 0, tipi: {} };
      anag.set(anagKey, a);
    }
    a.numRighe += 1;
    a.tipi[tipo] = (a.tipi[tipo] || 0) + 1;
    if (!a.nome) a.nome = nomeCli;

    const codiceCanonicoComp = mapCompagniaCodiceSede(r.CdComp);
    if (codiceCanonicoComp) {
      let c = comp.get(codiceCanonicoComp);
      if (!c) {
        c = {
          codiceFile: trimTxt(r.CdComp).toUpperCase(),
          codiceCanonico: codiceCanonicoComp,
          nome: trimTxt(r["Nome Compagnia"]),
          numRighe: 0,
        };
        comp.set(codiceCanonicoComp, c);
      }
      c.numRighe += 1;
      if (!c.nome) c.nome = trimTxt(r["Nome Compagnia"]);
    }
  }

  const anagrafiche = [...anag.values()].sort((a, b) => b.numRighe - a.numRighe || a.nome.localeCompare(b.nome));
  const compagnie = [...comp.values()].sort((a, b) => b.numRighe - a.numRighe || a.nome.localeCompare(b.nome));

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
