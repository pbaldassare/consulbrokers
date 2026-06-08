
# Provisioning utenti Sede + RLS per ufficio

## 1. Provisioning utenti (Edge Function `provision-sedi-users`)

Edge function one-shot protetta da secret, che per ogni sede:
- Crea (o aggiorna se già esiste) l'utente in `auth.users` con password `Leone123!` e `email_confirm=true`.
- Upsert in `profiles`: `ruolo='ufficio'`, `ufficio_id` corrispondente, `attivo=true`, `permessi_json` con i permessi default di L3 (titoli, sinistri, trattative, calendario, contabilita, rimesse, ec_clienti, report, estrazioni, documentale, template, provvigioni).
- Upsert in `user_roles` con `role='ufficio'`.
- Log in `log_attivita`.

Mappa email→ufficio_id (definitiva):

| Email | ufficio_id | Nome sede |
|---|---|---|
| catania@consulbrokers.it | d2c47452-4bb2-4b3b-8a24-a1606357e909 | SEDE CATANIA |
| milano@consulbrokers.it | 193e0821-4105-4ad6-a72e-0ebb6c116797 | SEDE MILANO |
| sandona@consulbrokers.it | 327e92f7-64f0-48b9-9e48-73611d8cb406 | SAN DONA' |
| campobasso@consulbrokers.it | ebd881c6-cc52-4fbe-a423-2bf1f8498e5c | Campobasso |
| lurbani@consulbrokers.it | d2d73996-a161-4a04-be84-260f6c514c23 | Bergamo |
| segreteria@consulbrokers.it | f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a | Napoli (già esistente, solo allineamento profilo) |

In parallelo, una migration aggiorna `uffici.email`:
- Catania → `catania@consulbrokers.it`
- Milano → `milano@consulbrokers.it`
- San Donà → `sandona@consulbrokers.it`
- Campobasso → `campobasso@consulbrokers.it`
- Napoli → `segreteria@consulbrokers.it` (fix dominio mancante)
- Bergamo → invariata

## 2. RLS scoping per ufficio_id

Crea due funzioni `SECURITY DEFINER` in `public`:

```sql
-- ID dell'ufficio del chiamante
create or replace function public.current_ufficio_id() returns uuid
language sql stable security definer set search_path=public as $$
  select ufficio_id from public.profiles where id = auth.uid()
$$;

-- true se admin o cfo (vedono tutto)
create or replace function public.is_global_viewer() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin','cfo')
  )
$$;
```

Aggiunge/aggiorna policy su tabelle target. Per ognuna:
- **SELECT/INSERT/UPDATE/DELETE** consentiti se `is_global_viewer()` OR `ufficio_id = current_ufficio_id()`.
- Mantiene le policy già esistenti per ruoli `cliente`/`prospect`/`corrispondente` (read-only via funzioni dedicate `get_my_cliente_ids` ecc.).

Tabelle coinvolte e colonna scoping:
- `titoli.ufficio_id` (esistente)
- `clienti.ufficio_id` (esistente)
- `sinistri` → scoping via `titolo_id → titoli.ufficio_id` (sinistri non ha colonna diretta; uso `EXISTS` sulle policy)
- `movimenti_contabili.ufficio_id` (verificare; se assente, scoping via `titolo_id`)

Tabella `abbuoni`: esclusa per ora come richiesto.

## 3. Verifica

- Login con `catania@consulbrokers.it / Leone123!` → vede solo clienti/titoli/sinistri di Catania.
- Login admin esistente → vede tutto.
- Linter Supabase + scan sicurezza dopo migration.

## Dettagli tecnici

- Nessuna nuova tabella `sede_utenti`: il link è `profiles.ufficio_id → uffici.id`.
- Edge function richiede `SUPABASE_SERVICE_ROLE_KEY` (già configurato).
- Lo schema enum `app_role` contiene già `'ufficio'`, nessuna modifica.
- Le policy nuove sono additive e non rompono i flussi admin esistenti grazie a `is_global_viewer()`.
