/**
 * Genera SQL di import anagrafiche Roma Uno dall'elenco Excel.
 * Uso: bun scripts/build-roma-uno-clienti-sql.ts [xlsx]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import type { CatalogoClienteCBnet } from "../src/lib/romaExeClienti.ts";
import {
  ROMA_UNO_GRUPPI,
  ROMA_UNO_UFFICIO_ID,
  resolveRomaUnoCliente,
  type RomaUnoClienteRisolto,
  type RomaUnoExcelRiga,
} from "../src/lib/romaUnoClienti.ts";

const xlsxPath =
  process.argv[2] ||
  "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/ELENCO_CLIENTI_CB__1__e7df.xlsx";

const wb = XLSX.readFile(xlsxPath);
const rows = XLSX.utils.sheet_to_json<RomaUnoExcelRiga>(wb.Sheets[wb.SheetNames[0]], { defval: "" });

const catalogoRaw = JSON.parse(readFileSync("/tmp/cbnet-clienti-tax.json", "utf8")) as Array<
  CatalogoClienteCBnet & { cf?: string | null; piva?: string | null; cf_az?: string | null }
>;
const catalogo: CatalogoClienteCBnet[] = catalogoRaw.map((c) => ({
  id: c.id,
  ufficio_id: c.ufficio_id,
  codice_fiscale: c.codice_fiscale ?? c.cf ?? null,
  partita_iva: c.partita_iva ?? c.piva ?? null,
  codice_fiscale_azienda: c.codice_fiscale_azienda ?? c.cf_az ?? null,
}));

const usedTax = new Set<string>();
for (const c of catalogo) {
  for (const v of [c.codice_fiscale, c.partita_iva, c.codice_fiscale_azienda]) {
    const t = (v || "").replace(/\s+/g, "").toUpperCase();
    if (t) usedTax.add(t);
  }
}

const resolved = rows.map((r) =>
  resolveRomaUnoCliente(r, catalogo, { usedTax, ufficioId: ROMA_UNO_UFFICIO_ID }),
);

const pendingByTax = new Map<string, { id: string; first: RomaUnoClienteRisolto }>();
type WithId = RomaUnoClienteRisolto & { newId?: string };

const enriched: WithId[] = resolved.map((r) => {
  if (r.esito !== "da_creare") return r;
  const keys = [r.codiceFiscale, r.partitaIva, r.codiceFiscaleAzienda]
    .filter((x): x is string => !!x && !r.cfInventato && !r.pivaInventata)
    .map((x) => x.toUpperCase());
  for (const k of keys) {
    const prev = pendingByTax.get(k);
    if (prev) {
      return {
        ...r,
        esito: "esistente",
        clienteId: prev.id,
        motivo: `Stesso CF/P.IVA della riga ${prev.first.excelCodice}: collegato senza doppione`,
      };
    }
  }
  const newId = randomUUID();
  for (const k of keys) pendingByTax.set(k, { id: newId, first: r });
  catalogo.push({
    id: newId,
    ufficio_id: ROMA_UNO_UFFICIO_ID,
    codice_fiscale: r.codiceFiscale,
    partita_iva: r.partitaIva,
    codice_fiscale_azienda: r.codiceFiscaleAzienda,
  });
  return { ...r, newId };
});

const stats = enriched.reduce(
  (acc, r) => {
    acc[r.esito] = (acc[r.esito] || 0) + 1;
    acc[r.tipoCliente] = (acc[r.tipoCliente] || 0) + 1;
    if (r.cfInventato) acc.cfInventato = (acc.cfInventato || 0) + 1;
    if (r.pivaInventata) acc.pivaInventata = (acc.pivaInventata || 0) + 1;
    if (r.emailFallback) acc.emailFallback = (acc.emailFallback || 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);

function sqlStr(v: string | null | undefined): string {
  if (v == null || v === "") return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

function sqlIdent(id: string): string {
  return `'${id}'::uuid`;
}

const catalogIds = new Set(catalogoRaw.map((c) => c.id));
const existing = enriched.filter((r) => r.esito === "esistente" && r.clienteId);
const existingDb = existing.filter((r) => catalogIds.has(r.clienteId!));
const existingFile = existing.filter((r) => !catalogIds.has(r.clienteId!));
const created = enriched.filter((r): r is WithId & { newId: string } => r.esito === "da_creare" && !!r.newId);
const skipped = enriched.filter((r) => r.esito === "saltata");

const mapExisting = existingDb
  .map(
    (r) =>
      `  (${sqlStr(r.excelCodice)}, ${sqlStr(r.ragioneSociale)}, ${sqlIdent(r.clienteId!)}, 'esistente', ${sqlStr(r.motivo)})`,
  )
  .join(",\n");

const mapExistingFile = existingFile
  .map(
    (r) =>
      `  (${sqlStr(r.excelCodice)}, ${sqlStr(r.ragioneSociale)}, ${sqlIdent(r.clienteId!)}, 'esistente', ${sqlStr(r.motivo)})`,
  )
  .join(",\n");

const mapSkipped = skipped
  .map(
    (r) =>
      `  (${sqlStr(r.excelCodice)}, ${sqlStr(r.ragioneSociale)}, NULL, 'saltata', ${sqlStr(r.motivo)})`,
  )
  .join(",\n");

const existingIds = [...new Set(existingDb.map((r) => r.clienteId!).filter(Boolean))];

const header = `-- Roma Uno clienti ${enriched.length} ${JSON.stringify(stats)}\n`;

const prelude = `${header}
${
  existingIds.length
    ? `UPDATE public.clienti
SET ufficio_id = '${ROMA_UNO_UFFICIO_ID}'::uuid
WHERE id IN (${existingIds.map(sqlIdent).join(", ")})
  AND ufficio_id IS DISTINCT FROM '${ROMA_UNO_UFFICIO_ID}'::uuid;
`
    : "-- nessun cliente già presente da ricollegare a Roma Uno"
}

${
  existing.length
    ? `INSERT INTO public.roma_uno_clienti_map (excel_codice, excel_ragione_sociale, cliente_id, esito, motivo)
VALUES
${mapExisting}
ON CONFLICT (excel_codice) DO UPDATE
SET cliente_id = EXCLUDED.cliente_id, esito = EXCLUDED.esito, motivo = EXCLUDED.motivo;
`
    : "-- nessun match CF/P.IVA già in CBnet"
}

${
  existingFile.length
    ? `-- ${existingFile.length} righe ATI/RTI con stesso CF/P.IVA di un nuovo inserimento: map dopo i chunk`
    : "-- nessuna riga file-dup"
}

${
  skipped.length
    ? `INSERT INTO public.roma_uno_clienti_map (excel_codice, excel_ragione_sociale, cliente_id, esito, motivo)
VALUES
${mapSkipped}
ON CONFLICT (excel_codice) DO UPDATE
SET cliente_id = EXCLUDED.cliente_id, esito = EXCLUDED.esito, motivo = EXCLUDED.motivo;
`
    : "-- nessuna riga saltata"
}
`;

const CHUNK = 12;
const chunks: string[] = [];
for (let i = 0; i < created.length; i += CHUNK) {
  const slice = created.slice(i, i + CHUNK);
  const rowsSql = slice.map((r) => {
    const isPriv = r.tipoCliente === "privato";
    return `(${sqlIdent(r.newId)}, ${sqlStr(r.tipoCliente)}, ${sqlStr(r.codiceCliente)}, ${sqlStr(r.codiceCliente)}, ${sqlStr(r.ragioneSociale)},
    ${sqlStr(r.nome)}, ${sqlStr(r.cognome)}, ${sqlStr(r.titolo)},
    ${sqlStr(isPriv ? r.codiceFiscale : null)}, ${sqlStr(isPriv ? null : r.partitaIva)}, ${sqlStr(isPriv ? null : r.codiceFiscaleAzienda)},
    ${sqlStr(r.formaGiuridica)}, ${sqlIdent(ROMA_UNO_GRUPPI[r.gruppoKey])},
    '${ROMA_UNO_UFFICIO_ID}'::uuid,
    ${sqlStr(r.email)}, ${sqlStr(r.pec)}, ${sqlStr(r.telefono)},
    ${sqlStr(isPriv ? r.indirizzo : null)}, ${sqlStr(isPriv ? r.cap : null)}, ${sqlStr(isPriv ? r.citta : null)}, ${sqlStr(isPriv ? r.provincia : null)},
    ${sqlStr(isPriv ? null : r.indirizzo)}, ${sqlStr(isPriv ? null : r.cap)}, ${sqlStr(isPriv ? null : r.citta)}, ${sqlStr(isPriv ? null : r.provincia)},
    ${sqlStr(r.attenzioneDi)}, ${sqlStr(r.gruppoStatistico)}, ${sqlStr(r.indotto)}, ${sqlStr(r.attivita)},
    ${sqlStr(r.note)}, 'IT', ${r.attivo}, ${sqlStr(r.statoCliente)})`;
  });
  const maps = slice
    .map(
      (r) =>
        `  (${sqlStr(r.excelCodice)}, ${sqlStr(r.ragioneSociale)}, ${sqlIdent(r.newId)}, 'creata', ${sqlStr(r.motivo)})`,
    )
    .join(",\n");
  chunks.push(`INSERT INTO public.clienti (
  id, tipo_cliente, codice_cliente, codice_ricerca, ragione_sociale,
  nome, cognome, titolo,
  codice_fiscale, partita_iva, codice_fiscale_azienda,
  forma_giuridica, gruppo_finanziario_id,
  ufficio_id, email, pec, telefono,
  indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza,
  indirizzo_sede, cap_sede, citta_sede, provincia_sede,
  attenzione_di, gruppo_statistico, indotto, attivita,
  note, nazione, attivo, stato_cliente
)
VALUES
${rowsSql.join(",\n")};

INSERT INTO public.roma_uno_clienti_map (excel_codice, excel_ragione_sociale, cliente_id, esito, motivo)
VALUES
${maps}
ON CONFLICT (excel_codice) DO UPDATE
SET cliente_id = EXCLUDED.cliente_id, esito = EXCLUDED.esito, motivo = EXCLUDED.motivo;
`);
}

const postlude = existingFile.length
  ? `${header}
INSERT INTO public.roma_uno_clienti_map (excel_codice, excel_ragione_sociale, cliente_id, esito, motivo)
VALUES
${mapExistingFile}
ON CONFLICT (excel_codice) DO UPDATE
SET cliente_id = EXCLUDED.cliente_id, esito = EXCLUDED.esito, motivo = EXCLUDED.motivo;
`
  : "";

writeFileSync("/tmp/roma-uno-clienti-import.sql", prelude + "\n" + chunks.join("\n") + "\n" + postlude);
writeFileSync("/tmp/roma-uno-clienti-prelude.sql", prelude);
writeFileSync("/tmp/roma-uno-clienti-postlude.sql", postlude);
for (let i = 0; i < chunks.length; i++) {
  writeFileSync(`/tmp/roma-uno-clienti-chunk-${String(i + 1).padStart(2, "0")}.sql`, header + "\n" + chunks[i]);
}
writeFileSync(
  "/tmp/roma-uno-clienti-resolved.json",
  JSON.stringify(
    {
      stats,
      skipped: skipped.map((r) => ({ excel: r.excelCodice, nome: r.ragioneSociale })),
      existingDb: existingDb.map((r) => ({ excel: r.excelCodice, id: r.clienteId, nome: r.ragioneSociale })),
      existingFile: existingFile.length,
      created: created.length,
      cfInventato: created.filter((r) => r.cfInventato).length,
      pivaInventata: created.filter((r) => r.pivaInventata).length,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      total: enriched.length,
      stats,
      existingDb: existingDb.length,
      existingFile: existingFile.length,
      created: created.length,
      skipped: skipped.length,
      chunks: chunks.length,
    },
    null,
    2,
  ),
);
