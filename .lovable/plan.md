

## Piano: Data column + selezione titoli per rimessa

### Cosa cambia

**1. Colonna "Località" → "Data"**
- Rimuovere la colonna `Località` dalla tabella
- Aggiungere colonna `Data` che mostra il range delle date messa a cassa (o la data singola se unica)

**2. Riga espandibile con titoli individuali**
- Ogni riga compagnia diventa espandibile (click su freccia/chevron)
- Sotto la riga compagnia appare la lista dei singoli titoli incassati con: numero titolo, data messa a cassa, premio lordo, importo incassato, checkbox di selezione
- L'utente seleziona i titoli desiderati e poi clicca "Crea Rimessa" solo per quelli selezionati

**3. Edge Function: accettare lista titoli_ids**
- Aggiungere parametro opzionale `titoli_ids: string[]` all'azione `crea`
- Se fornito, usare solo quei titoli invece di prendere tutti quelli disponibili per la compagnia

### Modifiche tecniche

**`src/pages/contabilita/ECCompagniaContabPage.tsx`**
- Query: aggiungere `id, numero_titolo, data_messa_cassa, importo_incassato` al select per avere i dettagli singoli
- Raggruppamento: oltre ai totali, mantenere l'array dei titoli per compagnia
- Stato: `expandedRows: Set<string>` per gestire apertura/chiusura, `selectedTitoli: Record<string, Set<string>>` per le selezioni
- Tabella: riga principale con ChevronRight/Down + sotto-righe con checkbox per ogni titolo
- Colonna Località → Data (mostra range `min – max` delle date_messa_cassa)
- "Crea Rimessa" invia i `titoli_ids` selezionati (o tutti se nessuno selezionato)

**`supabase/functions/gestione-rimessa/index.ts`**
- Accettare `titoli_ids` nel body
- Se presente, filtrare i titoli per quegli ID specifici invece di fare la query per compagnia

### Flusso utente risultante
1. Vede lista compagnie con totali aggregati
2. Espande una compagnia → vede i titoli singoli con checkbox
3. Seleziona quelli da rimettere → click "Crea Rimessa"
4. La rimessa viene creata solo con i titoli scelti

