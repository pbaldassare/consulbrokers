# CLAUDE.md

Guida operativa per agenti AI (Claude Code) che lavorano su questo repository.
Tutto il dominio applicativo è in **italiano**: mantieni la lingua italiana per UI,
nomi di colonne/tabelle e messaggi utente.

> Esiste già un documento di contesto più ampio e prescrittivo in
> [`ANTIGRAVITY_AGENT.md`](./ANTIGRAVITY_AGENT.md): contiene vincoli storici,
> invarianti di dominio e una roadmap di feature. **Leggilo prima di toccare
> contabilità, provvigioni, titoli o sinistri.** Questo CLAUDE.md è il riepilogo
> tecnico di partenza.

---

## 1. Descrizione del progetto

**Consulnet / CBnet** — Gestionale assicurativo (insurance brokerage platform) per
il mercato italiano (Consulbrokers). È una SPA React che copre l'intero ciclo di un
broker assicurativo:

- **Anagrafiche**: clienti, prospect, compagnie/agenzie, produttori, fornitori, sedi/uffici.
- **Portafoglio polizze (`titoli`)**: emissione, rinnovi, appendici, movimenti, RCA, garanzie. La tabella `titoli` ha ~115 colonne.
- **Sinistri**: apertura (wizard), gestione eventi, checklist, scadenze, prescrizioni, report SIR.
- **Contabilità**: prima nota, incassi, rimesse alle agenzie, estratti conto, chiusure, registri IVA, riparti bancari, incroci bancari.
- **Provvigioni**: matrici, maturazione, generazione, pagamenti, distinte PDF.
- **Trattative & Prospect / Bandi pubblici**: pipeline commerciale e gare.
- **Documentale**: archivio documenti, template email/PDF, comunicazioni, privacy/consensi.
- **AI**: assistant conversazionale, parsing PDF polizze/banche/provvigioni, analisi CFO, ricerca bandi (Supabase Edge Functions).

Origine **Lovable** (Lovable Project ID `a3b1457e-dbbe-41da-866b-8411e8cba913`). Le modifiche pushate su GitHub si riflettono in Lovable e viceversa.

- Supabase Ref: `zbjmnnlojxprlogbnxef`
- URL produzione: https://cbnet.it · https://consulnet.iaconnect.it

---

## 2. Stack tecnologico

| Area | Tecnologia |
|---|---|
| Build / dev | **Vite 5** + `@vitejs/plugin-react-swc`, `lovable-tagger` |
| Linguaggio | **TypeScript 5.8** (`strict` parziale — vedi tsconfig) |
| UI | **React 18.3**, **shadcn/ui** (Radix UI), **Tailwind CSS 3.4**, `tailwindcss-animate`, `next-themes` |
| Routing | **react-router-dom 6** (route splittate in `src/routes/*`) |
| Data fetching | **TanStack Query v5** (`@tanstack/react-query`) |
| Form / validazione | **react-hook-form** + **zod** + `@hookform/resolvers` |
| Backend / DB / Auth | **Supabase** (`@supabase/supabase-js` 2.x) — Postgres + Auth + Storage + Edge Functions (Deno) |
| Email | **Resend** (via edge functions) |
| PDF | `pdf-lib`, `pdfjs-dist` (worker in `public/pdfjs`) |
| Excel | `xlsx` (SheetJS) |
| Grafici | `recharts` |
| Mappe | Google Maps (`@types/google.maps`) |
| Notifiche UI | `sonner` |
| Icone | `lucide-react` |
| Test | **Vitest** + Testing Library + jsdom (unit), **Playwright** (e2e) |
| Package manager | **bun** (`bun.lock` / `bun.lockb`) — è presente anche `package-lock.json` (npm) |

---

## 3. Comandi principali

```sh
bun install            # (o npm i) installa dipendenze
bun run dev            # dev server Vite su http://localhost:8080
bun run build          # build di produzione
bun run build:dev      # build in modalità development
bun run lint           # ESLint
bun run test           # Vitest (run singolo)
bun run test:watch     # Vitest watch
bun run test:e2e       # Playwright e2e
bun run preview        # anteprima build
```

Il dev server è configurato su **porta 8080**, host `::` (vedi `vite.config.ts`),
con header `Cache-Control: no-store` (per il meccanismo di auto-update bundle).

Supabase: le **migrazioni** sono in `supabase/migrations/` (323 file, naming
`<timestamp>_<uuid>.sql`); le **edge functions** in `supabase/functions/`. La
config `verify_jwt` per funzione è in `supabase/config.toml`.

---

## 4. Struttura delle cartelle

