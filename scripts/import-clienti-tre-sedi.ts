/**
 * Import anagrafiche Milano / Parma / Potenza dal tracciato gestionale.
 * Uso:
 *   bun scripts/import-clienti-tre-sedi.ts --dry-run --emit-sql
 *   bun scripts/import-clienti-tre-sedi.ts
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import type { CampobassoRiga, CatalogoClienteCBnet } from "../src/lib/campobassoClienti.ts";
import {
  TRE_SEDI,
  pickKeepersTreSedi,
  resolveTreSediCliente,
  type TreSediKey,
  type TreSediRisolto,
} from "../src/lib/clientiTreSedi.ts";

const UPLOADS =
  "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads";

const FILES: Array<{ sede: TreSediKey; file: string }> = [
  { sede: "MI", file: `${UPLOADS}/Clienti_sede_Milano_8637.xlsx` },
  { sede: "PR", file: `${UPLOADS}/Clienti_sede_Parma_7076.xlsx` },
  { sede: "PZ", file: `${UPLOADS}/Clienti_sede_Potenza_7c8a.xlsx` },
];

const DRY = process.argv.includes("--dry-run");
const EMIT_SQL = process.argv.includes("--emit-sql");

const GF_IDS: Record<TreSediRisolto["gruppoFinanziarioKey"], string> = {
  linea_persona: "05478f51-65b4-41d2-b743-d7a5faa181e0",
  aziende_private: "3b49294f-373e-456e-9bec-0bb7942aa7bb",
  enti_territoriali: "62ae8e50-e440-4810-b4df-6cb64a8f2155",
  enti_no_lucro: "b6cd962d-67b9-4dd8-a329-8f4757cbd51d",
};

function sqlStr(v: string | null | undefined): string {
  if (v == null || v === "") return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

function loadCatalog(): CatalogoClienteCBnet[] {
  if (!existsSync("/tmp/cb_clienti_db.json")) return [];
  return JSON.parse(readFileSync("/tmp/cb_clienti_db.json", "utf8"));
}

function loadTakenTax(): Set<string> {
  const taken = new Set<string>();
  if (existsSync("/tmp/cb_tax_ids.json")) {
    for (const v of JSON.parse(readFileSync("/tmp/cb_tax_ids.json", "utf8")) as string[]) {
      if (v) taken.add(String(v).replace(/\s+/g, "").toUpperCase());
    }
  }
  for (const c of loadCatalog()) {
    for (const v of [c.codice_fiscale, c.partita_iva, c.codice_fiscale_azienda]) {
      if (v) taken.add(String(v).replace(/\s+/g, "").toUpperCase());
    }
  }
  return taken;
}

function toInsert(r: TreSediRisolto & { newId: string }) {
  const isPrivato = r.tipoCliente === "privato";
  return {
    id: r.newId,
    codice_ricerca: r.codice,
    tipo_cliente: r.tipoCliente,
    tipo_persona: isPrivato ? "F" : "G",
    ufficio_id: r.ufficioId,
    attivo: true,
    stato_cliente: "Attivo",
    ragione_sociale: r.ragioneSociale,
    nome: r.nome,
    cognome: r.cognome,
    codice_fiscale: r.codiceFiscale,
    partita_iva: r.partitaIva,
    codice_fiscale_azienda: r.codiceFiscaleAzienda,
    forma_giuridica: r.formaGiuridica,
    email: r.email,
    pec: r.pec,
    telefono: r.telefono,
    attenzione_di: r.attenzioneDi,
    gruppo_finanziario_id: GF_IDS[r.gruppoFinanziarioKey],
    gruppo_statistico: r.gruppoStatistico,
    indotto: r.indotto,
    zona: r.zona,
    attivita: r.attivita,
    spec_sx_danni: r.specSx,
    ha_incarico: !!r.dataAcquisito,
    incarico_da: r.dataAcquisito,
    indirizzo_residenza: isPrivato ? r.indirizzo : null,
    cap_residenza: isPrivato ? r.cap : null,
    citta_residenza: isPrivato ? r.citta : null,
    provincia_residenza: isPrivato ? r.provincia : null,
    indirizzo_sede: isPrivato ? null : r.indirizzo,
    cap_sede: isPrivato ? null : r.cap,
    citta_sede: isPrivato ? null : r.citta,
    provincia_sede: isPrivato ? null : r.provincia,
    note: r.note,
  };
}

function emitSql(
  toCreate: Array<TreSediRisolto & { newId: string }>,
  potenzaProfiloId: string,
) {
  const dir = "/tmp/tre-sedi-sql";
  mkdirSync(dir, { recursive: true });

  const chunks: string[] = [];
  for (let i = 0; i < toCreate.length; i += 50) {
    const batch = toCreate.slice(i, i + 50);
    const values = batch
      .map((r) => {
        const row = toInsert(r);
        return `(${[
          `'${row.id}'::uuid`,
          sqlStr(row.codice_ricerca),
          sqlStr(row.tipo_cliente),
          sqlStr(row.tipo_persona),
          `'${row.ufficio_id}'::uuid`,
          "true",
          sqlStr(row.stato_cliente),
          sqlStr(row.ragione_sociale),
          sqlStr(row.nome),
          sqlStr(row.cognome),
          sqlStr(row.codice_fiscale),
          sqlStr(row.partita_iva),
          sqlStr(row.codice_fiscale_azienda),
          sqlStr(row.forma_giuridica),
          sqlStr(row.email),
          sqlStr(row.pec),
          sqlStr(row.telefono),
          sqlStr(row.attenzione_di),
          row.gruppo_finanziario_id ? `'${row.gruppo_finanziario_id}'::uuid` : "NULL",
          sqlStr(row.gruppo_statistico),
          sqlStr(row.indotto),
          sqlStr(row.zona),
          sqlStr(row.attivita),
          sqlStr(row.spec_sx_danni),
          row.ha_incarico ? "true" : "false",
          sqlStr(row.incarico_da),
          sqlStr(row.indirizzo_residenza),
          sqlStr(row.cap_residenza),
          sqlStr(row.citta_residenza),
          sqlStr(row.provincia_residenza),
          sqlStr(row.indirizzo_sede),
          sqlStr(row.cap_sede),
          sqlStr(row.citta_sede),
          sqlStr(row.provincia_sede),
          sqlStr(row.note),
        ].join(", ")})`;
      })
      .join(",\n");
    chunks.push(`INSERT INTO public.clienti (
  id, codice_ricerca, tipo_cliente, tipo_persona, ufficio_id, attivo, stato_cliente,
  ragione_sociale, nome, cognome, codice_fiscale, partita_iva, codice_fiscale_azienda,
  forma_giuridica, email, pec, telefono, attenzione_di, gruppo_finanziario_id,
  gruppo_statistico, indotto, zona, attivita, spec_sx_danni, ha_incarico, incarico_da,
  indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza,
  indirizzo_sede, cap_sede, citta_sede, provincia_sede, note
) VALUES\n${values};`);
  }
  chunks.forEach((sql, idx) =>
    writeFileSync(`${dir}/1-${String(idx + 1).padStart(3, "0")}-clienti.sql`, sql),
  );

  const ccValues: string[] = [];
  for (const r of toCreate) {
    const cfg = { ...TRE_SEDI[r.sede] };
    const profiloId = r.sede === "PZ" ? potenzaProfiloId : cfg.specialistProfiloId;
    ccValues.push(`(${[
      `'${r.newId}'::uuid`,
      sqlStr("Backoffice"),
      `'${profiloId}'::uuid`,
      sqlStr(cfg.filiale),
      sqlStr(cfg.specialistContatto),
      sqlStr(r.brand),
      sqlStr(r.dataAcquisito),
    ].join(", ")})`);
  }
  const ccChunks: string[] = [];
  for (let i = 0; i < ccValues.length; i += 80) {
    const batch = ccValues.slice(i, i + 80);
    ccChunks.push(`INSERT INTO public.codici_commerciali_cliente (
  cliente_id, ruolo, profilo_id, filiale, contatto, societa_brand, data_acquisito
) VALUES\n${batch.join(",\n")};`);
  }
  ccChunks.forEach((sql, idx) =>
    writeFileSync(`${dir}/2-${String(idx + 1).padStart(3, "0")}-cc.sql`, sql),
  );

  return { dir, clientiChunks: chunks.length, ccChunks: ccChunks.length };
}

function main() {
  const catalogo = loadCatalog();
  const takenTax = loadTakenTax();
  const resolved: TreSediRisolto[] = [];

  for (const { sede, file } of FILES) {
    if (!existsSync(file)) throw new Error(`Excel non trovato: ${file}`);
    const rows = XLSX.utils.sheet_to_json<CampobassoRiga>(
      XLSX.readFile(file, { cellDates: true }).Sheets.Sheet1,
      { defval: null, raw: false },
    );
    for (const riga of rows) {
      resolved.push(resolveTreSediCliente(riga, sede, catalogo, takenTax));
    }
  }

  const { keepers, dups } = pickKeepersTreSedi(resolved);
  const toCreate = keepers.filter((r) => r.esito === "da_creare");
  const toLink = keepers.filter((r) => r.esito === "collegare");

  const bySede = (rows: TreSediRisolto[]) =>
    rows.reduce(
      (acc, r) => {
        acc[r.sede] = (acc[r.sede] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

  const report = {
    totFile: resolved.length,
    daCreare: toCreate.length,
    collegare: toLink.length,
    saltati: dups.length,
    perSedeCreare: bySede(toCreate),
    perSedeSaltati: bySede(dups),
    tipi: toCreate.reduce(
      (acc, r) => {
        acc[r.tipoCliente] = (acc[r.tipoCliente] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    inventati: {
      cf: toCreate.filter((r) => r.cfInventato).length,
      piva: toCreate.filter((r) => r.pivaInventata).length,
      indirizzo: toCreate.filter((r) => r.indirizzoPlaceholder).length,
    },
    saltatiMotivi: dups.reduce(
      (acc, r) => {
        acc[r.motivo] = (acc[r.motivo] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    collegamenti: toLink.map((r) => ({
      sede: r.sede,
      codice: r.codice,
      motivo: r.motivo,
      clienteId: r.clienteId,
    })),
  };
  writeFileSync("/tmp/tre-sedi-import-plan.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (DRY || EMIT_SQL) {
    const potenzaProfiloId =
      process.env.POTENZA_PROFILO_ID || TRE_SEDI.PZ.specialistProfiloId || "00000000-0000-0000-0000-000000000000";
    const withIds = toCreate.map((r) => ({ ...r, newId: randomUUID() }));
    const emitted = emitSql(withIds, potenzaProfiloId);
    writeFileSync(
      "/tmp/tre-sedi-create-ids.json",
      JSON.stringify(withIds.map((r) => ({ sede: r.sede, codice: r.codice, id: r.newId, tipo: r.tipoCliente }))),
    );
    console.log(JSON.stringify({ emit: emitted, dry: DRY }, null, 2));
  }
}

main();
