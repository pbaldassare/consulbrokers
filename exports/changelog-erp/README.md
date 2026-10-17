# Export — Pubblicazioni Changelog (CBnet / ERP)

Modulo estratto da **Consulnet/CBnet** per riuso in altro gestionale (React + Supabase).

## Cosa fa

1. **Admin (root)** — pagina editor: bozza markdown in 3 sezioni → **Salva bozza** o **Pubblica** (`pubblicato_at`).
2. **Staff** — al login, popup **“Ultimi cambiamenti”** sull’ultimo changelog pubblicato **non ancora letto**.
3. **Chiusura popup** — upsert su `changelog_letture` (una volta per utente/changelog).

Anteprima admin senza registrare lettura: `?changelog=anteprima` nell’URL.

## Contenuto dello zip

```
sql/
  20261009110000_changelog.sql          — tabelle + RLS changelog
  is_root_admin_minimal.sql             — funzione richiesta dalla policy di scrittura
src/
  components/ChangelogPopup.tsx         — popup + ChangelogContenuto (markdown)
  pages/PubblicazioniChangelogPage.tsx  — editor / pubblicazione
  lib/adminAccountGuard.ts              — ROOT_ADMIN_EMAIL + isRootAdminEmail
  components/shared/PageContainer.tsx   — layout pagina (sostituibile)
  components/__tests__/ChangelogContenuto.test.tsx
INTEGRATION.md                          — hook in App / MainLayout / menu
```

## Dipendenze npm

```json
"react-markdown": "^10.1.0",
"remark-gfm": "^4.0.1",
"@tanstack/react-query": "^5",
"react-router-dom": "^6",
"date-fns": "^3",
"sonner": "^1",
"lucide-react": "^0.4"
```

UI: componenti shadcn (`Dialog`, `Button`, `Card`, `Textarea`, `Checkbox`, `AlertDialog`, `Label`).

## Database

1. Eseguire **`sql/is_root_admin_minimal.sql`** (se non avete già `public.is_root_admin`) — adattate l’email root.
2. Eseguire **`sql/20261009110000_changelog.sql`** — richiede:
   - `public.is_staff()` (staff interno vs portali cliente)
   - `public.has_role(uuid, app_role)` con ruolo `admin`
   - `auth.users` per FK `changelog_letture.user_id`

Se l’altro ERP non ha `is_staff`, sostituire la policy SELECT con la vostra regola (es. tutti gli `authenticated` tranne ruolo `cliente`).

## Integrazione frontend

Vedi **`INTEGRATION.md`**. In sintesi:

- Layout autenticato: `<ChangelogPopup />`
- Route: `/pubblicazioni-changelog` → `PubblicazioniChangelogPage`
- Menu: voce solo root admin (in CBnet: `rootOnly` + `isRootAdminEmail`)

Sostituire:

- `@/integrations/supabase/client` → vostro client Supabase
- `@/contexts/AuthContext` → `user` / `profile.email`
- `@/lib/utils` (`cn`) se non usate shadcn

## Tipi Supabase

Le query usano `from("changelog" as never)` finché i tipi generati non includono le tabelle. Dopo migration: `supabase gen types` e rimuovere i cast.

## Test

```bash
bun run test src/components/__tests__/ChangelogContenuto.test.tsx
```

## Licenza / provenienza

Codice da repository Consulbrokers / CBnet — adattare email root, testi UI e policy RLS al vostro dominio.
