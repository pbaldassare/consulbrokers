# AGENTS.md

Per il contesto completo del progetto (dominio assicurativo Consulnet/CBnet, stack, struttura cartelle, convenzioni) leggi [`CLAUDE.md`](./CLAUDE.md) e [`ANTIGRAVITY_AGENT.md`](./ANTIGRAVITY_AGENT.md). Il dominio è interamente in italiano: mantieni l'italiano per UI, nomi tabelle/colonne e messaggi utente.

## Cursor Cloud specific instructions

Servizio unico: **frontend SPA Vite + React + TypeScript** che parla con un backend **Supabase remoto/hosted** (Postgres + Auth + Storage + Edge Functions Deno). Non esiste un backend locale da avviare: le credenziali Supabase sono già committate in `.env` e puntano all'istanza hosted (`zbjmnnlojxprlogbnxef.supabase.co`), quindi l'app gira e autentica contro il cloud senza `supabase start`.

- **Package manager = bun** (`bun.lock` è la fonte di verità). Il `package-lock.json` presente è **obsoleto**: `npm ci` fallisce con "Missing ... from lock file". Usa sempre `bun install` / `bun run …` / `bunx …`, non npm. bun è installato in `~/.bun` e collegato in `/usr/local/bin` (già sul PATH). L'update script esegue `bun install`.
- **Dev server:** `bun run dev` → http://localhost:5175 (`VITE_DEV_PORT=5175`, `strictPort`). Non è la 8080. La rotta iniziale è `/login`.
- **Comandi** (definiti in `package.json`): `bun run lint` (ESLint), `bun run test` (Vitest single run), `bun run build` (build prod, ~15s), `bun run build:dev`, `bun run preview`, `bun run test:e2e` (Playwright).
- **Baseline lint/test (pre-esistente, non causato dalle tue modifiche):** `bun run lint` riporta molti errori (in gran parte nei file sotto `tests/`) e `bun run test` ha un paio di fallimenti pre-esistenti (`getDefaultRoute`, un file di test senza suite). Confronta con la baseline prima di attribuire un fallimento al tuo diff.
- **E2E:** richiede `bunx playwright install chromium` una tantum e le variabili `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` (vedi `tests/e2e/README.md`); alcuni test auth/RLS richiedono anche `SUPABASE_SERVICE_ROLE_KEY` nel `.env`.
- **Modello sinistri:** un sinistro si collega al `titolo`/`polizza` di un cliente **presente nel portafoglio CBnet** (`compagnia_id` e `ufficio_id` vengono derivati dalla polizza selezionata, non impostati a mano). Per pratiche senza polizza CBnet esiste il flag **"Sinistro Terzi"** (`sinistro_terzi=true`) che non collega né polizza né compagnia. Non esiste una edge function di import massivo per i sinistri (a differenza di clienti/compagnie/portafoglio/rinnovi).
