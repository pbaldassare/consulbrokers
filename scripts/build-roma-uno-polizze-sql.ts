/**
 * Genera SQL di import PortafoglioClienti_CB → titoli Roma Uno.
 * Uso: bun scripts/build-roma-uno-polizze-sql.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import {
  normalizeNumeroPolizza,
  resolveRomaUnoPolizza,
  ROMA_UNO_UFFICIO_ID,
  type RomaUnoCliente,
  type RomaUnoCompagnia,
  type RomaUnoExcelRiga,
  type RomaUnoProduttore,
  type RomaUnoRamo,
  type RomaUnoTitoloRisolto,
} from "../src/lib/romaUnoPolizze.ts";

const XLSX_PATH =
  "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/PortafoglioClienti_CB__2__a04c.xlsx";
const OUT = "/tmp/roma-uno-polizze-sql";
const CHUNK = 8;

const rami = JSON.parse(readFileSync("/tmp/roma-uno-rami.json", "utf8")) as RomaUnoRamo[];
const compagnie = JSON.parse(readFileSync("/tmp/roma-uno-compagnie.json", "utf8")) as RomaUnoCompagnia[];
const clienti = JSON.parse(readFileSync("/tmp/roma-uno-clienti.json", "utf8")) as RomaUnoCliente[];
const produttori: RomaUnoProduttore[] = [
  { id: "50124415-2c08-4bcd-a0ce-e43cd9683771", cognome: "BALLERINI CURZIO" },
  { id: "0be427e0-3fd4-44b5-a141-5d79596ae731", cognome: "Consulbrokers Digital Srl" },
  { id: "108d4ed1-437d-479a-a70d-a81a1f7164ac", cognome: "DI PIAZZA SANDRO" },
  { id: "cbe0e599-5f2e-4be9-b9d4-8b48347368d3", cognome: "INTERFIDI S.R.L." },
  { id: "75a34be7-f809-437a-a147-0b9cbd75d1aa", cognome: "MUTTIASS S.r.l." },
  { id: "9b5bd8be-b771-4940-aa36-a968069e6383", cognome: "SCARPA COSIMO DOMENICO MAURO" },
];

const wb = XLSX.readFile(XLSX_PATH);
const excelRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], {
  defval: "",
  raw: false,
});

const counts = new Map<string, number>();
for (const r of excelRows) {
  const n = normalizeNumeroPolizza(String(r.Polizza ?? ""));
  if (n) counts.set(n.toUpperCase(), (counts.get(n.toUpperCase()) || 0) + 1);
}
const duplicateNumbers = new Set(
  [...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k),
);

const resolved = excelRows.flatMap((r) => {
  const row: RomaUnoExcelRiga = {
    id: r.Id as string,
    stato: r.Stato as string,
    codice: r.Codice as string,
    nome: r.Nome as string,
    polizza: r.Polizza as string,
    gruppo: r.Gruppo as string,
    ramo: r.Ramo as string,
    compagnia: r.Compagnia as string,
    premio: r.Premio,
    provvigioni: r.Provvigioni,
    effetto: r.Effetto,
    scadenza: r.Scadenza,
    ultGaranzia: r.Ult_Garanzia,
    ultScadenza: r.Ult_Scadenza,
    rinnovo: r.Rinnovo as string,
    fraz: r.Fraz,
    delega: r["%Deleg"],
    produttore: r.Produttore as string,
    ae: r["A/E"] as string,
    specialist: r.Specialist as string,
    brand: r.Brand as string,
  };
  return resolveRomaUnoPolizza(row, { clienti, rami, compagnie, produttori, duplicateNumbers });
});

function tally(rows: RomaUnoTitoloRisolto[]) {
  return rows.reduce((acc, r) => {
    acc[`${r.tipo}:${r.esito}`] = (acc[`${r.tipo}:${r.esito}`] || 0) + 1;
    if (r.esito === "saltata") {
      const key = r.motivo.split(";")[0].trim();
      acc[`skip:${key}`] = (acc[`skip:${key}`] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
}

function sqlStr(v: string | null | undefined): string {
  if (v == null || v === "") return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}
function sqlIdent(id: string): string {
  return `'${id}'::uuid`;
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

function titoloValues(r: RomaUnoTitoloRisolto & { newId: string }): string {
  return `(${sqlIdent(r.newId)}, ${sqlStr(r.numeroTitolo)}, ${r.riga}, ${sqlStr(r.stato)},
    ${r.clienteId ? sqlIdent(r.clienteId) : "NULL"}, ${r.clienteId ? sqlIdent(r.clienteId) : "NULL"},
    ${r.compagniaId ? sqlIdent(r.compagniaId) : "NULL"}, ${r.ramoId ? sqlIdent(r.ramoId) : "NULL"},
    ${r.produttoreId ? sqlIdent(r.produttoreId) : "NULL"},
    '${ROMA_UNO_UFFICIO_ID}'::uuid, ${sqlDate(r.garanziaDa)}, ${sqlDate(r.garanziaA)},
    ${sqlDate(r.durataDa)}, ${sqlDate(r.durataA)}, ${sqlDate(r.dataScadenza)}, ${sqlDate(r.dataCompetenza)},
    ${sqlNum(r.premioLordo)}, 0, ${sqlNum(r.premioLordo)},
    ${sqlNum(r.provvigioni)}, ${sqlNum(r.provvigioni)},
    ${sqlStr(r.frazionamento)}, ${sqlStr(r.frazionamento)}, ${sqlNum(r.rate)},
    ${sqlNum(r.percentualeRiparto)}, ${sqlBool(r.tacitoRinnovo)}, ${sqlBool(r.riformaAllaScadenza)},
    ${sqlStr(r.sostituiscePolizza)}, ${r.sostituisceRiga ?? "NULL"},
    ${sqlStr(r.note)}, ${sqlStr(r.prodottoNome)}, ${sqlStr(r.produttoreNome)},
    ${sqlStr(r.aeNome)}, ${sqlStr(r.specialist)},
    'EUR', 1, 'RM', ${r.idLegacy ?? "NULL"})`;
}

const toCreate = resolved
  .filter((r) => r.esito === "da_creare")
  .map((r) => ({ ...r, newId: randomUUID() }));
const skipped = resolved.filter((r) => r.esito === "saltata");
const stats = { excel: excelRows.length, resolved: resolved.length, tally: tally(resolved), duplicates: [...duplicateNumbers] };

mkdirSync(OUT, { recursive: true });
const headerCols = `INSERT INTO public.titoli (
  id, numero_titolo, riga, stato,
  cliente_id, cliente_anagrafica_id,
  compagnia_id, ramo_id, produttore_id, ufficio_id,
  garanzia_da, garanzia_a, durata_da, durata_a, data_scadenza, data_competenza,
  premio_netto, tasse, premio_lordo, provvigioni_firma, provvigioni_quietanza,
  frazionamento, periodicita, rate,
  percentuale_riparto, tacito_rinnovo, riforma_alla_scadenza,
  sostituisce_polizza, sostituisce_riga,
  note, prodotto_nome, produttore_nome, ae_nome, specialist,
  valuta, anni_durata, filiale, id_legacy
) VALUES`;

let n = 0;
for (let i = 0; i < toCreate.length; i += CHUNK) {
  const slice = toCreate.slice(i, i + CHUNK);
  const sql = `ALTER TABLE public.titoli DISABLE TRIGGER trg_genera_quietanze_su_insert_madre;
${headerCols}
${slice.map(titoloValues).join(",\n")};
`;
  writeFileSync(`${OUT}/ins-${String(n).padStart(4, "0")}.sql`, sql);
  n += 1;
}

writeFileSync(
  `${OUT}/manifest.json`,
  JSON.stringify(
    {
      chunks: n,
      toCreate: toCreate.length,
      skipped: skipped.length,
      stats,
      skipRows: skipped.map((r) => ({ numero: r.numeroExcel, motivo: r.motivo })),
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ chunks: n, toCreate: toCreate.length, skipped: skipped.length, tally: stats.tally }, null, 2));
