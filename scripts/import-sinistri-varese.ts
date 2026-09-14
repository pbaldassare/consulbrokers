/**
 * Import dei sinistri "Aperti in corso" del Comune di Varese come Sinistri Terzi CBnet.
 *
 * Ogni riga dell'Excel diventa un sinistro terzi (sinistro_terzi = true) collegato
 * all'anagrafica del Comune di Varese, con una `polizza_terzi` (polizza NON del
 * portafoglio CBnet, broker Marsh). Vedi src/lib/sinistriTerziMapping.ts per la mappatura.
 *
 * Prerequisiti:
 *   - Migrazione 20260914153000_sinistri_polizze_terzi.sql applicata in produzione
 *     e edge function gestione-sinistri ri-deployata (avviene al merge/deploy Lovable+Supabase).
 *   - Id anagrafica del Comune di Varese (dalla scheda cliente nell'app, /archivi/clienti/<id>).
 *
 * Uso (bun):
 *   # Anteprima senza scrivere nulla (default):
 *   bun run scripts/import-sinistri-varese.ts "<path.xlsx>" --cliente-id <uuid>
 *
 *   # Esecuzione reale (scrive su Supabase tramite edge function):
 *   bun run scripts/import-sinistri-varese.ts "<path.xlsx>" --cliente-id <uuid> --execute
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import dotenv from "dotenv";
import {
  buildSinistroTerziPayload,
  type VareseSinistroRow,
} from "../src/lib/sinistriTerziMapping";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string) => args.includes(name);

const EXCEL_PATH = args.find((a) => !a.startsWith("--") && /\.xlsx?$/i.test(a));
const CLIENTE_ID = flag("--cliente-id") || process.env.COMUNE_VARESE_CLIENTE_ID;
const EXECUTE = has("--execute");
const LIMIT = Number(flag("--limit") || "0"); // 0 = tutte

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

function fail(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (!EXCEL_PATH || !fs.existsSync(EXCEL_PATH)) {
  fail(`File Excel non trovato. Passa il path .xlsx come primo argomento.`);
}
if (!CLIENTE_ID) {
  fail(
    `Manca l'id anagrafica del Comune di Varese.\n` +
      `   Passa --cliente-id <uuid> oppure imposta COMUNE_VARESE_CLIENTE_ID.\n` +
      `   Lo trovi aprendo la scheda cliente nell'app: /archivi/clienti/<id>.`,
  );
}
if (!SUPABASE_URL || !ANON_KEY) {
  fail(`Config Supabase mancante (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY nel .env).`);
}

/** Legge l'Excel Varese: intestazione a riga 3 (indice 2), 7 colonne. */
function readRows(file: string): VareseSinistroRow[] {
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "", raw: false });
  const dataRows = matrix.slice(3).filter((r) => String(r?.[0] ?? "").trim() !== "");
  return dataRows.map((r) => ({
    nSinistroMarsh: String(r[0] ?? "").trim(),
    dataSinistro: String(r[1] ?? "").trim(),
    reclamanteAssicurato: String(r[2] ?? "").trim(),
    nSinistroCompagnia: String(r[3] ?? "").trim(),
    nPolizza: String(r[4] ?? "").trim(),
    garanziaPrincipale: String(r[5] ?? "").trim(),
    compagniaDelegataria: String(r[6] ?? "").trim(),
  }));
}

async function creaSinistro(payload: unknown): Promise<{ ok: boolean; error?: string; numero?: string }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gestione-sinistri`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY!,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    return { ok: false, error: json?.error || `HTTP ${res.status}` };
  }
  return { ok: true, numero: json.sinistro?.numero_sinistro };
}

async function main() {
  const rows = readRows(EXCEL_PATH!);
  const selected = LIMIT > 0 ? rows.slice(0, LIMIT) : rows;
  console.log(`\n📄 Righe lette: ${rows.length}${LIMIT ? ` (limitate a ${selected.length})` : ""}`);
  console.log(`🏛️  Comune di Varese cliente_anagrafica_id: ${CLIENTE_ID}`);
  console.log(`🔗 Endpoint: ${SUPABASE_URL}/functions/v1/gestione-sinistri`);
  console.log(EXECUTE ? "⚙️  Modalità: ESECUZIONE (scrive su Supabase)" : "🔎 Modalità: DRY-RUN (nessuna scrittura)\n");

  const report: Array<Record<string, unknown>> = [];
  let ok = 0;
  let ko = 0;

  for (let i = 0; i < selected.length; i++) {
    const row = selected[i];
    const payload = buildSinistroTerziPayload(row, { comuneVareseClienteId: CLIENTE_ID! });

    if (!EXECUTE) {
      if (i < 3) console.log(`  [${i + 1}] ${JSON.stringify(payload)}`);
      report.push({ riga: i + 1, marsh: row.nSinistroMarsh, payload });
      continue;
    }

    const r = await creaSinistro(payload);
    if (r.ok) {
      ok++;
      console.log(`  ✅ [${i + 1}/${selected.length}] ${row.nSinistroMarsh} → ${r.numero}`);
    } else {
      ko++;
      console.error(`  ❌ [${i + 1}/${selected.length}] ${row.nSinistroMarsh} → ${r.error}`);
    }
    report.push({ riga: i + 1, marsh: row.nSinistroMarsh, ok: r.ok, numero: r.numero, error: r.error });
    // piccola pausa per non saturare la edge function
    await new Promise((res) => setTimeout(res, 120));
  }

  const outDir = path.resolve(process.cwd(), "scripts", "output");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `import-sinistri-varese-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ ok, ko, dryRun: !EXECUTE, report }, null, 2));

  console.log(`\n📊 Fatto. OK=${ok} KO=${ko}${EXECUTE ? "" : " (dry-run)"}. Report: ${outFile}\n`);
  if (!EXECUTE) {
    console.log("ℹ️  Per eseguire davvero aggiungi --execute (richiede migrazione + edge function deployate).\n");
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
