/**
 * Piano + SQL: mandati EXE → compagnie/rapporti CBnet.
 * Uso: bun scripts/apply-roma-exe-compagnie-armonizza.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import {
  anagraficaFromExcel,
  buildDirezioneByBrand,
  cleanAggiuntiva,
  parseTipoMandato,
  rapportoInsertMode,
  resolveRomaExeMandato,
  sanitizeExeTelefono,
  type RomaExeCompagniaExcelRiga,
} from "../src/lib/romaExeCompagnieArmonizza.ts";
import type { CatalogoCompagniaCBnet, CatalogoGruppoCompagnia } from "../src/lib/romaExeCompagnie.ts";

const XLSX_PATH =
  process.env.EXE_COMPAGNIE_XLSX ||
  "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/Compagnie_al_05.03.2026__1__3195.xlsx";

const catalogo = JSON.parse(readFileSync("/tmp/cbnet-compagnie.json", "utf8")) as Array<
  CatalogoCompagniaCBnet & { gruppo?: string | null; gruppo_codice?: string | null }
>;
const gruppi = (
  JSON.parse(readFileSync("/tmp/cbnet-compagnie.json", "utf8")) as Array<{
    gruppo_compagnia_id?: string | null;
    gruppo?: string | null;
    gruppo_codice?: string | null;
  }>
)
  .filter((c) => c.gruppo_compagnia_id && c.gruppo)
  .reduce((acc, c) => {
    if (!acc.some((g) => g.id === c.gruppo_compagnia_id)) {
      acc.push({
        id: c.gruppo_compagnia_id as string,
        descrizione: c.gruppo as string,
        codice: c.gruppo_codice,
      });
    }
    return acc;
  }, [] as CatalogoGruppoCompagnia[]);

const extraGruppi: CatalogoGruppoCompagnia[] = [
  { id: "8d394866-aab5-4b07-a9d3-b718801cf16f", descrizione: "Unipol Assicurazioni S.p.a." },
  { id: "029462f4-3050-4b59-865e-bcb54a891300", descrizione: "Societa' Reale Mutua di Assicurazioni" },
  { id: "a7b6c33c-2aba-46fc-8959-6d78b02c2ca4", descrizione: "Itas Mutua" },
  { id: "5f9da355-a4b2-4707-9601-75fd3d333283", descrizione: "Lloyd's" },
  { id: "d32a9b14-09a3-4f16-8284-aa0aa81a1de6", descrizione: "S2C" },
  { id: "e75d0191-dcdb-4e84-a1ef-40502009b694", descrizione: "Uca Assicurazioni S.p.a." },
  { id: "ef4f747c-7e35-4175-87f0-8ec213ac4c8a", descrizione: "SACE" },
  { id: "a1b81b46-4653-4f52-bc60-4f35460e7646", descrizione: "Sace Bt Spa" },
  { id: "ded9e4a0-185f-45d2-8166-a9b10a799558", descrizione: "Argoglobal Assicurazioni Spa" },
  { id: "0acf2ef6-0873-4e60-ad60-7497cf2c4685", descrizione: "EUROP ASSISTANCE ITALIA" },
  { id: "8f41ad9b-8e01-440e-8f6c-2434cd9d0745", descrizione: "Tutela Legale Spa" },
  { id: "3b8b8a4c-bb1f-49ac-8964-b1473d2a232c", descrizione: "Berkshire Hathaway International Insurance Limite" },
  { id: "37ff80e3-8d57-47e5-abee-707a48b27b3c", descrizione: "GLOBAL ASSISTANCE" },
];
for (const g of extraGruppi) {
  if (!gruppi.some((x) => x.id === g.id)) gruppi.push(g);
}
try {
  const dumped = JSON.parse(readFileSync("/tmp/cbnet-gruppi.json", "utf8")) as CatalogoGruppoCompagnia[];
  for (const g of dumped) {
    if (g.id && g.descrizione && !gruppi.some((x) => x.id === g.id)) gruppi.push(g);
  }
} catch {
  /* dump gruppi opzionale */
}

