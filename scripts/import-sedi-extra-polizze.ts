/**
 * Import AM / PR / PS / DP / AP su Milano, Potenza, Parma.
 * Uso:
 *   bun scripts/import-sedi-extra-polizze.ts --emit-sql
 *
 * DP non crea titoli. PS storna il corrispondente. AM/AP/PR sono appendici
 * `/AM n` o `/RG n` sulle polizze già importate (niente clone 1/1, niente madre vuota).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import {
  SEDI_EXTRA_UFFICI,
  buildClienteNameIndex,
  planSediExtraPolizze,
  type SedeExtraCodice,
  type SediExtraCatalogs,
  type SediExtraExistingTitolo,
  type SediExtraPianificato,
  type SediExtraRiga,
} from "../src/lib/sediExtraPolizze.ts";

const CATALOGS_PATH = process.env.SEDI_EXTRA_CATALOGS || "/tmp/sedi-extra-catalogs.json";
const OUT = process.env.SEDI_EXTRA_OUT || "/tmp/sedi-extra-sql";
const CHUNK = 20;

const FILES: Record<SedeExtraCodice, string> = {
  MI: "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/polizze_sede_Milano_c0b6.xlsx",
  PZ: "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/polizze_sede_Potenza_e22e.xlsx",
  PR: "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/polizze_sede_Parma__1__b830.xlsx",
};

type Dump = {
  rami: Array<{ id: string; codice: string | null; descrizione: string | null }>;
  compagnie: Array<{ id: string; codice: string | null; nome: string | null }>;
  clienti: Array<{
    id: string;
    ufficio_id: string | null;
    ragione_sociale: string | null;
    nome: string | null;
    cognome: string | null;
  }>;
  existing: SediExtraExistingTitolo[];
  appendiciMax?: Array<{ titolo_id: string; max_n: number }>;
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

function loadSheet<T>(path: string): T[] {
  const wb = XLSX.readFile(path);
  return XLSX.utils.sheet_to_json<T>(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: true });
}

function titoloValues(r: SediExtraPianificato & { newId: string }): string {
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

function appendiceValues(opts: {
  id: string;
  madreId: string;
  titoloId: string;
  numero: string;
  r: SediExtraPianificato;
}): string {
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
}

function main() {
  const dump = JSON.parse(readFileSync(CATALOGS_PATH, "utf8")) as Dump;
  const ramiByCodice: SediExtraCatalogs["ramiByCodice"] = {};
  for (const r of dump.rami) {
    const code = String(r.codice || "").trim().toUpperCase();
    if (code) ramiByCodice[code] = { id: r.id, descrizione: r.descrizione || code };
  }
  const compagnieByCodice: Record<string, string> = {};
  for (const c of dump.compagnie) {
    const code = String(c.codice || "").trim().toUpperCase();
    if (code && !compagnieByCodice[code]) compagnieByCodice[code] = c.id;
  }
  const appendiciSeq = new Map<string, number>();
  for (const row of dump.appendiciMax || []) {
    appendiciSeq.set(row.titolo_id, Number(row.max_n || 0));
  }

  mkdirSync(OUT, { recursive: true });

  const allInserts: Array<SediExtraPianificato & { newId: string }> = [];
  const allAppendici: Array<{
    id: string;
    madreId: string;
    titoloId: string;
    numero: string;
    r: SediExtraPianificato;
  }> = [];
  const stornoUpdates: Array<{ targetId: string; stornoId: string; dataStorno: string | null; premio: number }> = [];
  const dpUpdates: Array<{ targetId: string; delta: number; note: string }> = [];
  const summary: Record<string, unknown> = {};

  for (const sede of Object.keys(SEDI_EXTRA_UFFICI) as SedeExtraCodice[]) {
    const cfg = SEDI_EXTRA_UFFICI[sede];
    const rows = loadSheet<SediExtraRiga>(FILES[sede]);
    const sedeClienti = dump.clienti.filter((c) => c.ufficio_id === cfg.ufficioId);
    const catalogs: SediExtraCatalogs = {
      compagnieByCodice,
      ramiByCodice,
      existing: dump.existing.filter((t) => t.ufficio_id === cfg.ufficioId),
      clientiNameIndex: buildClienteNameIndex(
        sedeClienti.map((c) => ({
          id: c.id,
          ragione: c.ragione_sociale,
          nome: c.nome,
          cognome: c.cognome,
        })),
      ),
    };
    const { pianificati, stats } = planSediExtraPolizze(rows, sede, catalogs);
    const inserts = pianificati.filter((p) =>
      p.azione === "insert_am" || p.azione === "insert_ap" || p.azione === "insert_pr" || p.azione === "insert_ps",
    );
    const dps = pianificati.filter((p) => p.azione === "update_dp");
    const skips = pianificati.filter((p) => p.azione === "skip");

    for (const p of inserts) {
      const newId = randomUUID();
      allInserts.push({ ...p, newId });
      if (p.azione === "insert_ps" && p.targetId) {
        stornoUpdates.push({
          targetId: p.targetId,
          stornoId: newId,
          dataStorno: p.dataStorno,
          premio: Math.abs(p.premioLordo),
        });
      }
      if ((p.azione === "insert_am" || p.azione === "insert_ap" || p.azione === "insert_pr") && p.madreId) {
        const n = (appendiciSeq.get(p.madreId) || 0) + 1;
        appendiciSeq.set(p.madreId, n);
        allAppendici.push({
          id: randomUUID(),
          madreId: p.madreId,
          titoloId: newId,
          numero: String(n),
          r: p,
        });
      }
    }
    for (const p of dps) {
      if (!p.targetId) continue;
      dpUpdates.push({
        targetId: p.targetId,
        delta: p.provvigioni,
        note: p.note || "Rettifica DP",
      });
    }
    const dpOrfani = pianificati.filter((p) => p.azione === "skip" && p.fileTipo === "DP");
    for (const p of dpOrfani) {
      const sibling = allInserts.find(
        (t) =>
          t.sede === sede &&
          t.numeroBase === p.numeroBase &&
          t.compagniaId === p.compagniaId &&
          (t.azione === "insert_am" || t.azione === "insert_ap" || t.azione === "insert_pr"),
      );
      if (!sibling) continue;
      dpUpdates.push({
        targetId: sibling.newId,
        delta: p.provvigioni,
        note: "Differenza provvigioni gestionale (DP) applicata all'appendice creata nello stesso carico",
      });
    }

    summary[sede] = {
      file: FILES[sede],
      rows: rows.length,
      stats,
      inserts: inserts.length,
      dp: dps.length,
      skip: skips.length,
      skipMotivi: skips.reduce<Record<string, number>>((acc, s) => {
        acc[s.motivo] = (acc[s.motivo] || 0) + 1;
        return acc;
      }, {}),
      orfane: inserts.filter((p) => !p.madreId && p.azione !== "insert_ps").length,
      senzaCliente: inserts.filter((p) => !p.clienteId).length,
    };
  }

  writeFileSync(`${OUT}/plan.json`, JSON.stringify({ summary, generatedAt: new Date().toISOString() }, null, 2));

  const header = `INSERT INTO public.titoli (
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

  let n = 0;
  for (let i = 0; i < allInserts.length; i += CHUNK) {
    const slice = allInserts.slice(i, i + CHUNK);
    const sql = `ALTER TABLE public.titoli DISABLE TRIGGER trg_genera_quietanze_su_insert_madre;
${header}
${slice.map((r) => titoloValues(r)).join(",\n")};
ALTER TABLE public.titoli ENABLE TRIGGER trg_genera_quietanze_su_insert_madre;
`;
    writeFileSync(`${OUT}/ins-${String(n).padStart(4, "0")}.sql`, sql);
    n += 1;
  }

  let a = 0;
  for (let i = 0; i < allAppendici.length; i += 20) {
    const slice = allAppendici.slice(i, i + 20);
    const sql = `INSERT INTO public.appendici_polizza (
  id, titolo_id, numero_appendice, data_appendice, data_effetto, oggetto, tipo, note,
  titolo_modifica_id, titolo_regolazione_id, premio_netto, tasse, premio_lordo, provvigioni, allegati
) VALUES
${slice.map(appendiceValues).join(",\n")};
`;
    writeFileSync(`${OUT}/app-${String(a).padStart(4, "0")}.sql`, sql);
    a += 1;
  }

  const stornoSql = stornoUpdates
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
    .join("\n");
  if (stornoSql) writeFileSync(`${OUT}/storno.sql`, stornoSql + "\n");

  const dpSql = dpUpdates
    .map((d) => {
      const note = d.note.replace(/'/g, "''");
      return `UPDATE public.titoli SET
  provvigioni_firma = COALESCE(provvigioni_firma, 0) + (${d.delta}),
  provvigioni_quietanza = COALESCE(provvigioni_quietanza, 0) + (${d.delta}),
  note = TRIM(BOTH E'\\n' FROM COALESCE(note, '') || E'\\n${note}')
WHERE id = '${d.targetId}'::uuid;`;
    })
    .join("\n");
  if (dpSql) writeFileSync(`${OUT}/dp.sql`, dpSql + "\n");

  writeFileSync(
    `${OUT}/manifest.json`,
    JSON.stringify(
      {
        chunks: n,
        appendiceChunks: a,
        inserts: allInserts.length,
        appendici: allAppendici.length,
        storni: stornoUpdates.length,
        dp: dpUpdates.length,
        summary,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      {
        out: OUT,
        chunks: n,
        appendiceChunks: a,
        inserts: allInserts.length,
        appendici: allAppendici.length,
        storni: stornoUpdates.length,
        dp: dpUpdates.length,
        summary,
      },
      null,
      2,
    ),
  );
}

main();
