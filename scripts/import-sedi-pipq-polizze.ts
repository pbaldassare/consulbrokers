/**
 * Import PI/PQ Milano / Potenza / Parma.
 *   bun scripts/import-sedi-pipq-polizze.ts --emit-sql
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { inferFormaGiuridica, inferTipoCliente, splitNomeCognome } from "../src/lib/romaExeClienti.ts";
import { COMUNE_CATASTALE, inventCodiceFiscale, inventPartitaIva } from "../src/lib/inventFiscalIds.ts";
import {
  SEDI_PIPQ,
  buildClienteNameIndex,
  fileClienteKey,
  matchClienteByNome,
  mapCompagniaCodiceSede,
  normalizeProduttoreKey,
  planSediPipqPolizze,
  trimTxt,
  type SedePipqCodice,
  type SediPipqCatalogs,
  type SediPipqRiga,
  type SediPipqTitolo,
} from "../src/lib/sediPipqPolizze.ts";

const CATALOGS_PATH = process.env.SEDI_PIPQ_CATALOGS || "/tmp/sedi-pipq-catalogs.json";
const OUT = process.env.SEDI_PIPQ_OUT || "/tmp/sedi-pipq-sql";
const CHUNK = 20;

const FILES: Record<SedePipqCodice, { polizze: string; clienti: string }> = {
  MI: {
    polizze:
      "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/polizze_sede_Milano_73b4.xlsx",
    clienti:
      "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/Clienti_sede_Milano_8637.xlsx",
  },
  PZ: {
    polizze:
      "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/polizze_sede_Potenza_cf31.xlsx",
    clienti:
      "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/Clienti_sede_Potenza_c4d3.xlsx",
  },
  PR: {
    polizze:
      "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/polizze_sede_Parma__1__fe82.xlsx",
    clienti:
      "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/Clienti_sede_Parma_7076.xlsx",
  },
};

const GRUPPI: Array<{ id: string; test: (codice: string, nome: string) => boolean }> = [
  { id: "38b9ef17-0af5-4ba5-8655-41a64636bec1", test: (c, n) => n.includes("ALLIANZ") || c.startsWith("ALL") },
  { id: "be80cf91-fec3-4bdc-bf71-61feca6bd8db", test: (c, n) => n.includes("GENERALI") || c.startsWith("GEN") },
  { id: "64cd2896-03e7-449d-be5b-b7824daaabbd", test: (c, n) => n.includes("REALE") || c.startsWith("REA") },
  { id: "6f05c8f0-3053-4f22-a37d-ed7fdd20a12a", test: (c, n) => n.includes("UNIPOLSAI") || c === "UNI105" },
  { id: "8d394866-aab5-4b07-a9d3-b718801cf16f", test: (c, n) => n.includes("UNIPOL") || n.includes("UNISALUTE") || c.startsWith("UNI") },
  { id: "9f8774c8-bd49-4b5d-b8fa-0dcaa87f0dab", test: (c, n) => n.includes("AXA") || c.startsWith("AXA") || c.startsWith("BG001") },
  { id: "c24df49a-0b11-44df-8afe-aefd64a9fa41", test: (c, n) => n.includes("ZURICH") || c.startsWith("ZUR") },
  { id: "381c4d81-43e0-4c88-a7bc-88b1eb1b1e9a", test: (c, n) => n.includes("AMTRUST") || c.startsWith("AMT") },
  { id: "58b5e4da-d8a8-41cc-b965-1e1c7857d83c", test: (c, n) => n.includes("GROUPAMA") || c.startsWith("GRO") },
  { id: "835bf71d-0627-404f-aa07-8d9e2f7b35b7", test: (_c, n) => n.includes("VITTORIA") },
  { id: "4e6858d7-a924-4640-bc13-987c6f7a0c94", test: (_c, n) => n.includes("ROLAND") },
  { id: "9dd883b6-348f-4a2c-9744-51c54a17863a", test: (c, n) => n.includes("REVO") || c.startsWith("ELB") || c.startsWith("REV") },
  { id: "f226bf6d-15b8-4dc5-bc73-48c657a0f864", test: (c, n) => n.includes("DUAL") || c === "BG0068" },
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

function titoloValues(r: SediPipqTitolo & { newId: string }, filiale: string, ufficioId: string): string {
  return `(${[
    sqlIdent(r.newId),
    sqlStr(r.numeroTitolo),
    r.riga,
    sqlStr(r.stato),
    "NULL",
    sqlIdent(r.clienteId),
    sqlIdent(r.compagniaId),
    sqlIdent(r.ramoId),
    sqlIdent(ufficioId),
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
    sqlStr(filiale),
    r.fileId && /^\d+$/.test(r.fileId) ? r.fileId : "NULL",
  ].join(", ")})`;
}

function main() {
  const dump = JSON.parse(readFileSync(CATALOGS_PATH, "utf8")) as Dump;
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

  const extraCompagnie: Record<string, string> = {};
  const compagniaInserts: string[] = [];
  const clienteInserts: string[] = [];
  const allTitoli: Array<SediPipqTitolo & { newId: string; sede: SedePipqCodice }> = [];
  const summary: Record<string, unknown> = {};

  mkdirSync(OUT, { recursive: true });

  for (const sede of Object.keys(SEDI_PIPQ) as SedePipqCodice[]) {
    const cfg = SEDI_PIPQ[sede];
    const rows = loadSheet<SediPipqRiga>(FILES[sede].polizze);
    const clientiExcel = loadSheet<{ Codice?: string; Nome?: string }>(FILES[sede].clienti);
    const sedeClienti = dump.clienti.filter((c) => c.ufficio_id === cfg.ufficioId);
    const nameIndex = buildClienteNameIndex(
      sedeClienti.map((c) => ({
        id: c.id,
        ragione: c.ragione_sociale,
        nome: c.nome,
        cognome: c.cognome,
      })),
    );
    const byRicerca = new Map<string, string>();
    for (const c of sedeClienti) {
      const k = trimTxt(c.codice_ricerca).toUpperCase();
      if (k) byRicerca.set(k, c.id);
    }
    const excelNomeToCodice = new Map<string, string>();
    for (const c of clientiExcel) {
      const codice = trimTxt(c.Codice).toUpperCase();
      if (!codice) continue;
      for (const key of [c.Nome]) {
        const id = matchClienteByNome(key, nameIndex);
        if (id) excelNomeToCodice.set(codice, id);
      }
      if (byRicerca.has(codice) && !excelNomeToCodice.has(codice)) {
        excelNomeToCodice.set(codice, byRicerca.get(codice)!);
      }
    }

    const clientiByCodice: Record<string, string> = {};
    const missingCli = new Map<string, string>();
    const missingComp = new Map<string, string>();

    for (const r of rows) {
      const tipo = trimTxt(r.TipoTit || r.TipoDoc).toUpperCase();
      if (tipo !== "PI" && tipo !== "PQ") continue;
      const cdFile = fileClienteKey(r.CdClie);
      const nome = trimTxt(r["Nome CLiente"]);
      if (cdFile && !clientiByCodice[cdFile]) {
        const byName = matchClienteByNome(nome, nameIndex);
        const digits = cdFile.replace(/^D/i, "").replace(/^0+/, "");
        const padded = digits.padStart(6, "0");
        const byCode = byRicerca.get(cdFile) || byRicerca.get(padded) || excelNomeToCodice.get(padded);
        const id = byName || byCode || null;
        if (id) clientiByCodice[cdFile] = id;
        else missingCli.set(cdFile, nome || cdFile);
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

    for (const [codice, nome] of missingCli) {
      const id = randomUUID();
      clientiByCodice[codice] = id;
      const tipo = inferTipoCliente(nome, null, null, null);
      const forma = inferFormaGiuridica(nome) || (tipo === "privato" ? null : "altro");
      const split = tipo === "privato" ? splitNomeCognome(nome) : { nome: null as string | null, cognome: null as string | null };
      const seed = `${sede}:${codice}:${nome}`;
      const cf = inventCodiceFiscale({
        seed,
        cognome: split.cognome || nome,
        nome: split.nome || "CLIENTE",
        comune: COMUNE_CATASTALE[sede],
        taken: takenCf,
      });
      const piva = tipo === "privato" ? null : inventPartitaIva(seed, takenPiva);
      let ricerca = `${sede}-${codice}`;
      if (takenCodiceCliente.has(ricerca.toUpperCase())) ricerca = `${ricerca}-${id.slice(0, 8)}`;
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
          sqlIdent(cfg.ufficioId),
          sqlStr(codice),
          sqlStr(ricerca),
          sqlStr(cfg.email),
          sqlStr(`Import polizze sede ${cfg.label} ${new Date().toISOString().slice(0, 10)}. Cliente creato dal file polizze (codice ${codice}).`),
          "true",
        ].join(", ")})`,
      );
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
        madre: { ...g.madre!, newId: randomUUID(), sede },
        quietanze: g.quietanze.map((q) => ({ ...q, newId: randomUUID(), sede })),
      }));
    const titoli = withIds.flatMap((g) => [g.madre, ...g.quietanze]);
    allTitoli.push(...titoli);
    summary[sede] = {
      rows: rows.length,
      stats: plan.stats,
      clientiNuovi: missingCli.size,
      compagnieNuove: missingComp.size,
      titoli: titoli.length,
      saltati: plan.saltati.map((s) => ({
        numero: s.numero,
        cliente: s.codiceCliente,
        compagnia: s.compagniaCodice,
        motivo: s.motivo,
      })),
    };
  }

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
  email, note, attivo
) VALUES\n${clienteInserts.join(",\n")};\n`,
    );
  }

  const header = `INSERT INTO public.titoli (
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

  const bySede = new Map<SedePipqCodice, typeof allTitoli>();
  for (const t of allTitoli) {
    const list = bySede.get(t.sede) || [];
    list.push(t);
    bySede.set(t.sede, list);
  }
  let chunkIdx = 0;
  for (const sede of Object.keys(SEDI_PIPQ) as SedePipqCodice[]) {
    const cfg = SEDI_PIPQ[sede];
    const list = bySede.get(sede) || [];
    const children = list.filter((t) => t.sostituiscePolizza);
    const mothers = list.filter((t) => !t.sostituiscePolizza);
    const ordered = [...children, ...mothers];
    for (let i = 0; i < ordered.length; i += CHUNK) {
      const chunk = ordered.slice(i, i + CHUNK);
      chunkIdx += 1;
      const n = String(chunkIdx).padStart(3, "0");
      writeFileSync(
        `${OUT}/1-${n}-${sede.toLowerCase()}-titoli.sql`,
        `${header}\n${chunk.map((r) => titoloValues(r, cfg.filiale, cfg.ufficioId)).join(",\n")};\n`,
      );
    }
  }

  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify(
      {
        ...summary,
        totalTitoli: allTitoli.length,
        compagnieNuove: compagniaInserts.length,
        clientiNuovi: clienteInserts.length,
        chunks: chunkIdx,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({
    totalTitoli: allTitoli.length,
    compagnieNuove: compagniaInserts.length,
    clientiNuovi: clienteInserts.length,
    chunks: chunkIdx,
    sedi: Object.fromEntries(
      (Object.keys(SEDI_PIPQ) as SedePipqCodice[]).map((s) => [s, summary[s]]),
    ),
    out: OUT,
  }, null, 2));
}

main();
