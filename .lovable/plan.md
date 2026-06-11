## Problema

Le 5 polizze nuove caricate per "Comune di Varese" (DEMO-VA-2026-010..014: All Risks, Tutela Legale, Cyber, RCT/O, RC Natanti) NON appaiono nel portale cliente perché sono state salvate sul campo sbagliato.

**Dettaglio tecnico**
- La pagina `/cliente/polizze` filtra `titoli` su `cliente_anagrafica_id IN (get_my_cliente_ids())`.
- Le 6 polizze visibili (DEMO-VA-2025-*) hanno correttamente `cliente_anagrafica_id = 94dc5a3c...` (cliente Comune di Varese).
- Le 5 polizze nuove (DEMO-VA-2026-*) hanno invece `cliente_anagrafica_id = NULL` e `cliente_id = 746c540d...` che è il **profile_id dell'utente**, non un id cliente valido. Bug nell'edge function `seed-comune-varese-polizze`.

## Fix

1. **Migrazione dati**: UPDATE su `titoli` dove `numero_titolo LIKE 'DEMO-VA-2026-%'` per settare `cliente_anagrafica_id = '94dc5a3c-1682-4aea-a9e2-190bf8bf34b1'` e `cliente_id = NULL`.

2. **Fix edge function** `supabase/functions/seed-comune-varese-polizze/index.ts`: sostituire `cliente_id: CLIENTE_ID` con `cliente_anagrafica_id: CLIENTE_ID` nell'INSERT, così future esecuzioni del seed funzionano correttamente.

## Risultato atteso

Il portale `/cliente/polizze` per Comune di Varese mostrerà 11 polizze (6 vecchie 2025 + 5 nuove 2026 con i PDF allegati).