const mapRows: Array<{ exe_nome?: string | null; compagnia_id?: string | null }> = catalogo
  .filter((c) => String(c.codice ?? "").startsWith("RM2"))
  .map((c) => ({ exe_nome: c.nome, compagnia_id: c.id }));

const wb = XLSX.readFile(XLSX_PATH);
const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false });
const byCode = new Map<string, RomaExeCompagniaExcelRiga>();
for (const r of raw) {
  const exeCodice = String(r[0] ?? "").trim();
  const brandNome = String(r[1] ?? "").trim();
  if (!exeCodice || !brandNome) continue;
  if (!byCode.has(exeCodice)) {
    byCode.set(exeCodice, {
      exeCodice,
      brandNome,
      aggiuntiva: cleanAggiuntiva(String(r[2] ?? "")),
      tipoMandato: parseTipoMandato(String(r[3] ?? "")),
      indirizzo: String(r[4] ?? ""),
      cap: String(r[5] ?? ""),
      citta: String(r[6] ?? ""),
      provincia: String(r[7] ?? ""),
      telefono: String(r[8] ?? ""),
      emailRaw: String(r[9] ?? ""),
      banca: String(r[10] ?? ""),
      iban: String(r[11] ?? ""),
    });
  }
}

const direzioneByBrand = buildDirezioneByBrand(catalogo, mapRows);
const resolved = [...byCode.values()].map((r) =>
  resolveRomaExeMandato(r, { catalogo, gruppi, direzioneByBrand }),
);

const existingCodes = new Set(catalogo.map((c) => String(c.codice ?? "").toLowerCase()).filter(Boolean));
let nextAgenzia = 1;
function nextCodice(prefix: string) {
  let code = "";
  do {
    code = `${prefix}${String(nextAgenzia).padStart(4, "0")}`;
    nextAgenzia += 1;
  } while (existingCodes.has(code.toLowerCase()));
  existingCodes.add(code.toLowerCase());
  return code;
}

