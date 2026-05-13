# Fix sorgente tendine Rete Commerciale in NuovoClienteDialog

## Problema
Nel dialog "Nuovo Cliente" la tendina **Produttore** (e anche **AE**) usa la tabella `profiles` filtrando per ruoli `produttore_sede` / `account_executive`. È sbagliato: i Produttori e gli AE veri vivono in `anagrafiche_professionali` (es. **INTERFIDI SRL**, `tipo='corrispondente'`, `attivo=true`) e non hanno alcun profilo utente. Per questo "Interfidi" e altri produttori reali non compaiono nella lista.

Inoltre la tendina **Specialist** ora mostra anche admin/AE/produttori perché la query carica tutti e 4 i ruoli senza filtrare lato UI: va ristretta ai soli `backoffice`.

## Verifica DB
- `anagrafiche_professionali` con `tipo='corrispondente'` e `attivo=true` contiene `INTERFIDI SRL` (id `cbe0e599-…`) — non visibile oggi nel dialog.
- Esistono già gli hook canonici: `useProduttoriLookup` e `useAccountExecutivesLookup`.
- Memoria progetto: la persistenza canonica per AE/Produttore lato cliente è `codici_commerciali_cliente.anagrafica_id` (le colonne `profilo_id` per quei ruoli sono legacy).

## Modifiche (solo `src/components/clienti/NuovoClienteDialog.tsx`)

1. **Sorgente tendine**
   - Produttore → `useProduttoriLookup()` (anagrafiche_professionali, tipo='corrispondente', attivo=true).
   - Account Executive → `useAccountExecutivesLookup()` (tipo='account_executive', attivo=true).
   - Specialist → resta `profiles`, ma la query `profili_commerciali_lookup` viene filtrata a `ruolo='backoffice'` (oppure si filtra il `.map` per mostrare solo i backoffice nella tendina Specialist), così non compaiono admin/AE/produttori.

2. **State + persistenza**
   - Aggiungere accanto a `produttoreSede.profilo_id` un `produttoreSede.anagrafica_id` (e idem per `ae`). La tendina Produttore/AE scrive su `anagrafica_id`.
   - In `insertCommercialRoles`:
     - Riga "AE": `{ cliente_id, anagrafica_id: ae.anagrafica_id, ruolo: "AE" }` (omesso `profilo_id`).
     - Riga "Produttore Sede": `{ cliente_id, anagrafica_id: produttoreSede.anagrafica_id, ruolo: "Produttore Sede" }`.
     - Riga "Backoffice": invariata, continua con `profilo_id` (Specialist = utente con profilo).
   - Validazione `getMissingFields()` per Specialist resta su `profilo_id`.

3. **Reset / initialData**
   - Aggiornare i reset a fine submit per azzerare anche i nuovi `anagrafica_id`.

## Out of scope
- Nessuna modifica DB (la colonna `anagrafica_id` su `codici_commerciali_cliente` esiste già per memoria).
- Nessuna modifica ad altri form/pagina.
- Logica auto-compila Sede dallo Specialist invariata.

## Esito atteso
Aprendo "Nuovo Cliente" → sezione Produttore mostra l'elenco reale dei corrispondenti (incluso **INTERFIDI SRL**). AE elenca gli account executive da anagrafiche. Specialist elenca solo i backoffice.