```
src/
├── App.tsx                  # Root: providers (QueryClient, Auth, Tooltip), router, guards
├── main.tsx                 # Entry point
├── pages/                   # ~70 pagine (1 file = 1 schermata). Sottocartelle: cliente/, prospect/, contabilita/, anagrafiche/, estrazioni/
├── routes/                  # Definizioni route raggruppate per area:
│   ├── archivi.tsx          #   anagrafiche, compagnie, tabelle base
│   ├── portafoglio.tsx      #   polizze, titoli, documentale
│   ├── sinistri.tsx
│   ├── contabilita.tsx
│   ├── sistema.tsx          #   impostazioni, utenti, manutenzione
│   ├── cliente.tsx          #   portale cliente (fuori da MainLayout)
│   └── prospect.tsx         #   portale prospect
├── components/
│   ├── ui/                  # shadcn/ui primitives (NON modificare a mano se possibile)
│   ├── shared/ common/      # componenti riusabili (SearchableSelect, ecc.)
│   ├── titolo/ polizze/ rca/        # form polizze (pesante, sezionato)
│   ├── clienti/ cliente/ anagrafiche/
│   ├── contabilita/ provvigioni/ portafoglio/
│   ├── trattative/ compagnie/ estrazioni/
│   ├── documentale/ template/ chat/ ai/
│   ├── calendario/ utenti/ impostazioni/ tour/
│   ├── AuthGuard.tsx AppVersionGuard.tsx AppErrorBoundary.tsx MainLayout.tsx
│   └── **/__tests__/        # test co-locati
├── contexts/AuthContext.tsx # stato auth + profilo + permessi
├── hooks/                   # useServerPagination, useLookupTables, useDashboardData, ...
├── lib/                     # logica di dominio pura + util (PDF, validatori CF/IBAN/PIVA, provvigioni, frazionamento, ...)
│   ├── ai/                  # client/util AI lato frontend
│   └── __tests__/
├── integrations/supabase/
│   ├── client.ts            # istanza supabase (generato — non editare a mano)
│   └── types.ts             # tipi Database GENERATI dallo schema (non editare a mano)
└── test/                    # setup test + esempi

supabase/
├── migrations/              # 323 migrazioni SQL (schema + RLS + funzioni)
├── functions/              # 37 Edge Functions Deno (AI, provisioning, import, PDF, contabilità)
└── config.toml             # verify_jwt per funzione

public/pdfjs/               # worker + standard_fonts per pdfjs-dist
```

---

## 5. Tabelle Supabase

Ricavate da `src/integrations/supabase/types.ts` (tipi generati). Sono ~130 tabelle,
tutte con **RLS abilitata**. Raggruppate per dominio:

**Anagrafiche / clienti**
`clienti`, `clienti_relazioni`, `clienti_merge_log`, `nominativi_cliente`,
`codici_commerciali_cliente`, `anagrafiche_professionali`, `prospect`,
`fornitori`, `profiles`, `user_roles`, `ruoli_template`, `documenti_utenti`.

**Compagnie / agenzie / prodotti**
`compagnie`, `gruppi_compagnia`, `gruppi_finanziari`, `gruppi_statistici`,
`compagnia_rapporti`, `compagnia_rapporto_rami`, `compagnia_rapporto_documenti`,
`prodotti`, `categorie_prodotto`, `rami`, `gruppi_ramo`, `filiali` *(deprecata)*,
`tipi_mandatario`, `tipi_rinnovo` *(legacy)*.

**Polizze (titoli) & RCA**
`titoli`, `titoli_eventi_snapshot`, `titoli_numeri_storici`, `titoli_regolazioni`,
`titoli_sostituzioni`, `titoli_split_commerciali`, `titoli_storni`,
`titoli_garanzia_legacy_backup`, `appendici_polizza`, `movimenti_polizza`,
`premi_garanzia_polizza`, `conducenti_polizza`, `veicoli_polizza`, `veicoli_marche`,
`veicoli_modelli`, `rca_garanzie`, `rca_usi`, `aliquote_provinciali_rca`,
`scadenziario`.

**Sinistri**
`sinistri`, `sinistro_eventi`, `sinistro_checklist`.

**Contabilità / banche / IVA**
`movimenti_contabili`, `primanota_generale`, `causali_contabili`,
`piano_conti_conti`, `piano_conti_gruppi`, `sezioni_bilancio`, `chiusure_contabili`,
`conti_bancari`, `banca_documenti`, `incroci_bancari`, `distinte_giornaliere`,
`distinte_giornaliere_righe`, `dettaglio_riparto`, `estratti_conto`,
`iva_registri`, `certificazioni_cu`, `elab_annuali`, `elaborazioni_periodiche`.

