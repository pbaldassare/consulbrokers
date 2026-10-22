/**
 * Rigenera SQL rapporti/map da un piano già applicato sulle compagnie.
 * Uso: bun scripts/generate-roma-exe-rapporti-from-plan.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
  anagraficaFromExcel,
  rapportoInsertMode,
} from "../src/lib/romaExeCompagnieArmonizza.ts";

type Plan = {
  resolved: Array<{
    exeCodice: string;
    brandNome: string;
    aggiuntiva: string | null;
    tipoMandato: "direzione" | "pluri" | "broker";
    tipoRapporto: "Direzione" | "Agenzia" | "Broker";
    skip: boolean;
    motivo: string;
    direzioneNome: string | null;
    brandCanonical: string;
    gruppoId: string | null;
    codiceRapporto: string;
    controparte: { id: string | null; nome: string } | null;
    indirizzo?: string | null;
    cap?: string | null;
    citta?: string | null;
    provincia?: string | null;
    telefono?: string | null;
    emailRaw?: string | null;
    banca?: string | null;
    iban?: string | null;
  }>;
};

type CompagniaMeta = {
  gruppo_compagnia_id?: string | null;
  principale_id?: string | null;
  codice?: string | null;
};

const plan = JSON.parse(readFileSync("/tmp/exe-armonizza-plan.json", "utf8")) as Plan;
const meta = JSON.parse(readFileSync("/tmp/cbnet-compagnie-meta.json", "utf8")) as Record<
  string,
  CompagniaMeta
>;

function sqlStr(v: string | null | undefined): string {
  if (v == null || v === "") return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

const insertsRapporti: string[] = [];
const updatesMap: string[] = [];
const stats = { insertNn: 0, insertPrincipale: 0, reusePrincipale: 0, skip: 0 };

for (const r of plan.resolved) {
  if (r.skip) {
    stats.skip += 1;
    updatesMap.push(`UPDATE public.roma_exe_compagnie_map
SET tipo_mandato = ${sqlStr(r.tipoMandato)},
    exe_aggiuntiva = ${sqlStr(r.aggiuntiva)},
    motivo = ${sqlStr(r.motivo)}
WHERE exe_codice = ${sqlStr(r.exeCodice)};`);
    continue;
  }
  if (!r.gruppoId || !r.controparte?.id) {
    updatesMap.push(`UPDATE public.roma_exe_compagnie_map
SET tipo_mandato = ${sqlStr(r.tipoMandato)},
    exe_aggiuntiva = ${sqlStr(r.aggiuntiva)},
    motivo = ${sqlStr(r.motivo || "Senza gruppo o controparte")}
WHERE exe_codice = ${sqlStr(r.exeCodice)};`);
    continue;
  }

  const controparteId = r.controparte.id;
  const cmeta = meta[controparteId] ?? {};
  const mode = rapportoInsertMode({
    compagniaGruppoId: cmeta.gruppo_compagnia_id ?? null,
    rapportoGruppoId: r.gruppoId,
    principaleId: cmeta.principale_id ?? null,
  });
  const ana = anagraficaFromExcel(r);

  let rapportoId = randomUUID();
  let codiceRapporto = r.codiceRapporto;
  let isPrincipale = false;
  let motivo = r.motivo;

  if (mode === "reuse_principale" && cmeta.principale_id) {
    rapportoId = cmeta.principale_id;
    stats.reusePrincipale += 1;
    motivo = `${r.motivo} | riusa principale ${cmeta.codice ?? cmeta.principale_id}`;
  } else {
    if (mode === "insert_principale") {
      codiceRapporto = cmeta.codice || r.codiceRapporto;
      isPrincipale = true;
      stats.insertPrincipale += 1;
      motivo = `${r.motivo} | crea principale ${codiceRapporto}`;
    } else {
      stats.insertNn += 1;
      motivo = `${r.motivo} | rapporto ${codiceRapporto}`;
    }
    insertsRapporti.push(`INSERT INTO public.compagnia_rapporti (
  id, compagnia_id, gruppo_compagnia_id, codice_rapporto, tipo_rapporto, nome_rapporto,
  sede_denominazione, sede_indirizzo, sede_cap, sede_citta, sede_provincia,
  iban_dedicato, email_referente, email_estratto_conto, telefono_referente,
  note, attivo, is_principale, data_inizio
) VALUES (
  '${rapportoId}'::uuid, '${controparteId}'::uuid, '${r.gruppoId}'::uuid,
  ${sqlStr(codiceRapporto)}, ${sqlStr(r.tipoRapporto)},
  ${sqlStr(r.aggiuntiva || r.direzioneNome || r.brandCanonical)},
  ${sqlStr(r.aggiuntiva || r.direzioneNome)}, ${sqlStr(ana.indirizzo)}, ${sqlStr(ana.cap)},
  ${sqlStr(ana.comune)}, ${sqlStr(ana.provincia)}, ${sqlStr(ana.iban)},
  ${sqlStr(ana.mail)}, ${sqlStr(ana.pec || ana.mail)}, ${sqlStr(ana.telefono)},
  ${sqlStr(`Mandato EXE ${r.exeCodice} · ${r.tipoMandato}`)},
  true, ${isPrincipale}, '2026-03-05'
);`);
  }

  updatesMap.push(`UPDATE public.roma_exe_compagnie_map
SET tipo_mandato = ${sqlStr(r.tipoMandato)},
    exe_aggiuntiva = ${sqlStr(r.aggiuntiva)},
    controparte_id = '${controparteId}'::uuid,
    rapporto_id = '${rapportoId}'::uuid,
    motivo = ${sqlStr(motivo)}
WHERE exe_codice = ${sqlStr(r.exeCodice)};`);
}

writeFileSync("/tmp/exe-armonizza-rapporti.sql", insertsRapporti.join("\n"));
writeFileSync("/tmp/exe-armonizza-map.sql", updatesMap.join("\n"));
const batchSize = 12;
for (let i = 0; i < insertsRapporti.length; i += batchSize) {
  const n = String(Math.floor(i / batchSize)).padStart(2, "0");
  writeFileSync(`/tmp/exe-rap-ok-${n}.sql`, insertsRapporti.slice(i, i + batchSize).join("\n"));
}
console.log(JSON.stringify({ ...stats, rapporti: insertsRapporti.length, map: updatesMap.length }, null, 2));
