/**
 * Import PI/PQ sede Roma Uno.
 *   bun scripts/import-roma-uno-polizze.ts --emit-sql
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { inferFormaGiuridica, inferTipoCliente, splitNomeCognome } from "../src/lib/romaExeClienti.ts";
import { inventCodiceFiscale, inventPartitaIva } from "../src/lib/inventFiscalIds.ts";
import {
  ROMA_UNO_UFFICIO_ID,
  normalizeProduttoreKey,
  planRomaUnoPolizze,
  romaUnoClienteKey,
  trimTxt,
  type RomaUnoCatalogs,
  type RomaUnoPolizzaRiga,
  type RomaUnoTitoloPianificato,
} from "../src/lib/romaUnoPolizze.ts";

const EXCEL =
  process.argv.find((a) => a.endsWith(".xlsx")) ||
  "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/polizze_sede_Roma_850d.xlsx";
const CATALOGS_PATH = process.env.ROMA_UNO_CATALOGS || "/tmp/roma-uno-catalogs.json";
const OUT = "/tmp/roma-uno-polizze-sql";
const CHUNK = 25;
const SEDE_EMAIL = "gestionerm@consulbrokers.it";
const ALIAS_CLIENTI: Record<string, string> = {
  "013288": "d5fd69b7-6ab5-4f68-88aa-3086f509b155", // LONGO EMANUELE già in sede
};

const GRUPPI: Array<{ id: string; test: (codice: string, nome: string) => boolean }> = [
  { id: "38b9ef17-0af5-4ba5-8655-41a64636bec1", test: (c, n) => n.includes("ALLIANZ") || c === "TOPSRL" || c.startsWith("ALL") },
  { id: "be80cf91-fec3-4bdc-bf71-61feca6bd8db", test: (c, n) => n.includes("GENERALI") || c.startsWith("GEN") },
  { id: "64cd2896-03e7-449d-be5b-b7824daaabbd", test: (c, n) => n.includes("REALE") || c.startsWith("REA") || c.startsWith("RM000") },
  { id: "6f05c8f0-3053-4f22-a37d-ed7fdd20a12a", test: (c, n) => n.includes("UNIPOLSAI") || c === "UNI105" },
  { id: "8d394866-aab5-4b07-a9d3-b718801cf16f", test: (c, n) => n.includes("UNIPOL") || n.includes("UNISALUTE") || c.startsWith("UNI") },
  { id: "1f5adbd0-a1c1-401d-bfff-93cc0ef6ea05", test: (c, n) => n.includes("AXA XL") || c === "AXA116" },
  { id: "9f8774c8-bd49-4b5d-b8fa-0dcaa87f0dab", test: (c, n) => n.includes("AXA") || c.startsWith("AXA") },
  { id: "c24df49a-0b11-44df-8afe-aefd64a9fa41", test: (c, n) => n.includes("ZURICH") || c.startsWith("ZUR") },
  { id: "a7b6c33c-2aba-46fc-8959-6d78b02c2ca4", test: (c, n) => n.includes("ITAS") || c.startsWith("ITAS") },
  { id: "57587dbf-08e9-449b-9662-c2a890bdb88a", test: (c, n) => n.includes("HDI GLOBAL") || c === "HDIGLO" || c === "HDGFED" },
  { id: "c46e9743-3000-4adc-8766-c7a598812b64", test: (c, n) => n.includes("HDI") || c === "ASSHDI" || c.startsWith("HDI") },
  { id: "381c4d81-43e0-4c88-a7bc-88b1eb1b1e9a", test: (c, n) => n.includes("AMTRUST") || c.startsWith("AMT") },
  { id: "58b5e4da-d8a8-41cc-b965-1e1c7857d83c", test: (c, n) => n.includes("GROUPAMA") || c === "FIN000" || c === "GRO007" },
  { id: "c4527cf6-d040-41c2-9e72-ad3f3053f1ea", test: (_c, n) => n.includes("HELVETIA") },
  { id: "de55d8b5-3524-4f39-b7f7-82f886c11d35", test: (c, n) => n.includes("NOBIS") || c === "IPANOB" },
  { id: "835bf71d-0627-404f-aa07-8d9e2f7b35b7", test: (_c, n) => n.includes("VITTORIA") },
  { id: "4e6858d7-a924-4640-bc13-987c6f7a0c94", test: (_c, n) => n.includes("ROLAND") },
  { id: "9dd883b6-348f-4a2c-9744-51c54a17863a", test: (c, n) => n.includes("REVO") || c.startsWith("REVO") },
  { id: "f226bf6d-15b8-4dc5-bc73-48c657a0f864", test: (c, n) => n.includes("DUAL ITALIA") || n.startsWith("DUAL") || c === "BG0068" },
  { id: "f8fe57ec-fb8c-4a1f-b27b-da9d6458c384", test: (c, n) => n.includes("METLIFE") || c === "BG0073" },
  { id: "9b3a4f21-6f80-4557-ab3e-669e67434ecf", test: (c, n) => n.includes("ON HEALTH") || c === "ON0000" },
];
const GRUPPO_DEFAULT = "fe9857d3-3782-4be0-8229-77abcba41c91";

function gruppoCompagniaId(codice: string, nome: string): string {
  const c = codice.toUpperCase();
  const n = nome.toUpperCase();
  return GRUPPI.find((g) => g.test(c, n))?.id ?? GRUPPO_DEFAULT;
}

type Dump = {
  rami: Array<{ id: string; codice: string | null; descrizione: string | null }>;
  compagnie: Array<{ id: string; codice: string | null; nome: string | null; tipo: string | null }>;
  clienti: Array<{
    id: string;
    codice_ricerca: string | null;
    codice_cliente: string | null;
    denom: string | null;
  }>;
  produttori: Array<{
    id: string;
    tipo: string | null;
    codice: string | null;
    nome: string | null;
    cognome: string | null;
    ragione_sociale: string | null;
    ufficio_id: string | null;
  }>;
  cf_piva: { cf: string[] | null; piva: string[] | null };
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

function buildCatalogs(dump: Dump, extraClienti: Record<string, string>, extraCompagnie: Record<string, string>): RomaUnoCatalogs {
  const clientiByCodice: Record<string, string> = { ...ALIAS_CLIENTI, ...extraClienti };
  for (const c of dump.clienti) {
    const keys = [c.codice_ricerca, c.codice_cliente]
      .map((x) => trimTxt(x))
      .filter(Boolean);
    for (const k of keys) {
      const digits = romaUnoClienteKey(k.replace(/^RM1-/i, ""));
      if (digits && (k.toUpperCase().startsWith("RM1-") || /^\d+$/.test(k))) {
        if (!clientiByCodice[digits]) clientiByCodice[digits] = c.id;
      }
    }
  }

  const ramiByCodice: RomaUnoCatalogs["ramiByCodice"] = {};
  for (const r of dump.rami) {
    const code = trimTxt(r.codice).toUpperCase();
    if (code) ramiByCodice[code] = { id: r.id, descrizione: r.descrizione || code };
  }

  const compagnieByCodice: Record<string, string> = { ...extraCompagnie };
  for (const c of dump.compagnie) {
    const code = trimTxt(c.codice).toUpperCase();
    if (code && !compagnieByCodice[code]) compagnieByCodice[code] = c.id;
  }

  const produttoriByKey: Record<string, string> = {};
  const sorted = [...dump.produttori].sort((a, b) => {
    const aLocal = a.ufficio_id === ROMA_UNO_UFFICIO_ID ? 0 : 1;
    const bLocal = b.ufficio_id === ROMA_UNO_UFFICIO_ID ? 0 : 1;
    return aLocal - bLocal;
  });
  for (const p of sorted) {
    addProduttoreKeys(produttoriByKey, p.id, p.ragione_sociale, p.cognome, `${p.cognome || ""} ${p.nome || ""}`);
  }
  return { clientiByCodice, ramiByCodice, compagnieByCodice, produttoriByKey };
}

function titoloValues(r: RomaUnoTitoloPianificato & { newId: string }): string {
  return `(${[
    sqlIdent(r.newId),
    sqlStr(r.numeroTitolo),
    r.riga,
    sqlStr(r.stato),
    "NULL",
    sqlIdent(r.clienteId),
    sqlIdent(r.compagniaId),
    sqlIdent(r.ramoId),
    sqlIdent(ROMA_UNO_UFFICIO_ID),
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
    sqlStr("RM"),
    r.fileId && /^\d+$/.test(r.fileId) ? r.fileId : "NULL",
  ].join(", ")})`;
}

function missingFromPlan(rows: RomaUnoPolizzaRiga[], catalogs: RomaUnoCatalogs) {
  const missingComp = new Map<string, string>();
  const missingCli = new Map<string, string>();
  for (const r of rows) {
    const tipo = trimTxt(r.TipoTit || r.TipoDoc).toUpperCase();
    if (tipo !== "PI" && tipo !== "PQ") continue;
    const cd = trimTxt(r.CdComp).toUpperCase();
    if (cd && !catalogs.compagnieByCodice[cd]) missingComp.set(cd, trimTxt(r["Nome Compagnia"]) || cd);
    const cli = romaUnoClienteKey(r.CdClie);
    if (cli && !catalogs.clientiByCodice[cli]) missingCli.set(cli, trimTxt(r["Nome CLiente"]) || cli);
  }
  return { missingComp, missingCli };
}

function main() {
  const dump = JSON.parse(readFileSync(CATALOGS_PATH, "utf8")) as Dump;
  const rows = XLSX.utils.sheet_to_json<RomaUnoPolizzaRiga>(XLSX.readFile(EXCEL).Sheets.Sheet1, {
    defval: null,
    raw: true,
  });

  let catalogs = buildCatalogs(dump, {}, {});
  const { missingComp, missingCli } = missingFromPlan(rows, catalogs);

  const extraCompagnie: Record<string, string> = {};
  const extraClienti: Record<string, string> = {};
  const compagniaInserts: string[] = [];
  const clienteInserts: string[] = [];

  for (const [codice, nome] of missingComp) {
    const id = randomUUID();
    extraCompagnie[codice] = id;
    compagniaInserts.push(
      `(${sqlIdent(id)}, ${sqlStr(nome)}, 'agenzia', ${sqlStr(codice)}, ${sqlIdent(gruppoCompagniaId(codice, nome))}, false, false)`,
    );
  }

  const takenCf = new Set((dump.cf_piva.cf || []).map((x) => x.toUpperCase()));
  const takenPiva = new Set((dump.cf_piva.piva || []).map((x) => x.replace(/\D/g, "")));
  for (const [codice, nome] of missingCli) {
    const id = randomUUID();
    extraClienti[codice] = id;
    const tipo = inferTipoCliente(nome, null, null, null);
    const forma = inferFormaGiuridica(nome) || (tipo === "privato" ? null : "altro");
    const split = tipo === "privato" ? splitNomeCognome(nome) : { nome: null as string | null, cognome: null as string | null };
    const seed = `RM1:${codice}:${nome}`;
    const cf = inventCodiceFiscale({
      seed,
      cognome: split.cognome || nome,
      nome: split.nome || "CLIENTE",
      comune: "H501",
      taken: takenCf,
    });
    const piva = tipo === "privato" ? null : inventPartitaIva(seed, takenPiva);
    if (piva) takenPiva.add(piva);
    const ricerca = `RM1-${codice}`;
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
        sqlIdent(ROMA_UNO_UFFICIO_ID),
        sqlStr(ricerca),
        sqlStr(ricerca),
        sqlStr(SEDE_EMAIL),
        sqlStr(`Import polizze Roma Uno ${new Date().toISOString().slice(0, 10)}. CF/P.IVA inventati.`),
        "true",
      ].join(", ")})`,
    );
  }

  catalogs = buildCatalogs(dump, extraClienti, extraCompagnie);
  const plan = planRomaUnoPolizze(rows, catalogs);

  const withIds = plan.gruppi
    .filter((g) => g.esito === "da_creare" && g.madre)
    .map((g) => ({
      ...g,
      madre: { ...g.madre!, newId: randomUUID() },
      quietanze: g.quietanze.map((q) => ({ ...q, newId: randomUUID() })),
    }));
  const allTitoli = withIds.flatMap((g) => [g.madre, ...g.quietanze]);

  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    `${OUT}/plan.json`,
    JSON.stringify(
      {
        file: EXCEL,
        rows: rows.length,
        stats: plan.stats,
        missingCompagnie: [...missingComp.entries()],
        missingClienti: [...missingCli.entries()],
        saltati: plan.saltati.map((s) => ({
          numero: s.numero,
          cliente: s.codiceCliente,
          compagnia: s.compagniaCodice,
          motivo: s.motivo,
        })),
      },
      null,
      2,
    ),
  );

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

  for (let i = 0; i < allTitoli.length; i += CHUNK) {
    const chunk = allTitoli.slice(i, i + CHUNK);
    const n = String(Math.floor(i / CHUNK) + 1).padStart(3, "0");
    writeFileSync(
      `${OUT}/1-${n}-titoli.sql`,
      `${header}\n${chunk.map((r) => titoloValues(r)).join(",\n")};\n`,
    );
  }

  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify(
      {
        stats: plan.stats,
        titoli: allTitoli.length,
        compagnieNuove: compagniaInserts.length,
        clientiNuovi: clienteInserts.length,
        saltati: plan.saltati.length,
        chunks: Math.ceil(allTitoli.length / CHUNK),
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({
    stats: plan.stats,
    titoli: allTitoli.length,
    compagnieNuove: compagniaInserts.length,
    clientiNuovi: clienteInserts.length,
    saltati: plan.saltati.length,
    out: OUT,
  }, null, 2));
}

main();
