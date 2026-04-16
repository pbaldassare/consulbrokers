

## Piano: Ristrutturare E/C Compagnie — Rimuovere tab Storico, aggiungere "Crea Rimessa" per riga

### Cosa cambia

**1. Rimuovere il tab "Storico Rimesse"**
- Eliminare `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` — la pagina torna a essere una singola vista (l'Estratto Conto)
- Rimuovere tutto il codice relativo: query `rimessa_premi`, stato `filtroStato`, `rimessaPage`, `revertMutation`, `statiRimessa`, `statoBadge`, e la tabella rimesse (righe 264-328)

**2. Aggiungere colonna "Azioni" con pulsante "Crea Rimessa" per ogni compagnia**
- Nuova colonna nella tabella Estratto Conto con un `Button` "Crea Rimessa" per ogni riga compagnia
- Il pulsante è visibile solo se `daRimettere > 0`
- Al click, invoca la Edge Function `gestione-rimessa` con `action: "crea"`, passando `compagnia_id` e i filtri periodo attivi (`data_da`, `data_a`)
- In caso di successo: toast con pulsante "Vedi Storico" che naviga a `/rimessa-premi` (la pagina lista rimesse esistente, che resta funzionante)
- Invalida le query per aggiornare i totali "Già Rimesso" e "Da Rimettere"

**3. Aggiornare subtitle e imports**
- Rimuovere subtitle "Estratto conto e storico rimesse" → "Estratto conto per compagnia"
- Rimuovere import non più usati: `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`, `Undo2`, `ServerPagination`, `Badge`

### File coinvolto
- **`src/pages/contabilita/ECCompagniaContabPage.tsx`** — refactor completo: rimozione tab, aggiunta mutation per creazione rimessa inline

### Flusso risultante
1. **Incassi e Coperture** → Conferma Messa a Cassa
2. **E/C Compagnia** → Vede riepilogo per compagnia con "Da Rimettere" → Click "Crea Rimessa"
3. **Storico Rimesse** (`/rimessa-premi`) → Consultazione archivio (navigazione dal toast o dalla sidebar)