const nuove = new Map<string, { id: string; codice: string; tipo: string; nome: string }>();
function keyNome(nome: string) {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

type CompagniaMeta = {
  gruppo_compagnia_id?: string | null;
  principale_id?: string | null;
  codice?: string | null;
};

const compagniaMeta = (() => {
  try {
    return JSON.parse(readFileSync("/tmp/cbnet-compagnie-meta.json", "utf8")) as Record<string, CompagniaMeta>;
  } catch {
    return {} as Record<string, CompagniaMeta>;
  }
})();

const insertsCompagnie: string[] = [];
const insertsRapporti: string[] = [];
const updatesMap: string[] = [];
let reusedPrincipale = 0;
let createdPrincipale = 0;

function sqlStr(v: string | null | undefined): string {
  if (v == null || v === "") return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

for (const r of resolved) {
  if (r.skip || !r.gruppoId || !r.controparte) continue;
  let controparteId = r.controparte.id;
  if (!controparteId) {
    const k = keyNome(r.controparte.nome);
    let created = nuove.get(k);
    if (!created) {
      const id = randomUUID();
      const tipo = r.controparte.tipo;
      const codice = nextCodice(tipo === "broker" ? "EXB" : tipo === "direzione" ? "EXD" : "EXA");
      const ana = anagraficaFromExcel(r);
      created = { id, codice, tipo, nome: r.controparte.nome };
      nuove.set(k, created);
      insertsCompagnie.push(`INSERT INTO public.compagnie (
  id, nome, codice, tipo, gruppo_compagnia_id, indirizzo, cap, comune, provincia,
  telefono, mail, pec, iban, note, attiva, stato, accordo_collaborazione, ratifica_art_118
) VALUES (
  '${id}'::uuid, ${sqlStr(created.nome)}, ${sqlStr(codice)}, ${sqlStr(tipo)},
  ${r.tipoMandato === "direzione" ? `'${r.gruppoId}'::uuid` : "NULL"},
  ${sqlStr(ana.indirizzo)}, ${sqlStr(ana.cap)}, ${sqlStr(ana.comune)}, ${sqlStr(ana.provincia)},
  ${sqlStr(sanitizeExeTelefono(ana.telefono))}, ${sqlStr(ana.mail)}, ${sqlStr(ana.pec)}, ${sqlStr(ana.iban)},
  ${sqlStr(ana.noteBanca ? `Import EXE Roma: ${ana.noteBanca}` : "Import EXE Roma")},
  true, 'attivo', false, false
);`);
    }
    controparteId = created.id;
    r.controparte.id = created.id;
    r.controparte.codice = created.codice;
  }

  const ana = anagraficaFromExcel(r);
  const meta = compagniaMeta[controparteId] ?? {};
  const mode = rapportoInsertMode({
    compagniaGruppoId: meta.gruppo_compagnia_id ?? null,
    rapportoGruppoId: r.gruppoId,
    principaleId: meta.principale_id ?? null,
  });

  let rapportoId = randomUUID();
  let codiceRapporto = r.codiceRapporto;
  let isPrincipale = false;
  if (mode === "reuse_principale" && meta.principale_id) {
    rapportoId = meta.principale_id;
    reusedPrincipale += 1;
    r.motivo = `${r.motivo} | riusa principale ${meta.codice ?? meta.principale_id}`;
  } else {
    if (mode === "insert_principale") {
      codiceRapporto = meta.codice || r.codiceRapporto;
      isPrincipale = true;
      createdPrincipale += 1;
      r.motivo = `${r.motivo} | crea principale ${codiceRapporto}`;
    } else {
      r.motivo = `${r.motivo} | rapporto ${codiceRapporto}`;
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
    motivo = ${sqlStr(r.motivo)}
WHERE exe_codice = ${sqlStr(r.exeCodice)};`);
}

for (const r of resolved.filter((x) => x.skip)) {
  updatesMap.push(`UPDATE public.roma_exe_compagnie_map
SET tipo_mandato = ${sqlStr(r.tipoMandato)},
    exe_aggiuntiva = ${sqlStr(r.aggiuntiva)},
    motivo = ${sqlStr(r.motivo)}
WHERE exe_codice = ${sqlStr(r.exeCodice)};`);
}

const stats = {
  excel: byCode.size,
  risolti: resolved.length,
  skip: resolved.filter((r) => r.skip).length,
  rapporti: insertsRapporti.length,
  nuoveControparti: nuove.size,
  esistenti: resolved.filter((r) => r.controparte?.esito === "esistente").length,
  direzione: resolved.filter((r) => r.controparte?.esito === "direzione").length,
  daCreare: resolved.filter((r) => r.controparte?.esito === "da_creare" && !r.skip).length,
  senzaGruppo: resolved.filter((r) => !r.gruppoId && !r.skip).length,
  reusedPrincipale,
  createdPrincipale,
};

const sql = `-- Armonizzazione mandati EXE Roma → rapporti CBnet
-- ${new Date().toISOString()}
${insertsCompagnie.join("\n")}
${insertsRapporti.join("\n")}
${updatesMap.join("\n")}
`;

writeFileSync("/tmp/exe-armonizza-plan.json", JSON.stringify({ stats, resolved, nuove: [...nuove.values()] }, null, 2));
writeFileSync("/tmp/exe-armonizza.sql", sql);
writeFileSync("/tmp/exe-armonizza-compagnie.sql", insertsCompagnie.join("\n"));
writeFileSync("/tmp/exe-armonizza-rapporti.sql", insertsRapporti.join("\n"));
writeFileSync("/tmp/exe-armonizza-map.sql", updatesMap.join("\n"));
console.log(JSON.stringify(stats, null, 2));
console.log("nuove", [...nuove.values()].slice(0, 15));
console.log("skip sample", resolved.filter((r) => r.skip).slice(0, 8).map((r) => [r.exeCodice, r.brandNome, r.motivo]));
