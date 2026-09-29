/**
 * Ricarico portafoglio sede Potenza da Titoli uff 01.09.25–30.09.26.
 * Regole 28/09: PI = polizza incassabile; PQ = rate successive (o polizza se manca PI).
 * AM/PR/AP = appendici; PS = storno; DP = rettifica provvigioni.
 *
 *   SEDI_PIPQ_CATALOGS=/tmp/potenza-catalogs.json \
 *   SEDI_PIPQ_OUT=/tmp/potenza-sql \
 *   bun scripts/import-potenza-titoli-2026.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { inferFormaGiuridica, inferTipoCliente, splitNomeCognome } from "../src/lib/romaExeClienti.ts";
import { COMUNE_CATASTALE, inventCodiceFiscale, inventPartitaIva } from "../src/lib/inventFiscalIds.ts";
import {
  SEDI_PIPQ,
  SEDI_PIPQ_CLIENTE_ALIAS,
  buildClienteNameIndex,
  fileClienteKey,
  matchClienteByNome,
  mapCompagniaCodiceSede,
  normalizeProduttoreKey,
  planSediPipqPolizze,
  trimTxt,
  type SediPipqCatalogs,
  type SediPipqRiga,
  type SediPipqTitolo,
} from "../src/lib/sediPipqPolizze.ts";
import {
  planSediExtraPolizze,
  type SediExtraCatalogs,
  type SediExtraExistingTitolo,
  type SediExtraPianificato,
  type SediExtraRiga,
} from "../src/lib/sediExtraPolizze.ts";

const CATALOGS_PATH = process.env.SEDI_PIPQ_CATALOGS || "/tmp/potenza-catalogs.json";
const OUT = process.env.SEDI_PIPQ_OUT || "/tmp/potenza-sql";
const CHUNK = 20;
const UFFICIO = SEDI_PIPQ.PZ;
const FILE_TITOLI =
  "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/Titoli_uff_Potenza_01.09.25-30.09.26_4f0b.xlsx";
const FILE_CLIENTI =
  "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/Clienti_sede_Potenza_c4d3.xlsx";

const GRUPPI: Array<{ id: string; test: (codice: string, nome: string) => boolean }> = [
  { id: "38b9ef17-0af5-4ba5-8655-41a64636bec1", test: (c, n) => n.includes("ALLIANZ") || c.startsWith("ALL") },
  { id: "be80cf91-fec3-4bdc-bf71-61feca6bd8db", test: (c, n) => n.includes("GENERALI") || c.startsWith("GEN") },
  { id: "64cd2896-03e7-449d-be5b-b7824daaabbd", test: (c, n) => n.includes("REALE") || c.startsWith("REA") },
  { id: "6f05c8f0-3053-4f22-a37d-ed7fdd20a12a", test: (c, n) => n.includes("UNIPOLSAI") || c === "UNI105" },
  { id: "8d394866-aab5-4b07-a9d3-b718801cf16f", test: (c, n) => n.includes("UNIPOL") || n.includes("UNISALUTE") || c.startsWith("UNI") },
  { id: "9f8774c8-bd49-4b5d-b8fa-0dcaa87f0dab", test: (c, n) => n.includes("AXA") || c.startsWith("AXA") },
  { id: "c24df49a-0b11-44df-8afe-aefd64a9fa41", test: (c, n) => n.includes("ZURICH") || c.startsWith("ZUR") },
  { id: "381c4d81-43e0-4c88-a7bc-88b1eb1b1e9a", test: (c, n) => n.includes("AMTRUST") || c.startsWith("AMT") },
  { id: "58b5e4da-d8a8-41cc-b965-1e1c7857d83c", test: (c, n) => n.includes("GROUPAMA") || c.startsWith("GRO") },
  { id: "835bf71d-0627-404f-aa07-8d9e2f7b35b7", test: (_c, n) => n.includes("VITTORIA") },
  { id: "4e6858d7-a924-4640-bc13-987c6f7a0c94", test: (_c, n) => n.includes("ROLAND") },
  { id: "9dd883b6-348f-4a2c-9744-51c54a17863a", test: (c, n) => n.includes("REVO") || c.startsWith("ELB") },
  { id: "c4527cf6-d040-41c2-9e72-ad3f3053f1ea", test: (c, n) => n.includes("AIG") || c === "AIG000" },
];
const GRUPPO_DEFAULT = "fe9857d3-3782-4be0-8229-77abcba41c91";

function gruppoCompagniaId(codice: string, nome: string): string {
  const c = codice.toUpperCase();
  const n = nome.toUpperCase();
  return GRUPPI.find((g) => g.test(c, n))?.id ?? GRUPPO_DEFAULT;
}

type Dump = {
  rami: Array<{ id: string; codice: string | null; descrizione: string | null }>;
  compagnie: Array<{ id: string; codice: string | null; nome: string | null }>;
  clienti: Array<{
    id: string;
    ufficio_id: string | null;
    codice_ricerca: string | null;
    codice_cliente: string | null;
    ragione_sociale: string | null;
    nome: string | null;
    cognome: string | null;
    partita_iva?: string | null;
    codice_fiscale?: string | null;
  }>;
  produttori: Array<{
    id: string;
    nome: string | null;
    cognome: string | null;
    ragione_sociale: string | null;
    ufficio_id: string | null;
  }>;
  cf_piva: { cf: string[]; piva: string[] };
};

type ClienteExcel = {
  Codice?: string;
  Nome?: string;
  Indirizzo?: string;
  Cap?: string;
  Comune?: string;
  Prov?: string;
  Email?: string;
  CF?: string;
  PIva?: string;
  "F/G"?: string;
};

function sqlStr(v: string | null | undefined): string {
  if (v == null || v === "") return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}
function sqlIdent(id: string | null | undefined): string {
  return id ? `'${id}'::uuid` : "NULL";
}
function sqlDate(v: string | null | undefined): string {
  return v ? `'${v}'::date` : "NULL";
}
function sqlNum(v: number | null | undefined): string {
  return v == null ? "NULL" : String(v);
}
function sqlBool(v: boolean): string {
  return v ? "true" : "false";
}

function addProduttoreKeys(map: Record<string, string>, id: string, ...raws: Array<string | null | undefined>) {
  for (const raw of raws) {
    const key = normalizeProduttoreKey(raw);
    if (!key) continue;
    if (!map[key]) map[key] = id;
    const compact = key.replace(/\s+/g, "");
    if (compact && !map[compact]) map[compact] = id;
  }
}

function loadSheet<T>(path: string): T[] {
  const wb = XLSX.readFile(path);
  return XLSX.utils.sheet_to_json<T>(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: true });
}

function titoloPipqValues(r: SediPipqTitolo & { newId: string }): string {
  return `(${[
    sqlIdent(r.newId),
    sqlStr(r.numeroTitolo),
    r.riga,
    sqlStr(r.stato),
    "NULL",
    sqlIdent(r.clienteId),
    sqlIdent(r.compagniaId),
    sqlIdent(r.ramoId),
    sqlIdent(UFFICIO.ufficioId),
    sqlDate(r.garanziaDa),
    sqlDate(r.garanziaA),
    sqlDate(r.durataDa),
    sqlDate(r.durataA),
    sqlDate(r.dataScadenza),
    sqlDate(r.dataCompetenza),
    sqlDate(r.dataMessaCassa),
    sqlDate(r.dataIncasso),
    sqlDate(r.dataCopertura),
    sqlNum(r.importoIncassato),
    sqlNum(r.premioNetto),
    sqlNum(r.tasse),
    sqlNum(r.premioLordo),
    sqlNum(r.provvigioni),
    sqlNum(r.provvigioni),
    sqlNum(r.premioNetto),
    sqlNum(r.tasse),
    sqlStr(r.frazionamento),
    sqlStr(r.frazionamento),
    r.rate,
    r.anniDurata,
    sqlNum(r.percentualeRiparto),
    sqlBool(r.tacitoRinnovo),
    sqlBool(r.emittenda),
    sqlStr(r.sostituiscePolizza),
    r.sostituisceRiga ?? "NULL",
    sqlStr(r.cigRif),
    sqlStr(r.descrizione),
    sqlStr(r.note),
    sqlStr(r.prodottoNome),
    sqlStr(r.specialist),
    sqlStr(r.aeNome),
    sqlStr(r.produttoreNome),
    sqlIdent(r.produttoreId),
    sqlStr(r.tipoIncasso),
    sqlStr(r.contoIncasso),
    sqlStr(r.tipoPortafoglio),
    sqlStr(r.valuta),
    sqlNum(r.cambio),
    r.disdettaMesi == null ? "NULL" : String(Math.round(r.disdettaMesi * 30)),
    sqlDate(r.compContabile),
    sqlDate(r.compAssicurativa),
    sqlStr(UFFICIO.filiale),
    r.fileId && /^\d+$/.test(r.fileId) ? r.fileId : "NULL",
  ].join(", ")})`;
}

function titoloExtraValues(r: SediExtraPianificato & { newId: string }): string {
  return `(${[
    sqlIdent(r.newId),
    sqlStr(r.numeroTitolo),
    r.riga,
    sqlStr(r.stato),
    "NULL",
    sqlIdent(r.clienteId),
    sqlIdent(r.compagniaId),
    sqlIdent(r.ramoId),
    sqlIdent(r.ufficioId),
    sqlDate(r.garanziaDa),
    sqlDate(r.garanziaA),
    sqlDate(r.durataDa),
    sqlDate(r.durataA),
    sqlDate(r.dataScadenza),
    sqlDate(r.dataCompetenza),
    sqlDate(r.dataMessaCassa),
    sqlDate(r.dataIncasso),
    sqlNum(r.importoIncassato),
    sqlNum(r.premioNetto),
    sqlNum(r.tasse),
    sqlNum(r.premioLordo),
    sqlNum(r.provvigioni),
    sqlNum(r.provvigioni),
    sqlNum(r.premioNetto),
    sqlNum(r.tasse),
    sqlStr(r.frazionamento),
    sqlStr(r.frazionamento),
    r.rate,
    r.anniDurata,
    sqlNum(r.percentualeRiparto),
    sqlBool(r.tacitoRinnovo),
    "false",
    sqlBool(r.isAppendiceModifica),
    sqlBool(r.isRegolazione),
    r.isAppendiceModifica && r.madreId ? sqlIdent(r.madreId) : "NULL",
    sqlStr(r.sostituiscePolizza),
    r.sostituisceRiga ?? "NULL",
    sqlStr(r.appendice),
    sqlStr(r.cigRif),
    sqlStr(r.descrizione),
    sqlStr(r.note),
    sqlStr(r.prodottoNome),
    sqlStr(r.specialist),
    sqlStr(r.aeNome),
    sqlStr(r.produttoreNome),
    sqlStr(r.tipoIncasso),
    sqlStr(r.contoIncasso),
    sqlStr(r.tipoPortafoglio),
    sqlStr(r.valuta),
    sqlNum(r.cambio),
    sqlStr(r.filiale),
    r.idLegacy ?? "NULL",
    r.azione === "insert_ps" ? sqlDate(r.dataStorno) : "NULL",
    r.azione === "insert_ps" ? sqlStr("Annullo amministrativo") : "NULL",
  ].join(", ")})`;
}

function wrapDisableTrigger(body: string): string {
  return `ALTER TABLE public.titoli DISABLE TRIGGER trg_genera_quietanze_su_insert_madre;
${body}
ALTER TABLE public.titoli ENABLE TRIGGER trg_genera_quietanze_su_insert_madre;
`;
}

function main() {
  const dump = JSON.parse(readFileSync(CATALOGS_PATH, "utf8")) as Dump;
  const rows = loadSheet<SediPipqRiga>(FILE_TITOLI);
  const clientiExcel = loadSheet<ClienteExcel>(FILE_CLIENTI);

  const ramiByCodice: SediPipqCatalogs["ramiByCodice"] = {};
  for (const r of dump.rami) {
    const code = trimTxt(r.codice).toUpperCase();
    if (code) ramiByCodice[code] = { id: r.id, descrizione: r.descrizione || code };
  }
  const compagnieByCodice: Record<string, string> = {};
  for (const c of dump.compagnie) {
    const code = trimTxt(c.codice).toUpperCase();
    if (code && !compagnieByCodice[code]) compagnieByCodice[code] = c.id;
  }
  const produttoriByKey: Record<string, string> = {};
  for (const p of dump.produttori) {
    addProduttoreKeys(produttoriByKey, p.id, p.ragione_sociale, p.cognome, `${p.cognome || ""} ${p.nome || ""}`);
  }

  const takenCf = new Set((dump.cf_piva.cf || []).map((x) => x.toUpperCase()));
  const takenPiva = new Set((dump.cf_piva.piva || []).map((x) => x.replace(/\D/g, "")));
  const takenCodiceCliente = new Set(
    dump.clienti.map((c) => trimTxt(c.codice_cliente).toUpperCase()).filter(Boolean),
  );

  const sedeClienti = dump.clienti.filter((c) => c.ufficio_id === UFFICIO.ufficioId);
  const nameIndex = buildClienteNameIndex(
    sedeClienti.map((c) => ({
      id: c.id,
      ragione: c.ragione_sociale,
      nome: c.nome,
      cognome: c.cognome,
    })),
  );
  const byRicerca = new Map<string, string>();
  const byPiva = new Map<string, string>();
  const byCf = new Map<string, string>();
  for (const c of sedeClienti) {
    const k = trimTxt(c.codice_ricerca).toUpperCase();
    if (k) byRicerca.set(k, c.id);
    const piva = trimTxt(c.partita_iva).replace(/\D/g, "");
    if (piva) byPiva.set(piva, c.id);
    const cf = trimTxt(c.codice_fiscale).toUpperCase();
    if (cf) byCf.set(cf, c.id);
  }
  const excelByCodice = new Map<string, ClienteExcel>();
  for (const c of clientiExcel) {
    const codice = trimTxt(c.Codice).toUpperCase();
    if (codice) excelByCodice.set(codice, c);
  }

  const resolveCliente = (cdFile: string, nome: string): string | null => {
    if (!cdFile && !nome) return null;
    const alias = SEDI_PIPQ_CLIENTE_ALIAS[cdFile];
    const digits = cdFile.replace(/^D/i, "").replace(/^0+/, "");
    const padded = digits ? digits.padStart(6, "0") : "";
    const excel = excelByCodice.get(cdFile) || excelByCodice.get(padded);
    const piva = trimTxt(excel?.PIva).replace(/\D/g, "");
    const cf = trimTxt(excel?.CF).toUpperCase();
    return (
      (alias ? byRicerca.get(alias) : null) ||
      matchClienteByNome(nome, nameIndex) ||
      (piva ? byPiva.get(piva) : null) ||
      (cf ? byCf.get(cf) : null) ||
      byRicerca.get(cdFile) ||
      byRicerca.get(padded) ||
      null
    );
  };

  const extraCompagnie: Record<string, string> = {};
  const compagniaInserts: string[] = [];
  const clienteInserts: string[] = [];
  const clientiByCodice: Record<string, string> = {};
  const missingCli = new Map<string, { nome: string; excel?: ClienteExcel }>();
  const missingComp = new Map<string, string>();

  for (const r of rows) {
    const cdFile = fileClienteKey(r.CdClie);
    const nome = trimTxt(r["Nome CLiente"]);
    if (cdFile && !clientiByCodice[cdFile]) {
      const id = resolveCliente(cdFile, nome);
      if (id) clientiByCodice[cdFile] = id;
      else missingCli.set(cdFile, { nome: nome || cdFile, excel: excelByCodice.get(cdFile) });
    }
    const mapped = mapCompagniaCodiceSede(r.CdComp);
    if (mapped && !compagnieByCodice[mapped] && !extraCompagnie[mapped]) {
      missingComp.set(mapped, trimTxt(r["Nome Compagnia"]) || mapped);
    }
  }

  for (const [codice, nome] of missingComp) {
    const id = randomUUID();
    extraCompagnie[codice] = id;
    compagnieByCodice[codice] = id;
    compagniaInserts.push(
      `(${sqlIdent(id)}, ${sqlStr(nome)}, 'agenzia', ${sqlStr(codice)}, ${sqlIdent(gruppoCompagniaId(codice, nome))}, false, false)`,
    );
  }

  for (const [codice, info] of missingCli) {
    const id = randomUUID();
    clientiByCodice[codice] = id;
    const excel = info.excel;
    const nome = trimTxt(excel?.Nome) || info.nome;
    const cfExcel = trimTxt(excel?.CF).toUpperCase() || null;
    const pivaExcel = trimTxt(excel?.PIva).replace(/\D/g, "") || null;
    const tipo = inferTipoCliente(
      nome,
      excel?.["F/G"] === "F" ? cfExcel : null,
      pivaExcel,
      excel?.["F/G"] === "G" ? cfExcel : null,
    );
    const forma = inferFormaGiuridica(nome) || (tipo === "privato" ? null : "altro");
    const split = tipo === "privato" ? splitNomeCognome(nome) : { nome: null as string | null, cognome: null as string | null };
    const seed = `PZ:${codice}:${nome}`;
    const cf =
      cfExcel && !takenCf.has(cfExcel)
        ? cfExcel
        : inventCodiceFiscale({
            seed,
            cognome: split.cognome || nome,
            nome: split.nome || "CLIENTE",
            comune: COMUNE_CATASTALE.PZ,
            taken: takenCf,
          });
    takenCf.add(cf);
    let piva: string | null = null;
    if (tipo !== "privato") {
      piva = pivaExcel && !takenPiva.has(pivaExcel) ? pivaExcel : inventPartitaIva(seed, takenPiva);
      if (piva) takenPiva.add(piva);
    }
    let ricerca = codice;
    if (takenCodiceCliente.has(ricerca.toUpperCase()) || byRicerca.has(ricerca)) {
      ricerca = `PZ-${codice}`;
    }
    takenCodiceCliente.add(ricerca.toUpperCase());
    clienteInserts.push(
      `(${[
        sqlIdent(id),
        sqlStr(tipo),
        sqlStr(nome),
        sqlStr(split.nome),
        sqlStr(split.cognome),
        sqlStr(forma),
        sqlStr(cf),
        sqlStr(piva),
        sqlIdent(UFFICIO.ufficioId),
        sqlStr(codice),
        sqlStr(ricerca),
        sqlStr(trimTxt(excel?.Email) || UFFICIO.email),
        sqlStr(trimTxt(excel?.Indirizzo) || null),
        sqlStr(trimTxt(excel?.Cap) || null),
        sqlStr(trimTxt(excel?.Comune) || null),
        sqlStr(trimTxt(excel?.Prov) || null),
        sqlStr(`Import titoli Potenza 01.09.25-30.09.26. Cliente creato dal file (codice ${codice}).`),
        "true",
      ].join(", ")})`,
    );
    byRicerca.set(codice, id);
  }

  const catalogs: SediPipqCatalogs = {
    clientiByCodice,
    ramiByCodice,
    compagnieByCodice,
    produttoriByKey,
  };
  const plan = planSediPipqPolizze(rows, catalogs);
  const withIds = plan.gruppi
    .filter((g) => g.esito === "da_creare" && g.madre)
    .map((g) => ({
      ...g,
      madre: { ...g.madre!, newId: randomUUID() },
      quietanze: g.quietanze.map((q) => ({ ...q, newId: randomUUID() })),
    }));
  const titoliPipq = withIds.flatMap((g) => [g.madre, ...g.quietanze]);

  const existing: SediExtraExistingTitolo[] = titoliPipq.map((t) => ({
    id: t.newId,
    numero_titolo: t.numeroTitolo,
    riga: t.riga,
    filiale: UFFICIO.filiale,
    ufficio_id: UFFICIO.ufficioId,
    compagnia_id: t.compagniaId!,
    cliente_anagrafica_id: t.clienteId,
    premio_lordo: t.premioLordo,
    stato: t.stato,
    sostituisce_polizza: t.sostituiscePolizza,
    garanzia_da: t.garanziaDa,
    id_legacy: t.fileId && /^\d+$/.test(t.fileId) ? Number(t.fileId) : null,
  }));

  const extraCatalogs: SediExtraCatalogs = {
    compagnieByCodice,
    ramiByCodice,
    existing,
    clientiNameIndex: nameIndex,
  };
  const extraPlan = planSediExtraPolizze(rows as SediExtraRiga[], "PZ", extraCatalogs);
  const extraInserts = extraPlan.pianificati
    .filter((p) => p.azione === "insert_am" || p.azione === "insert_ap" || p.azione === "insert_pr" || p.azione === "insert_ps")
    .map((p) => ({
      ...p,
      clienteId: p.clienteId || (p.numeroBase ? null : null),
      newId: randomUUID(),
    }));
  for (const p of extraInserts) {
    if (p.clienteId) continue;
    const fileId = p.fileId;
    const src = rows.find((r) => trimTxt(r.ID) === trimTxt(fileId));
    if (src) p.clienteId = resolveCliente(fileClienteKey(src.CdClie), trimTxt(src["Nome CLiente"])) || clientiByCodice[fileClienteKey(src.CdClie)] || null;
  }

  const stornoUpdates: Array<{ targetId: string; stornoId: string; dataStorno: string | null; premio: number }> = [];
  const appendici: Array<{ id: string; madreId: string; titoloId: string; numero: string; r: SediExtraPianificato }> = [];
  const appendiciSeq = new Map<string, number>();
  for (const p of extraInserts) {
    if (p.azione === "insert_ps" && p.targetId) {
      stornoUpdates.push({
        targetId: p.targetId,
        stornoId: p.newId,
        dataStorno: p.dataStorno,
        premio: Math.abs(p.premioLordo),
      });
    }
    if ((p.azione === "insert_am" || p.azione === "insert_ap" || p.azione === "insert_pr") && p.madreId) {
      const n = (appendiciSeq.get(p.madreId) || 0) + 1;
      appendiciSeq.set(p.madreId, n);
      appendici.push({ id: randomUUID(), madreId: p.madreId, titoloId: p.newId, numero: String(n), r: p });
    }
  }
  const dpUpdates = extraPlan.pianificati
    .filter((p) => p.azione === "update_dp" && p.targetId)
    .map((p) => ({ targetId: p.targetId!, delta: p.provvigioni, note: p.note || "Rettifica DP" }));

  mkdirSync(OUT, { recursive: true });
  if (compagniaInserts.length) {
    writeFileSync(
      `${OUT}/00-compagnie.sql`,
      `INSERT INTO public.compagnie (id, nome, tipo, codice, gruppo_compagnia_id, accordo_collaborazione, ratifica_art_118) VALUES\n${compagniaInserts.join(",\n")};\n`,
    );
  }
  if (clienteInserts.length) {
    writeFileSync(
      `${OUT}/01-clienti.sql`,
      `INSERT INTO public.clienti (
  id, tipo_cliente, ragione_sociale, nome, cognome, forma_giuridica,
  codice_fiscale, partita_iva, ufficio_id, codice_ricerca, codice_cliente,
  email, indirizzo_sede, cap_sede, citta_sede, provincia_sede, note, attivo
) VALUES\n${clienteInserts.join(",\n")};\n`,
    );
  }

  const pipqHeader = `INSERT INTO public.titoli (
  id, numero_titolo, riga, stato,
  cliente_id, cliente_anagrafica_id,
  compagnia_id, ramo_id, ufficio_id,
  garanzia_da, garanzia_a, durata_da, durata_a, data_scadenza, data_competenza,
  data_messa_cassa, data_incasso, data_copertura, importo_incassato,
  premio_netto, tasse, premio_lordo, provvigioni_firma, provvigioni_quietanza,
  premio_netto_quietanza, tasse_quietanza,
  frazionamento, periodicita, rate, anni_durata, percentuale_riparto,
  tacito_rinnovo, emittenda,
  sostituisce_polizza, sostituisce_riga, cig_rif,
  descrizione_polizza, note, prodotto_nome,
  specialist, ae_nome, produttore_nome, anagrafica_commerciale_id,
  tipo_incasso, conto_incasso, tipo_portafoglio,
  valuta, cambio, disdetta_giorni, comp_contabile, comp_assicurativa, filiale, id_legacy
) VALUES`;

  const children = titoliPipq.filter((t) => t.sostituiscePolizza);
  const mothers = titoliPipq.filter((t) => !t.sostituiscePolizza);
  let chunkIdx = 0;
  const writePipq = (list: typeof titoliPipq, tag: string) => {
    for (let i = 0; i < list.length; i += CHUNK) {
      const chunk = list.slice(i, i + CHUNK);
      chunkIdx += 1;
      const n = String(chunkIdx).padStart(3, "0");
      writeFileSync(
        `${OUT}/1-${n}-${tag}.sql`,
        wrapDisableTrigger(`${pipqHeader}\n${chunk.map(titoloPipqValues).join(",\n")};`),
      );
    }
  };
  writePipq(children, "pq");
  writePipq(mothers, "pi");

  const extraHeader = `INSERT INTO public.titoli (
  id, numero_titolo, riga, stato,
  cliente_id, cliente_anagrafica_id,
  compagnia_id, ramo_id, ufficio_id,
  garanzia_da, garanzia_a, durata_da, durata_a, data_scadenza, data_competenza,
  data_messa_cassa, data_incasso, importo_incassato,
  premio_netto, tasse, premio_lordo, provvigioni_firma, provvigioni_quietanza,
  premio_netto_quietanza, tasse_quietanza,
  frazionamento, periodicita, rate, anni_durata, percentuale_riparto,
  tacito_rinnovo, emittenda, is_appendice_modifica, is_regolazione, appendice_modifica_polizza_madre_id,
  sostituisce_polizza, sostituisce_riga, appendice, cig_rif,
  descrizione_polizza, note, prodotto_nome,
  specialist, ae_nome, produttore_nome, tipo_incasso, conto_incasso, tipo_portafoglio,
  valuta, cambio, filiale, id_legacy, data_storno, causale_storno
) VALUES`;
  for (let i = 0; i < extraInserts.length; i += CHUNK) {
    const slice = extraInserts.slice(i, i + CHUNK);
    const n = String(Math.floor(i / CHUNK) + 1).padStart(3, "0");
    writeFileSync(
      `${OUT}/2-${n}-extra.sql`,
      wrapDisableTrigger(`${extraHeader}\n${slice.map(titoloExtraValues).join(",\n")};`),
    );
  }

  if (appendici.length) {
    writeFileSync(
      `${OUT}/3-appendici.sql`,
      `INSERT INTO public.appendici_polizza (
  id, titolo_id, numero_appendice, data_appendice, data_effetto, oggetto, tipo, note,
  titolo_modifica_id, titolo_regolazione_id, premio_netto, tasse, premio_lordo, provvigioni, allegati
) VALUES
${appendici
  .map((opts) => {
    const tipo = opts.r.isRegolazione ? "regolazione" : "modifica";
    const titoloMod = opts.r.isRegolazione ? "NULL" : sqlIdent(opts.titoloId);
    const titoloReg = opts.r.isRegolazione ? sqlIdent(opts.titoloId) : "NULL";
    return `(${[
      sqlIdent(opts.id),
      sqlIdent(opts.madreId),
      sqlStr(opts.numero),
      sqlDate(opts.r.garanziaDa),
      sqlDate(opts.r.garanziaDa),
      sqlStr(opts.r.descrizione || opts.r.appendice || `Appendice ${opts.r.fileTipo}`),
      sqlStr(tipo),
      sqlStr(opts.r.note),
      titoloMod,
      titoloReg,
      sqlNum(opts.r.premioNetto),
      sqlNum(opts.r.tasse),
      sqlNum(opts.r.premioLordo),
      sqlNum(opts.r.provvigioni),
      `'[]'::jsonb`,
    ].join(", ")})`;
  })
  .join(",\n")};
`,
    );
  }
  if (stornoUpdates.length) {
    writeFileSync(
      `${OUT}/4-storni.sql`,
      stornoUpdates
        .map((s) => {
          const data = s.dataStorno ? `'${s.dataStorno}'::date` : "CURRENT_DATE";
          return `UPDATE public.titoli SET
  stato = 'stornato',
  data_storno = COALESCE(data_storno, ${data}),
  causale_storno = COALESCE(causale_storno, 'Annullo amministrativo'),
  motivo_storno = COALESCE(motivo_storno, 'Storno gestionale PS'),
  titolo_storno_id = '${s.stornoId}'::uuid
WHERE id = '${s.targetId}'::uuid
  AND stato IS DISTINCT FROM 'stornato';
INSERT INTO public.titoli_storni (titolo_id, titolo_storno_id, data_storno, causale, motivo, importo_rimborsato, era_messa_cassa)
VALUES ('${s.targetId}'::uuid, '${s.stornoId}'::uuid, ${data}, 'Annullo amministrativo', 'Storno gestionale PS', ${s.premio}, true);`;
        })
        .join("\n") + "\n",
    );
  }
  if (dpUpdates.length) {
    writeFileSync(
      `${OUT}/5-dp.sql`,
      dpUpdates
        .map((d) => {
          const note = d.note.replace(/'/g, "''");
          return `UPDATE public.titoli SET
  provvigioni_firma = COALESCE(provvigioni_firma, 0) + (${d.delta}),
  provvigioni_quietanza = COALESCE(provvigioni_quietanza, 0) + (${d.delta}),
  note = TRIM(BOTH E'\\n' FROM COALESCE(note, '') || E'\\n${note}')
WHERE id = '${d.targetId}'::uuid;`;
        })
        .join("\n") + "\n",
    );
  }

  const summary = {
    rows: rows.length,
    pipq: plan.stats,
    extra: extraPlan.stats,
    titoliPipq: titoliPipq.length,
    extraInserts: extraInserts.length,
    appendici: appendici.length,
    storni: stornoUpdates.length,
    dp: dpUpdates.length,
    clientiNuovi: clienteInserts.length,
    compagnieNuove: compagniaInserts.length,
    saltati: plan.saltati.map((s) => ({
      numero: s.numero,
      cliente: s.codiceCliente,
      compagnia: s.compagniaCodice,
      motivo: s.motivo,
    })),
    extraSkip: extraPlan.pianificati
      .filter((p) => p.azione === "skip")
      .map((p) => ({ tipo: p.fileTipo, numero: p.numeroBase, motivo: p.motivo })),
    chunks: chunkIdx,
  };
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ out: OUT, ...summary, saltati: summary.saltati.length, extraSkip: summary.extraSkip.length }, null, 2));
}

main();
