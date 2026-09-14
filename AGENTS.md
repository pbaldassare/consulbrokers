# AGENTS.md

Progetto **CBnet** (Consul Brokers): Vite + React + TypeScript, backend su **Supabase hosted**.
Per l'overview generale (stack, comandi, struttura cartelle) vedi `CLAUDE.md`.

## Cursor Cloud specific instructions

### Come si esegue in locale
- Package manager canonico: **bun** (`bun.lock` è la fonte di verità); `npm` funziona ma il lockfile può essere stale.
- Dev server: `npm run dev` / `bun run dev` → Vite su **porta 5175** (`--strictPort`).
- Test: `npx vitest run` (unit). Lint: `npx eslint .`. Build: `npx vite build` (usa esbuild, **non** fa typecheck).
- `tsc --noEmit` NON è un gate: il repo ha ~290 errori di tipo pre-esistenti (soprattutto `TitoloDetail.tsx`); usa il conteggio per-file come baseline, non il totale.
- Test suite baseline: 2 fallimenti pre-esistenti (`getDefaultRoute`, suite vuota `getProvvigioneEC`). Non sono regressioni.

### Supabase (backend remoto — nessun Supabase locale)
- Il backend è **hosted** (`zbjmnnlojxprlogbnxef`); le credenziali Vite sono in `.env`. Non serve avviare Supabase in locale per il frontend.
- Deploy backend con `SUPABASE_ACCESS_TOKEN` (+ `SUPABASE_PROJECT_REF`):
  - Edge function: `npx supabase functions deploy <nome> --project-ref $SUPABASE_PROJECT_REF` (bundling via API, **Docker non necessario**).
  - SQL/migrazioni ad hoc: Management API `POST /v1/projects/<ref>/database/query`.
- `gestione-sinistri` gira con `verify_jwt = false` (vedi `supabase/config.toml`) e internamente usa il `service_role`: chiamate non autenticate possono eseguire operazioni privilegiate (usato dagli script di import).
- Dopo modifiche allo schema deployato, rigenera i tipi: `npx supabase gen types typescript --project-id $SUPABASE_PROJECT_REF > src/integrations/supabase/types.ts` (la rigenerazione è additiva rispetto ai tipi curati).

### Deploy del frontend (Lovable)
- Il frontend è **pubblicato da Lovable**, non da CI nel repo. Il push su Git **sincronizza l'editor Lovable** ma la produzione va pubblicata a mano da Lovable: **Share → Publish**.
- Quindi un cambiamento UI diventa live solo dopo: merge della PR su `main` + Publish su Lovable. Le modifiche solo-dati (DB) e le edge function, invece, sono live appena deployate via Supabase.

### Sinistri Terzi (polizze non-CBnet)
- I "Sinistri Terzi" sono pratiche su polizze **fuori dal portafoglio CBnet** (es. Comune di Varese, broker Marsh). I dati polizza esterni stanno in `public.polizze_terzi` (isolata da `titoli`, quindi esclusa dalle viste `v_portafoglio_*`), collegata via `sinistri.polizza_terzi_id`; CHECK: `polizza_terzi_id` valorizzato solo se `sinistro_terzi = true`.
- Fonte unica per mostrare/filtrare polizza, garanzia e compagnia in modo uniforme (CBnet o terzi): **`src/lib/sinistroView.ts`** (`resolvePolizzaNumero`, `resolveGaranzia`, `resolveCompagnia`, `isPolizzaTerzi`). Usarli in liste, filtri, ricerca ed export invece di leggere direttamente `titoli`/`compagnie`.
- `sinistri.ramo_sinistro` è **testo libero** (nessun enum/CHECK). Per i terzi viene valorizzato con la garanzia della polizza (`polizze_terzi.garanzia_principale`) così la colonna/il filtro "Garanzia" funzionano anche sul codice che legge solo `ramo_sinistro`. `resolveGaranzia` preferisce comunque `ramo_sinistro`, quindi il backfill è coerente col codice.
- Import Excel Varese: `scripts/import-sinistri-varese.ts` (via edge function; `--dry-run` di default, `--execute`, `--limit`, `--offset`). Mappatura pura e testata in `src/lib/sinistriTerziMapping.ts`.
