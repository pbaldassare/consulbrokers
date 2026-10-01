/**
 * Import anagrafiche sede Catania dal tracciato gestionale.
 * Uso:
 *   bun scripts/import-catania-clienti.ts --dry-run
 *   bun scripts/import-catania-clienti.ts
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import {
  CATANIA_ANAG_ALIASES,
  CATANIA_FILIALE,
  CATANIA_SEDE_EMAIL,
  CATANIA_TURCO_EMAIL,
  CATANIA_TURCO_PROFILE_ID,
  CATANIA_UFFICIO_ID,
  mapProduttoreNome,
  pickKeepersCatania,
  resolveCataniaCliente,
  type CatalogoCatania,
  type CataniaRiga,
  type CataniaRisolto,
} from "../src/lib/cataniaClienti.ts";
import { normalizeNomeKey } from "../src/lib/campobassoClienti.ts";

config({ path: path.resolve(process.cwd(), ".env") });

const EXCEL =
  process.argv.find((a) => a.endsWith(".xlsx")) ||
  "/root/.cursor/projects/home-ubuntu-cursor-projects-cbnet/uploads/Clienti_sede_Catania__1__07ba.xlsx";
const DRY = process.argv.includes("--dry-run");
const EMIT_SQL = process.argv.includes("--emit-sql");
const BATCH = 40;

const GF_IDS: Record<CataniaRisolto["gruppoFinanziarioKey"], string> = {
  linea_persona: "05478f51-65b4-41d2-b743-d7a5faa181e0",
  aziende_private: "3b49294f-373e-456e-9bec-0bb7942aa7bb",
  enti_territoriali: "62ae8e50-e440-4810-b4df-6cb64a8f2155",
  enti_no_lucro: "b6cd962d-67b9-4dd8-a329-8f4757cbd51d",
};

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Manca ${name} in .env`);
  return v;
}

function sqlStr(v: string | null | undefined): string {
  if (v == null || v === "") return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

function toInsert(r: CataniaRisolto) {
  const isPrivato = r.tipoCliente === "privato";
  return {
    codice_ricerca: r.codice,
    tipo_cliente: r.tipoCliente,
    tipo_persona: isPrivato ? "F" : "G",
    ufficio_id: CATANIA_UFFICIO_ID,
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
  };
}

function anagKeys(a: {
  nome?: string | null;
  cognome?: string | null;
  ragione_sociale?: string | null;
}): string[] {
  return [
    normalizeNomeKey(a.ragione_sociale || ""),
    normalizeNomeKey(`${a.cognome || ""} ${a.nome || ""}`),
    normalizeNomeKey(`${a.nome || ""} ${a.cognome || ""}`),
    normalizeNomeKey(a.cognome || ""),
  ].filter(Boolean);
}

async function ensureTurcoAnagrafica(sb: ReturnType<typeof createClient>): Promise<string> {
  const { data: existing, error: findErr } = await sb
    .from("anagrafiche_professionali")
    .select("id")
    .eq("email", CATANIA_TURCO_EMAIL)
    .eq("attivo", true)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing?.id) return existing.id;

  const { data: byName } = await sb
    .from("anagrafiche_professionali")
    .select("id")
    .ilike("cognome", "Turco")
    .ilike("nome", "Alida")
    .eq("attivo", true)
    .maybeSingle();
  if (byName?.id) return byName.id;

  const { data, error } = await sb
    .from("anagrafiche_professionali")
    .insert({
      tipo: "responsabile_sede",
      ruoli: ["responsabile_sede"],
      nome: "Alida",
      cognome: "Turco",
      ragione_sociale: "Turco Alida",
      email: CATANIA_TURCO_EMAIL,
      ufficio_id: CATANIA_UFFICIO_ID,
      attivo: true,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "insert Turco");
  return data.id;
}

async function loadRemote(sb: ReturnType<typeof createClient>) {
  const { data: clienti, error: cliErr } = await sb
    .from("clienti")
    .select(
      "id, ufficio_id, attivo, codice_fiscale, partita_iva, codice_fiscale_azienda, codice_ricerca, codice_cliente, nome, cognome, ragione_sociale",
    );
  if (cliErr) throw cliErr;
  const catalogo: CatalogoCatania[] = (clienti || []).map((c: Record<string, unknown>) => ({
    ...c,
    nome_norm: `${c.cognome || ""} ${c.nome || ""} ${c.ragione_sociale || ""}`,
  }));

  const { data: anag, error: anagErr } = await sb
    .from("anagrafiche_professionali")
    .select("id, tipo, nome, cognome, ragione_sociale, attivo")
    .eq("attivo", true);
  if (anagErr) throw anagErr;
  const anagByName = new Map<string, string>(Object.entries(CATANIA_ANAG_ALIASES));
  for (const a of anag || []) {
    for (const k of anagKeys(a)) {
      if (!anagByName.has(k)) anagByName.set(k, a.id);
    }
  }
  return { catalogo, anagByName };
}

function resolveProdIds(names: string[], anagByName: Map<string, string>): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const id = mapProduttoreNome(name) || anagByName.get(normalizeNomeKey(name));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function buildLinks(
  created: Array<CataniaRisolto & { newId: string }>,
  anagByName: Map<string, string>,
  turcoAnagId: string,
) {
  const ccRows: Array<Record<string, unknown>> = [];
  const intRows: Array<Record<string, unknown>> = [];
  for (const r of created) {
    ccRows.push({
      cliente_id: r.newId,
      ruolo: "Backoffice",
      profilo_id: CATANIA_TURCO_PROFILE_ID,
      anagrafica_id: turcoAnagId,
      societa_brand: r.brand,
      filiale: CATANIA_FILIALE,
      contatto: "Turco Alida",
      data_acquisito: r.dataAcquisito,
      escludi_provvigioni: false,
    });
    const prodIds = resolveProdIds(r.produttori, anagByName);
    prodIds.forEach((aid, idx) => {
      intRows.push({
        cliente_id: r.newId,
        tipo: "produttore",
        anagrafica_commerciale_id: aid,
        percentuale: 0,
        ordine: idx,
        escludi_provvigioni: false,
      });
      ccRows.push({
        cliente_id: r.newId,
        ruolo: idx === 0 ? "Produttore Sede" : `corrispondente_${idx + 1}`,
        profilo_id: null,
        anagrafica_id: aid,
        societa_brand: r.brand,
        filiale: CATANIA_FILIALE,
        contatto: r.produttori[idx] || null,
        data_acquisito: r.dataAcquisito,
        escludi_provvigioni: false,
      });
    });
  }
  return { ccRows, intRows };
}

function emitSql(
  toCreate: Array<CataniaRisolto & { newId: string }>,
  ccRows: Array<Record<string, unknown>>,
  intRows: Array<Record<string, unknown>>,
  turcoAnagSql: string,
) {
  const dir = "/tmp/catania-sql";
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/00-turco.sql`, turcoAnagSql.endsWith("\n") ? turcoAnagSql : `${turcoAnagSql}\n`);

  const chunks: string[] = [];
  for (let i = 0; i < toCreate.length; i += 80) {
    const batch = toCreate.slice(i, i + 80);
    const values = batch
      .map((r) => {
        const row = toInsert(r);
        return `(${[
          `'${r.newId}'::uuid`,
          sqlStr(row.codice_ricerca),
          sqlStr(row.tipo_cliente),
          sqlStr(row.tipo_persona),
          `'${CATANIA_UFFICIO_ID}'::uuid`,
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
        ].join(", ")})`;
      })
      .join(",\n");
    chunks.push(`INSERT INTO public.clienti (
  id, codice_ricerca, tipo_cliente, tipo_persona, ufficio_id, attivo, stato_cliente,
  ragione_sociale, nome, cognome, codice_fiscale, partita_iva, codice_fiscale_azienda,
  forma_giuridica, email, pec, telefono, attenzione_di, gruppo_finanziario_id,
  gruppo_statistico, indotto, zona, attivita, spec_sx_danni, ha_incarico, incarico_da,
  indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza,
  indirizzo_sede, cap_sede, citta_sede, provincia_sede
) VALUES\n${values};`);
  }
  chunks.forEach((sql, idx) => writeFileSync(`${dir}/1-${String(idx + 1).padStart(3, "0")}-clienti.sql`, sql));

  const writeBatch = (
    rows: Array<Record<string, unknown>>,
    prefix: string,
    header: string,
    mapper: (r: Record<string, unknown>) => string,
    size: number,
  ) => {
    let n = 0;
    for (let i = 0; i < rows.length; i += size) {
      const batch = rows.slice(i, i + size);
      n += 1;
      writeFileSync(
        `${dir}/${prefix}-${String(n).padStart(3, "0")}.sql`,
        `${header}\n${batch.map(mapper).join(",\n")};`,
      );
    }
    return n;
  };

  const ccN = writeBatch(
    ccRows,
    "2-cc",
    `INSERT INTO public.codici_commerciali_cliente (
  cliente_id, ruolo, profilo_id, anagrafica_id, societa_brand, filiale, contatto, data_acquisito, escludi_provvigioni
) VALUES`,
    (r) =>
      `(${[
        `'${r.cliente_id}'::uuid`,
        sqlStr(String(r.ruolo)),
        r.profilo_id ? `'${r.profilo_id}'::uuid` : "NULL",
        r.anagrafica_id ? `'${r.anagrafica_id}'::uuid` : "NULL",
        sqlStr(r.societa_brand as string),
        sqlStr(r.filiale as string),
        sqlStr(r.contatto as string | null),
        sqlStr(r.data_acquisito as string | null),
        r.escludi_provvigioni ? "true" : "false",
      ].join(", ")})`,
    120,
  );

  const intN = writeBatch(
    intRows,
    "3-int",
    `INSERT INTO public.clienti_intermediari_default (
  cliente_id, tipo, anagrafica_commerciale_id, percentuale, ordine, escludi_provvigioni
) VALUES`,
    (r) =>
      `(${[
        `'${r.cliente_id}'::uuid`,
        sqlStr(String(r.tipo)),
        `'${r.anagrafica_commerciale_id}'::uuid`,
        Number(r.percentuale) || 0,
        Number(r.ordine) || 0,
        r.escludi_provvigioni ? "true" : "false",
      ].join(", ")})`,
    120,
  );

  return { dir, clientiChunks: chunks.length, ccChunks: ccN, intChunks: intN };
}

const TURCO_SQL = `INSERT INTO public.anagrafiche_professionali (
  tipo, ruoli, nome, cognome, ragione_sociale, email, ufficio_id, attivo
)
SELECT 'responsabile_sede', ARRAY['responsabile_sede']::text[], 'Alida', 'Turco', 'Turco Alida',
       '${CATANIA_TURCO_EMAIL}', '${CATANIA_UFFICIO_ID}'::uuid, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.anagrafiche_professionali
  WHERE attivo IS DISTINCT FROM false
    AND (
      lower(email) = lower('${CATANIA_TURCO_EMAIL}')
      OR (lower(coalesce(nome,'')) = 'alida' AND lower(coalesce(cognome,'')) = 'turco')
    )
);`;

async function main() {
  if (!existsSync(EXCEL)) throw new Error(`Excel non trovato: ${EXCEL}`);

  const rows = XLSX.utils.sheet_to_json<CataniaRiga>(
    XLSX.readFile(EXCEL, { cellDates: true }).Sheets.Sheet1,
    { defval: null, raw: false },
  );

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const canRemote = !!(url && key) && !process.env.CATANIA_LOCAL_CATALOGO;
  let catalogo: CatalogoCatania[] = [];
  let anagByName = new Map<string, string>(Object.entries(CATANIA_ANAG_ALIASES));
  let sb: ReturnType<typeof createClient> | null = null;

  if (canRemote && url && key) {
    sb = createClient(url, key, { auth: { persistSession: false } });
    try {
      const remote = await loadRemote(sb);
      catalogo = remote.catalogo;
      anagByName = remote.anagByName;
    } catch (err) {
      console.warn("catalogo remoto non disponibile, uso alias + file locale:", err instanceof Error ? err.message : err);
    }
  }
  const localCat = process.env.CATANIA_CATALOGO_JSON || "/tmp/cb_clienti_catania_db.json";
  if (existsSync(localCat)) {
    const extra = JSON.parse(readFileSync(localCat, "utf8")) as CatalogoCatania[];
    const seen = new Set(catalogo.map((c) => c.id));
    for (const row of extra) {
      if (!seen.has(row.id)) catalogo.push(row);
    }
  }

  const resolved = rows.map((r) => resolveCataniaCliente(r, catalogo));
  const { keepers, dups } = pickKeepersCatania(resolved);
  const toCreate = keepers.filter((r) => r.esito === "da_creare");
  const toLink = keepers.filter((r) => r.esito === "collegare");

  const report = {
    dry: DRY,
    file: EXCEL,
    totFile: rows.length,
    saltati: dups.length,
    collegare: toLink.length,
    daCreare: toCreate.length,
    tipi: toCreate.reduce(
      (acc, r) => {
        acc[r.tipoCliente] = (acc[r.tipoCliente] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    cfRicostruiti: toCreate.filter((r) => r.cfRicostruito).length,
    pivaPadded: toCreate.filter((r) => r.pivaPadded).length,
    emailSede: toCreate.filter((r) => r.email === CATANIA_SEDE_EMAIL).length,
    saltatiMotivi: dups.reduce(
      (acc, r) => {
        acc[r.motivo] = (acc[r.motivo] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    saltatiPiva: dups
      .filter((r) => r.motivo === "piva_gia_attiva_altra_sede")
      .map((r) => ({ codice: r.codice, nome: r.ragioneSociale || `${r.cognome} ${r.nome}`, piva: r.partitaIva })),
  };
  console.log(JSON.stringify(report, null, 2));
  writeFileSync("/tmp/catania-import-plan.json", JSON.stringify({ report, toCreate, dups, toLink }, null, 2));

  const turcoPlaceholder = "TURCO_ANAG_ID";
  const withIds = toCreate.map((r) => ({ ...r, newId: randomUUID() }));
  const { ccRows, intRows } = buildLinks(withIds, anagByName, turcoPlaceholder);
  const emitted = emitSql(withIds, ccRows, intRows, TURCO_SQL);
  writeFileSync(
    "/tmp/catania-create-ids.json",
    JSON.stringify(withIds.map((r) => ({ codice: r.codice, id: r.newId, tipo: r.tipoCliente }))),
  );
  console.log(JSON.stringify({ emit: emitted, dry: DRY }, null, 2));

  if (DRY || EMIT_SQL) {
    if (DRY && !EMIT_SQL) console.log("Dry-run: nessun write.");
    return;
  }

  if (!sb) throw new Error("Serve SUPABASE_URL + chiave per l'import reale");

  const turcoAnagId = await ensureTurcoAnagrafica(sb);
  const { ccRows: ccLive, intRows: intLive } = buildLinks(withIds, anagByName, turcoAnagId);

  let inserted = 0;
  let failed = 0;
  const failRows: Array<{ codice: string; err: string }> = [];
  const idByCodice = new Map<string, string>();

  for (let i = 0; i < toCreate.length; i += BATCH) {
    const batch = toCreate.slice(i, i + BATCH);
    const payload = batch.map((r) => {
      const planned = withIds.find((x) => x.codice === r.codice);
      return { id: planned?.newId, ...toInsert(r) };
    });
    const { data, error } = await sb.from("clienti").insert(payload).select("id, codice_ricerca");
    if (error) {
      for (const row of payload) {
        const { data: one, error: oneErr } = await sb
          .from("clienti")
          .insert(row)
          .select("id, codice_ricerca")
          .single();
        if (oneErr || !one) {
          failed++;
          failRows.push({ codice: String(row.codice_ricerca), err: oneErr?.message || "insert" });
        } else {
          inserted++;
          if (one.codice_ricerca) idByCodice.set(one.codice_ricerca, one.id);
        }
      }
    } else {
      inserted += (data || []).length;
      for (const row of data || []) {
        if (row.codice_ricerca) idByCodice.set(row.codice_ricerca, row.id);
      }
    }
    console.log(`insert ${Math.min(i + BATCH, toCreate.length)}/${toCreate.length} ok=${inserted} ko=${failed}`);
  }

  const remap = (rows: Array<Record<string, unknown>>) =>
    rows
      .map((row) => {
        const planned = withIds.find((x) => x.newId === row.cliente_id);
        const liveId = planned ? idByCodice.get(planned.codice) : null;
        if (!liveId) return null;
        return { ...row, cliente_id: liveId };
      })
      .filter((x): x is Record<string, unknown> => !!x);

  const ccOkRows = remap(ccLive);
  const intOkRows = remap(intLive);

  let ccOk = 0;
  let ccKo = 0;
  for (let i = 0; i < ccOkRows.length; i += BATCH) {
    const batch = ccOkRows.slice(i, i + BATCH);
    const { error } = await sb.from("codici_commerciali_cliente").insert(batch);
    if (error) {
      for (const row of batch) {
        const { error: oneErr } = await sb.from("codici_commerciali_cliente").insert(row);
        if (oneErr) ccKo++;
        else ccOk++;
      }
    } else {
      ccOk += batch.length;
    }
  }

  let intOk = 0;
  let intKo = 0;
  for (let i = 0; i < intOkRows.length; i += BATCH) {
    const batch = intOkRows.slice(i, i + BATCH);
    const { error } = await sb.from("clienti_intermediari_default").insert(batch);
    if (error) {
      for (const row of batch) {
        const { error: oneErr } = await sb.from("clienti_intermediari_default").insert(row);
        if (oneErr) intKo++;
        else intOk++;
      }
    } else {
      intOk += batch.length;
    }
  }

  const summary = {
    dry: false,
    turcoAnagId,
    inserted,
    failed,
    failRows,
    ccOk,
    ccKo,
    intOk,
    intKo,
    linkedSkipped: toLink.length,
  };
  writeFileSync("/tmp/catania-import-result.json", JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, failRows: failRows.slice(0, 20) }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
