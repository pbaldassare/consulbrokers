# Import Consulbrokers → cbnet (Supabase)

| Ruolo | Progetto | Ref | Region |
|--------|-----------|-----|--------|
| **Sorgente (vecchio)** | Consulbrokers | `zbjmnnlojxprlogbnxef` | eu-west-1 |
| **Destinazione (nuovo)** | cbnet | `ehvmsdvjqvjulcrmzwzm` | eu-west-2 |

## File

`import-anagrafiche-cbnet-su-db-destinazione.sql` — eseguire nel **SQL Editor del progetto cbnet**.

Sostituire `<<<PASSWORD_CONSULBROKERS>>>` con la **Database password** del progetto **Consulbrokers** (Settings → Database).

## Cosa fa lo script

- `postgres_fdw` da cbnet verso Consulbrokers
- Copia solo colonne presenti su **entrambi** i DB e **non GENERATED** sul cbnet (`auth.users.confirmed_at`, `auth.identities.email`, ecc.)
- Allinea `uffici` / gruppi per **codice** se sul cbnet esistono già seed con UUID diversi
- Remap `ufficio_id`, `gruppo_compagnia_id`, `gruppo_finanziario_id` nelle FK

## Schema (diff note MCP)

- `public.uffici`: sul cbnet manca `email_ufficio_sinistri` (presente su Consulbrokers) — import ok senza quella colonna; per parità applicare le migrazioni mancanti sul cbnet.
- `clienti`, `compagnie`, `profiles`: stesso numero colonne (89 / 52 / 32).

## Piano B — pg_dump

Dal terminale, URI **Consulbrokers**:

```bash
pg_dump "$CONSULBROKERS_URI" --data-only --no-owner --column-inserts \
  -t public.uffici -t public.gruppi_compagnia -t public.gruppi_finanziari \
  -t public.compagnie -t public.compagnia_rapporti -t public.compagnia_rapporto_rami \
  -t public.anagrafiche_professionali -t public.produttori_provvigioni_ramo \
  -t public.clienti -t public.nominativi_cliente -t public.codici_commerciali_cliente \
  -t public.clienti_intermediari_default -t public.controparti_sinistri \
  -t auth.users -t auth.identities \
  -t public.profiles -t public.user_roles -t public.profilo_sedi \
  -f consulbrokers-anagrafiche.sql
```

Poi sul cbnet: escludere manualmente colonne generated da `auth.users` / `auth.identities` se pg_dump le include.
