# Fix: Conti Bancari non visibili

## Causa
La pagina `ContiBancariPage.tsx` referenzia `compagnia_rapporti.codice_mandato`, ma la colonna in DB si chiama `codice_rapporto`. PostgREST risponde 400 → tabella vuota anche se i contatori (HEAD count) mostrano i numeri corretti.

## Modifiche (`src/pages/anagrafiche/ContiBancariPage.tsx`)

1. Riga 164 — query principale: nella select join `rapporto:compagnia_rapporti!...(id,codice_mandato,...)` → `codice_rapporto`.
2. Righe 213-217 — query `rapportiForCompagnia`: `select("id, codice_mandato, ...")` → `codice_rapporto`, e `.order("codice_mandato")` → `.order("codice_rapporto")`.
3. Riga 329 — `formatRapportoLabel`: `r.codice_mandato` → `r.codice_rapporto`.

Nessuna altra modifica (UI, RLS, schema invariato).
