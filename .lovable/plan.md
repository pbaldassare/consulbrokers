
# Fase 3 — Ritiro del legacy e UI nativa sul modello Polizza/Quietanza

Obiettivo finale: rimuovere `titoli` e i trigger di sync, far vivere la UI direttamente su `polizze` + `quietanze`. È un lavoro a **rischio alto** sulla contabilità reale: va spezzato in 4 milestone, ciascuna rilasciabile e reversibile.

## Milestone A — Dettaglio nativo Polizza/Quietanza (no rimozioni)

- Nuovo `PolizzaDetail.tsx` (sostituisce il redirect): legge da `polizze`, mostra anagrafica contratto + tab "Quietanze" con tutte le rate ordinate per `numero_rata`.
- Nuovo `QuietanzaDetail.tsx` (sostituisce il redirect): vista rata singola con Messa a Cassa / Incasso / Provvigioni / Rimessa.
- Riuso massimo dei componenti esistenti (`PolizzaSection`, `MessaCassaDialog`, `IncassoDialog`, sezioni RCA, garanzie, appendici) cambiando solo la sorgente da `titoli` a `polizze`/`quietanze`.
- TitoloDetail resta come fallback per i deep link `/titoli/:id` legacy ma marcato deprecato.
- Sidebar e link interni vengono progressivamente puntati al nuovo URL space.

**Validazione**: aprire le 100 polizze esistenti, confrontare campo per campo nuova UI vs `TitoloDetail` (spot check 10 polizze chiave: annuale incassata, semestrale, mensile, RCA, sospesa, annullata, sostituita, regolazione, poliennale, con appendici).

**Reversibile**: basta rimettere il redirect.

## Milestone B — Viste Portafoglio sul modello puro

- `PortafoglioAttivePage`, `PortafoglioCaricoPage`, `PortafoglioStoricoPage` riscritte sulla view `v_portafoglio_quietanze` arricchita con i campi denormalizzati che servono (cliente, compagnia, ramo, AE, produttore).
- Nuova migrazione: ricreazione di `v_portafoglio_quietanze` con tutti i join necessari + `security_invoker=true`.
- Filtri (compagnia, ramo coordinato, sede, AE, produttore, stato, tipo Polizza/Quietanza, escludi mese) mantenuti 1:1.
- `useDashboardData` ripuntato su `quietanze` per i KPI portafoglio.

**Validazione**: query parallele su `v_portafoglio_titoli` (legacy) vs `v_portafoglio_quietanze` (nuova), assert SUM premi/provvigioni/conteggi identici. Spot check di Apr 2026 (riconciliazione legacy hardcoded).

**Reversibile**: revert delle 3 pagine.

## Milestone C — Edge Functions e logica server sul nuovo modello

- `calcola-provvigioni`: input passa da `titolo_id` a `quietanza_id`, calcoli su `quietanze` + `polizze`.
- `gestione-rimessa`: query "quietanze pagabili" passa da `titoli incassati` a `quietanze incassate`.
- `notifica-messa-cassa-agenzia`: input quietanza_id.
- RPC `annulla_polizza_cascade`: nuova versione che opera per `polizza_id`, cancella le quietanze discendenti via `polizza_id` e lascia un record d'ancora in `polizze` stato `annullata`.
- Trigger DB di sync `quietanze → titoli` mantenuti ancora attivi: scrivere su `quietanze` continua a popolare `titoli` per le pagine non ancora migrate.

**Validazione**: test Playwright end-to-end su emissione → messa a cassa → provvigione → rimessa → annullamento. Confronto totali pre/post.

**Reversibile**: rollback delle edge functions e ripristino del precedente RPC.

## Milestone D — Taglio del cordone

Solo dopo che A+B+C girano in produzione per almeno una chiusura mensile completa senza anomalie:

- Audit script: nessuna scrittura su `titoli` da almeno 30 giorni (eccetto trigger di sync), tutte le `quietanze` con `titolo_id` non-null hanno la riga `titoli` corrispondente.
- Disabilitazione (non drop) dei trigger di sync per 1 settimana di osservazione.
- Migrazione dati orfani residui (titoli senza `polizza_id`, se presenti).
- Drop dei trigger di sync.
- Drop della view `v_portafoglio_titoli`.
- Rinomina `titoli` → `_legacy_titoli_archive` (non DROP definitivo: backup vivo per audit).
- Rimozione di `TitoloDetail.tsx`, `useDashboardData.ts` parti legacy, route `/titoli/:id` ridotta a redirect.
- Pulizia colonne FK transizionali (`quietanze.titolo_id`, `polizze.titolo_madre_id`, `titoli.polizza_id`): mantenute per audit storico, marcate deprecate in commento.

**Validazione**: una chiusura mensile completa post-taglio.

**Reversibile**: rinomina inversa + ricreazione trigger. Drop fisico solo dopo 6 mesi di stabilità.

## Domande prima di partire

1. **Da quale milestone vuoi cominciare**? Consiglio **A (dettaglio nativo)** perché è la più visibile e dà subito feedback senza toccare la contabilità.
2. **`TitoloDetail`**: lo conservo come fallback fino alla Milestone D oppure lo elimino già in A (più pulito ma niente safety net per bookmark legacy)?
3. **Edge functions**: vuoi che mantenga input legacy `titolo_id` *in aggiunta* al nuovo `quietanza_id` per retro-compatibilità o passaggio netto?
4. **Tempi**: Fase 3 completa è settimane di lavoro reale. Vuoi che parta solo dalla Milestone A in questo turno e proceda step-by-step con feedback fra una milestone e l'altra, o prosegua finché possibile?
