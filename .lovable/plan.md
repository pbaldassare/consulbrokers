

## Piano: Fix navigazione polizze + esclusione rimesse confermate dal riepilogo + revert storico

### 3 problemi da risolvere

**1. Link polizze errato**: Il click sulla polizza naviga a `/portafoglio/${id}` (PortafoglioDetail) anziché `/titoli/${id}` (TitoloDetail). Fix: cambiare `navigate(`/portafoglio/${t.id}`)` → `navigate(`/titoli/${t.id}`)`.

**2. Dopo conferma rimessa, rimuovere dal riepilogo**: Attualmente le polizze confermate restano nel riepilogo. Bisogna escludere i titoli che sono già collegati a una rimessa confermata. Approccio:
- Dopo aver confermato una rimessa, i titoli collegati sono in `rimessa_dettaglio`
- Nella query `titoli-cassa-mese`, dopo aver caricato i titoli incassati, filtrare via quelli il cui `id` è già presente in `rimessa_dettaglio` (sotto-query o fetch separata)

**3. Revert dallo storico**: Aggiungere un pulsante "Annulla" su ogni rimessa nello storico che:
- Elimina i record da `rimessa_dettaglio` per quella rimessa
- Elimina il record da `rimessa_premi`
- I titoli tornano automaticamente nel riepilogo (perché non più in `rimessa_dettaglio`)
- Log dell'operazione

### File coinvolto
- `src/pages/RimessaList.tsx`

### Dettagli tecnici
- Fix riga 288: `/portafoglio/` → `/titoli/`
- Query titoli: aggiungere fetch di `rimessa_dettaglio` per il mese e filtrare `titoli` i cui ID non sono già collegati
- Mutation `revertMutation`: delete da `rimessa_dettaglio` + delete da `rimessa_premi` + invalidate queries
- Pulsante "Annulla" nello storico con conferma (window.confirm)

