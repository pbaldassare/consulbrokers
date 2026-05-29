# Piano: notifica messa a cassa — fix + reinvio

## Stato attuale (verificato)

- Polizza 184667297 (`4469957b…`): messa a cassa registrata il 29/05/2026, stato `incassato`.
- Nessuna entry `notifica_messa_cassa_inviata` in `log_attivita`, nessun log della edge function `notifica-messa-cassa-agenzia` → la funzione **non è mai stata invocata con successo**.
- Il codice client invoca correttamente la funzione sia da `TitoloDetail.tsx:1306` sia da `MessaCassaDialog.tsx:97`, ma in fire-and-forget (`.catch(...)`), quindi un errore viene ingoiato silenziosamente.
- La funzione esiste in `supabase/functions/notifica-messa-cassa-agenzia/index.ts` ma **non è dichiarata in `supabase/config.toml`** (a differenza di `send-email` che ha `verify_jwt = false`). Probabilmente non è mai stata realmente deployata, oppure è in stato JWT-protected e l'invoke da client fallisce.

## Obiettivi

1. **Capire e sistemare** il flusso automatico della notifica al momento della messa a cassa.
2. **Aggiungere bottone "Reinvia notifica messa a cassa"** nel pannello Operazioni di `TitoloDetail`, visibile solo se la polizza è già messa a cassa.

## Cosa cambia

### 1. Deploy + config edge function
- Aggiungere in `supabase/config.toml` la sezione `[functions.notifica-messa-cassa-agenzia]` con `verify_jwt = false` (è chiamata dal client autenticato ma non necessita di validazione JWT — internamente usa service role).
- Redeploy esplicito di `notifica-messa-cassa-agenzia` per assicurarsi che la versione corrente sia attiva.
- Test diretto via curl con `titolo_id = 4469957b-0d8b-49df-808d-673be95c965e` per verificare che parta la mail e venga loggata.

### 2. Visibilità errori nel client
In `TitoloDetail.tsx` e `MessaCassaDialog.tsx`: trasformare il `.catch()` silenzioso in un `toast.warning(...)` non bloccante con il messaggio di errore, in modo che se la mail non parte l'utente lo veda subito (resta non bloccante per la messa a cassa).

### 3. Bottone "Reinvia notifica" in TitoloDetail
- Nella card **Operazioni** (`src/pages/TitoloDetail.tsx`), aggiungere bottone `Reinvia notifica messa a cassa` (icona Mail), abilitato solo se `t.data_messa_cassa` valorizzato.
- Handler: chiama `supabase.functions.invoke("notifica-messa-cassa-agenzia", { body: { titolo_id: t.id } })` con feedback toast (success con destinatario / error con messaggio).
- Dopo successo: invalida la query `log_attivita` se presente, per mostrare subito l'entry nuova nel tab "Log Attività".

### 4. Pannello "Dove sono salvati i dati"
- Aggiungere/aggiornare l'entry "Messa a Cassa/Notifica" con riferimento esplicito alla funzione `notifica-messa-cassa-agenzia` e al campo destinatario risolto (rapporto.email_messe_a_cassa → compagnia.email_messe_a_cassa → fallback `pscarpelli@consulbrokers.it`).

## Verifica

1. Curl diretto della funzione sul titolo 184667297 → status 200, `recipient` valorizzato, entry `notifica_messa_cassa_inviata` in `log_attivita`.
2. Aprire la pagina del titolo, cliccare "Reinvia notifica" → toast "Notifica inviata a <email>".
3. Mettere a cassa una nuova polizza di test → controllare log function e `log_attivita`.

## Fuori scope

- Non modifico la logica di risoluzione destinatario nell'edge function (rapporto → compagnia → fallback resta invariata).
- Non tocco `send-email` né il template HTML.
- Non aggiungo gestione bounce/retry: la chiamata resta fire-and-forget con bottone manuale di reinvio come fallback.
