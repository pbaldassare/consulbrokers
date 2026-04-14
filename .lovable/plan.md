
Obiettivo

Rendere davvero modificabile un’appendice dal punto in cui la stai guardando ora (`/titoli/:id`), senza costringerti a intuire un flusso nascosto.

Problema rilevato

- La modifica completa esiste già in `src/pages/AppendiciPolizzaPage.tsx` (`startEdit`, `update`, gestione file).
- In `src/pages/TitoloDetail.tsx`, invece, la tab “Appendici” è solo lettura: elenco + pulsante “Nuova Appendice”, ma nessuna azione sul record esistente.
- Quindi il problema non è il database: manca il collegamento alla modalità modifica dalla schermata che stai usando.

Piano di intervento

1. `src/pages/TitoloDetail.tsx`
   - aggiungere una colonna “Azioni” nella tab Appendici
   - per ogni riga mostrare:
     - Modifica
     - Visualizza testo, se presente
     - Download file, se presente
   - il click su “Modifica” aprirà la pagina gestione appendici passando anche `appendiceId=<id>` nei query params

2. `src/pages/AppendiciPolizzaPage.tsx`
   - leggere `appendiceId` dai query params
   - quando la lista appendici è caricata, cercare quel record e aprirlo automaticamente in modalità edit
   - precompilare tutti i campi: numero, date, tipo, oggetto, testo, note, file
   - mantenere stato, pulsanti e comportamento già esistenti per “Aggiorna Appendice”

3. Rifiniture UX
   - evidenziare la riga in modifica
   - se l’`appendiceId` non esiste più, mostrare un messaggio chiaro
   - rendere più chiaro il pulsante alto del dettaglio polizza, lasciando “Nuova Appendice” per la creazione e la matita sulle righe per la modifica

4. Verifica finale
   - aprire `/titoli/:id`
   - entrare nella tab Appendici
   - cliccare “Modifica” su un’appendice esistente
   - verificare che si apra già compilata nella pagina appendici
   - modificare testo, oggetto, tipo, date o file
   - salvare e controllare che il dettaglio polizza mostri i dati aggiornati

File coinvolti

- `src/pages/TitoloDetail.tsx`
- `src/pages/AppendiciPolizzaPage.tsx`

Dettagli tecnici

- Nessuna migrazione database necessaria
- Riutilizzo della logica CRUD già presente in `AppendiciPolizzaPage`
- La correzione chiave è il deep-link di modifica tramite query param `appendiceId`