**Rimesse / portafoglio incassi**
`rimessa_premi`, `rimessa_dettaglio`, `note_restituzione`, `note_restituzione_dettaglio`,
`portafoglio_incassi`, `portafoglio_incassi_eventi`, `spedizioni_cartacee`.

**Provvigioni**
`matrice_provvigioni`, `provvigioni_compagnia_ramo`, `provvigioni_default_tipo`,
`provvigioni_generate`, `produttori_provvigioni_ramo`, `pagamenti_provvigioni`,
`pagamenti_provvigioni_righe`.

**Trattative / bandi**
`trattative`, `trattativa_eventi`, `trattativa_scadenze`, `trattativa_documenti`,
`bandi_pubblici`, `bandi_trattative`, `ricerche_bandi`, `storico_gare`.

**Documentale / template / comunicazione**
`document_library`, `document_folders`, `documenti`, `template_email`,
`template_categorie`, `email_branding`, `notifiche`, `privacy_consensi`,
`privacy_informative`, `richieste_modifica_cliente`, `report_salvati`.

**Chat**
`chat_canali`, `chat_canali_membri`, `chat_messaggi`, `chat_messaggi_interni`,
`chat_conferme_lettura`.

**AI**
`ai_chat_conversazioni`, `ai_chat_messaggi`, `ai_user_memory`, `ai_allowed_enums`.

**Sistema / lookup / audit**
`uffici`, `profilo_sedi`, `impostazioni_sistema`, `impostazioni_ufficio`,
`audit_config`, `log_attivita`, `log_attivita_archivio`, `anomalie_sistema`,
`performance_log`, `upload_rate_limit`, `tipi_rinnovo`,
`lookup_attivita`, `lookup_conti_incasso`, `lookup_contratti`,
`lookup_fasce_dipendenti`, `lookup_fasce_fatturato`, `lookup_indotti`,
`lookup_risk_type`, `lookup_settori`, `lookup_tipo_documento`, `lookup_zone`.

**Backup / snapshot** (NON usare in nuovo codice)
`_backup_compagnie_cleanup_20260516`, `_backup_compagnie_reset_20260516`,
`compagnie_snapshot_post_dedup`, `flussi_compagnia`.

> Per lo schema dei campi consulta `src/integrations/supabase/types.ts` (autogenerato).
> **Non** modificare quel file a mano: è rigenerato dallo schema Supabase.

---

## 6. Ruoli utente e autenticazione

Auth gestita da **Supabase Auth** (email/password, `persistSession` in `localStorage`).
Il flusso è in `src/contexts/AuthContext.tsx`:

1. `onAuthStateChange` + `getSession()` recuperano la sessione.
2. Su login, viene caricato il **profilo** dalla tabella `profiles`
   (`id, nome, cognome, email, ruolo, ufficio_id, permessi_json, attivo, ...`).
3. Profilo "zombie" (utente loggato senza riga in `profiles`) → `signOut` forzato (`AuthGuard`).

**Modello permessi** (`src/contexts/AuthContext.tsx`):
- `hasPermission(key)` → `true` se `profile.ruolo === "admin"`, altrimenti legge `profile.permessi_json[key]`.
- `isAdmin` → `profile.ruolo === "admin"`.

**Livelli e ruoli** (`src/lib/userLevels.ts`):

| Livello | Label | `profiles.ruolo` | Visibilità default |
|---|---|---|---|
| L1 | Admin | `admin` | tutte le sedi |
| L2 | CFO | `cfo` | tutte le sedi |
| L3 | Sede / Specialist | `ufficio`, `backoffice`, `contabilita` | propria sede |
| L4 | Manager | `manager` | propri produttori |
| L5 | Produttore / Corrispondente | `produttore`, `corrispondente` | solo se stesso |
| L6 | Cliente / Prospect | `cliente`, `prospect` | portale read-only |

Chiavi permesso (`permessi_json`): `titoli, sinistri, trattative, calendario,
contabilita, rimesse, ec_clienti, chiusure, report, estrazioni, anagrafiche,
tabelle_base, agenzie, uffici, manutenzione, documentale, template, provvigioni,
riceve_provvigioni, pagamenti_provvigioni` (vedi `PERMISSION_GROUPS`).

**Guardie di routing**:
- `AuthGuard` (`components/AuthGuard.tsx`): blocca non autenticati; reindirizza
  `cliente` → `/cliente`, `prospect` → `/prospect`; su `/` applica `getDefaultRoute`.
- `getDefaultRoute` (`lib/getDefaultRoute.ts`): landing route per ruolo/permessi.
- `AppVersionGuard`: confronta il bundle col `version.json` remoto e forza il
  reload se obsoleto (polling 30s).

