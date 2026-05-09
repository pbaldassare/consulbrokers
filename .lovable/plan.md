## Obiettivo
Trasformare l'attuale area `/cliente` (oggi popolata con dati demo del Comune di Varese) in un portale operativo pronto a ricevere dati reali: anagrafica ente arricchita con richiesta di modifica, gestione documentale per cliente/polizze/sinistri sui bucket già esistenti, apertura denuncia sinistro dal portale e upload allegati.

## Stato attuale (verificato)
- **Bucket già presenti**: `documenti_clienti`, `documenti_titoli`, `documenti_sinistri`, `documenti_generali` (tutti privati). Riusiamo questi, niente nuovi bucket.
- **RLS cliente**:
  - `clienti.cliente_select_own` → cliente vede la propria riga
  - `documenti.cliente_select_own_documenti` → vede solo doc con `visibile_al_cliente = true`
  - `documenti.cliente_insert_documenti` → può inserire SOLO doc su `entita_tipo='cliente'` (non su sinistri/polizze)
  - `sinistri` per cliente: nessuna policy INSERT, solo SELECT via `get_my_cliente_ids()`
- **Pagine cliente esistenti**: Dashboard, Polizze, Sinistri (read-only + grafici), Documenti, Scadenze, Chat, Notifiche, Pagamenti, UploadDoc (solo anagrafici), Anagrafica (read-only base), Ufficio.

## Cosa costruiamo

### 1. Anagrafica ente con richiesta modifica
- Estendere `ClienteAnagrafica.tsx` mostrando in chiaro tutti i campi rilevanti per ente (P.IVA, CF azienda, codice SDI, codice CUP, sede legale, sede operativa, PEC, telefono, referenti).
- Aggiungere pulsante **"Richiedi modifica dati"** che apre un dialog: il cliente seleziona il/i campi da aggiornare, inserisce il nuovo valore + motivazione, allega eventuale documento giustificativo.
- Nuova tabella `richieste_modifica_cliente` (cliente_id, campo, valore_attuale, valore_proposto, motivazione, stato `in_attesa|approvata|rifiutata|annullata`, note_agenzia, gestita_da, gestita_il).
- Lato agenzia: nuova pagina `/clienti/richieste-modifica` (solo `ufficio`/`admin`) con elenco pendenti, dettaglio, pulsanti Approva/Rifiuta. L'approvazione applica l'aggiornamento al record `clienti` e chiude la richiesta; il rifiuto richiede note.
- Notifica realtime all'agenzia alla creazione, al cliente quando approvata/rifiutata.

### 2. Sezione referenti ente
- Visualizzare la lista referenti dalla tabella `cliente_referenti` (read-only) e abilitare aggiunta/modifica via stessa logica "richiesta modifica".

### 3. Apertura denuncia sinistro dal portale
- Nuovo bottone "Apri nuovo sinistro" in `/cliente/sinistri` → wizard 3 step:
  1. Polizza coinvolta (select tra le polizze attive del cliente) + ramo + data evento + luogo
  2. Dinamica + controparte + targa (se RCA) + persone coinvolte
  3. Allegati (foto, denuncia ecc.) + conferma
- Insert in `sinistri` con `stato='aperto'`, `cliente_anagrafica_id` valorizzato, `aperto_da_cliente=true` (nuova colonna boolean), `ufficio_id` ereditato dalla polizza scelta, `numero_sinistro` generato server-side (placeholder finché agenzia non assegna numero compagnia).
- Documenti caricati: bucket `documenti_sinistri`, riga in `documenti` con `entita_tipo='sinistro'`, `visibile_al_cliente=true`, `caricato_da_cliente=true`.
- Notifica realtime all'agenzia (specialist + ufficio del cliente).

### 4. Upload allegati su sinistro esistente
- Nel dettaglio sinistro espanso (già presente in `ClienteSinistri`), aggiungere riquadro "Documenti del sinistro" con elenco doc visibili e pulsante upload.
- Mostrare anche stato pratica e timeline eventi (riserva, liquidazione, chiusura) in sola lettura.

### 5. RLS / migrazioni necessarie
- Tabella `richieste_modifica_cliente` con RLS:
  - cliente: INSERT/SELECT/DELETE solo su righe del proprio `cliente_id` in stato `in_attesa`
  - agenzia (`ufficio`/`admin`): SELECT/UPDATE
- `sinistri`: nuova policy `cliente_insert_sinistro` con `WITH CHECK (has_role(auth.uid(),'cliente') AND cliente_anagrafica_id IN (SELECT get_my_cliente_ids()) AND stato='aperto' AND aperto_da_cliente=true)`. Aggiungere colonna `aperto_da_cliente boolean default false`.
- `documenti`: estendere `cliente_insert_documenti` per accettare `entita_tipo IN ('cliente','sinistro','titolo')` purché l'entità riferita appartenga a un `cliente_id` del cliente loggato e `visibile_al_cliente=true`. Aggiungere colonna `caricato_da_cliente boolean default false`.
- `storage.objects` per `documenti_sinistri` e `documenti_titoli`: policy INSERT che permetta al ruolo `cliente` di scrivere in path che inizia con un id di sinistro/polizza appartenente a un suo `cliente_id`.

### 6. Dashboard cliente
- Card riassuntiva "Richieste in corso" (modifiche dati + sinistri aperti dal cliente) con stato.

## Cosa NON tocchiamo
- Non rimuoviamo i dati demo Varese: restano marcati `[DEMO]` come da memoria. Diventeranno semplicemente "veri" quando l'agenzia inserirà i record reali.
- Nessuna modifica ai bucket esistenti né nuovi bucket.
- Nessuna modifica al portale prospect.

## Dettagli tecnici (riepilogo)
- Migrazioni: nuova tabella `richieste_modifica_cliente`, colonne `sinistri.aperto_da_cliente`, `documenti.caricato_da_cliente`, policy RLS su `sinistri`/`documenti`/`storage.objects`.
- Frontend: nuove pagine `RichiesteModificaList.tsx` (lato agenzia), nuovi dialog `RichiestaModificaDialog.tsx` e `NuovaDenunciaSinistroDialog.tsx`, refactor `ClienteAnagrafica.tsx` e `ClienteSinistri.tsx`.
- Realtime: canale `notifiche` per i due flussi nuovi (richiesta modifica creata, denuncia cliente creata).
- Audit trail: già attivo su `clienti` e `sinistri` (memoria audit), quindi le modifiche approvate vengono registrate automaticamente.

## Domande residue (zero)
Tutte le scelte chiave già confermate dalle risposte precedenti.