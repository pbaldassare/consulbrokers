
Piano aggiornato: far uscire davvero i bandi da MondoAppalti

Diagnosi trovata
- La sessione Browser Use parte correttamente, ma oggi la Edge Function aspetta in modo sincrono e va in timeout dopo 3 minuti.
- Il frontend perde la connessione ancora prima (`Failed to fetch`), quindi una ricerca lunga non è affidabile in una sola chiamata.
- I nomi regione della UI non coincidono sempre con quelli che compaiono nel dato reale (`Emilia-Romagna` vs `Emilia Romagna`, `Friuli Venezia Giulia` vs `Friuli`).
- Il parser attuale si aspetta campi generici (`titolo`, `ente`), mentre il JSON reale di MondoAppalti ha campi tipo `scheda_id`, `tipologia`, `stazione_appaltante`, `localita`, `regione`, `scadenza`, `importo`, `cig`.

Cosa implementerò
1. Rifattorizzare `supabase/functions/cerca-bandi/index.ts` in modalità asincrona:
   - `action: "start"` crea la/e sessione/i Browser Use e restituisce subito `sessionId`
   - `action: "status"` controlla lo stato e restituisce i risultati appena pronti
   - tempo massimo esteso a 8-10 minuti, ma senza lasciare aperta la stessa richiesta HTTP

2. Rendere la multi-regione affidabile:
   - mappa UI -> nomi usati dal portale
   - batching automatico delle regioni (es. 2-3 per sessione) invece di una sola sessione enorme
   - merge finale e deduplica per `scheda_id` o `link`

3. Migliorare il prompt Browser Use:
   - login esplicito
   - navigazione guidata alla ricerca bandi
   - keyword fissa `Brokeraggio assicurativo`
   - se la ricerca esatta torna vuota, secondo tentativo automatico più ampio ma sempre nel perimetro assicurativo
   - richiesta di output nel formato reale del portale, non solo nel formato generico attuale

4. Rafforzare il parser:
   - supporto sia allo schema attuale sia allo schema reale del JSON che hai caricato
   - parsing corretto degli importi italiani (`150.739,73 €`)
   - mapping UI:
     - `titolo` <- `oggetto` oppure fallback a `tipologia`
     - `ente` <- `stazione_appaltante`
     - `categoria` <- `tipologia`
   - aggiunta ai risultati di `scheda_id`, `cig`, `localita`, `regione`

5. Aggiornare `src/pages/BandiPubbliciPage.tsx`:
   - avvio ricerca + polling automatico
   - stato avanzamento tipo “ricerca regioni 2/4”
   - risultati parziali appena arrivano
   - errore chiaro solo quando tutte le sessioni falliscono o scadono

6. Mettere test minimi di sicurezza:
   - fixture basata sul JSON fornito
   - test per normalizzazione regioni
   - test per parsing e mapping del payload MondoAppalti

File coinvolti
- `supabase/functions/cerca-bandi/index.ts`
- `src/pages/BandiPubbliciPage.tsx`

Dettagli tecnici
- Nessuna modifica database necessaria
- `supabase/config.toml` è già compatibile
- Non userò il campo `regione` restituito dal portale per scartare risultati lato client, perché il campione mostra valori non sempre coerenti
- Se anche così Browser Use resta troppo fragile, il passo successivo sarà sostituire la parte visuale con chiamate dirette all’endpoint dati del portale, se disponibile dopo login