**Provisioning utenti** (Edge Functions): `provision-user`, `provision-clienti-users`,
`provision-corrispondenti-users`, `provision-sedi-users`, `create-user`,
`create-cliente-user`, `create-prospect-user`, `bootstrap-admin`,
`reset-demo-password`. La password di default per gli utenti auto-provisionati è
**hardcoded** `Leone123!` (vedi §Bug — area critica).

> ⚠️ **Doppia fonte di verità sui ruoli.** Lo schema/RLS usa la tabella `user_roles`
> + una funzione `has_role()` (SECURITY DEFINER), mentre il frontend
> (`AuthContext`, `getDefaultRoute`, `hasPermission`) si basa su `profiles.ruolo` e
> `profiles.permessi_json`. Quando crei/aggiorni un utente devi scrivere su
> **entrambi** (`profiles` e `user_roles`), altrimenti UI e RLS divergono.

---

## 7. Variabili d'ambiente

Lette in `src/integrations/supabase/client.ts` e in `vite.config.ts`. Solo le
variabili con prefisso `VITE_` sono esposte al frontend.

| Variabile | Uso |
|---|---|
| `VITE_SUPABASE_URL` | URL progetto Supabase (fallback `SUPABASE_URL`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon/publishable key (fallback `SUPABASE_PUBLISHABLE_KEY`) |
| `VITE_SUPABASE_PROJECT_ID` | id progetto Supabase |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps (geocoding/mappe) |
| `VITE_APP_ENV` | ambiente logico (`DEV`/...) |

**Secrets lato Edge Functions** (NON nel client, configurati come Supabase secrets):
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (+ eventuali `RESEND_FROM_EMAIL`/dominio),
chiavi provider AI. Verifica i `Deno.env.get(...)` nelle funzioni.

> ⚠️ Il file `.env` con chiavi reali è **committato nel repo** (vedi §Bug).

---

## 8. Aree critiche — leggere prima di modificare

Sintesi dagli invarianti in `ANTIGRAVITY_AGENT.md` (consultalo per i dettagli):

- **`titoli` (~115 colonne)**: non droppare/rinominare colonne. `prodotto_id` è
  deprecato → usa `prodotto_nome` (text). `tipo_rinnovo` è legacy → la UI usa il
  boolean `tacito_rinnovo`. La colonna `titoli.gruppo_ramo` è stata rimossa → usa
  `gruppi_ramo` via FK.
- **File generati**: `src/integrations/supabase/types.ts` e `client.ts` non si
  editano a mano.
- **RLS sempre attiva**: ogni query rispetta le policy. Usa `has_role()` nelle
  policy, non bypassarla. Allinea `profiles.ruolo` e `user_roles`.
- **Edge Functions**: la maggior parte ha `verify_jwt = false` (25/26 blocchi in
  `config.toml`) — è una scelta documentata, ma molte funzioni sono interne e
  dovrebbero validare il chiamante. Non cambiare senza istruzione esplicita, ma
  considera l'impatto di sicurezza.
- **Paginazione**: liste paginate via `useServerPagination` (max **25 righe**,
  debounce **350ms**). Non aumentare i limiti.
- **Liste lunghe**: usa il pattern `SearchableSelect` (Popover + Command) per liste
  > 10 elementi, mai `<select>` nativo.
- **Dati che NON vanno toccati**: polizze duplicate `204366651`, `6131402092`,
  `RCM00010074404` sono intenzionali (riconciliazione contabile Apr 2026); pagine
  rimosse (Cont. Generale, FatturaPA, Fornitori, Banca Import) non vanno
  reintrodotte; `filiali` è deprecata.
- **Contabilità / provvigioni / rimesse**: logica fiscale e di riparto sensibile
  (`lib/frazionamento.ts`, `lib/resolveProvvigione.ts`, validatori CF/IBAN/PIVA,
  `assertFiscalValid.ts`). Modifiche richiedono test mirati.
- **Versioning bundle**: `AppVersionGuard` + `lib/versionCheck.ts` gestiscono
  reload/cache; attenzione a loop di reload se cambi quel meccanismo.

---

## 9. Convenzioni

- Tutto il dominio (campi, UI, messaggi) è **in italiano**.
- Componenti UI di base in `components/ui/` provengono da shadcn — preferisci
  comporre piuttosto che modificarli.
- Logica di dominio pura va in `src/lib/` (testabile); i componenti restano sottili.
- Test co-locati in `__tests__/`; usa Vitest per unit, Playwright per e2e.
- Git: sviluppa su branch dedicato, commit descrittivi; i push si riflettono su Lovable.
