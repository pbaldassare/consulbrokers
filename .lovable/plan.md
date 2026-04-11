

## Piano: Conferma cambio stato con dialog + fix errori silenziosi

### Problema
1. Il cambio stato non funziona (probabilmente errore silenzioso non visibile)
2. Manca un dialog di conferma prima del cambio stato
3. I cambi stato devono essere loggati nella timeline (il codice c'è ma potrebbe fallire senza segnalare)

### Modifiche

#### 1. `src/components/trattative/TrattativaDetailDialog.tsx`
- Aggiungere un **AlertDialog di conferma** prima di cambiare stato: "Sei sicuro di voler cambiare lo stato da X a Y?"
- Per stati terminali (chiusa_vinta, chiusa_persa) richiedere anche un **motivo_chiusura** nel dialog
- Aggiungere error handling nell'`logEvento` (attualmente ignora errori di insert)
- Aggiungere `console.error` e toast per errori nel log eventi
- Aggiungere log nell'`onError` per debug

#### 2. `src/components/trattative/StatoPipeline.tsx`
- Nessuna modifica - il componente è corretto, passa il click al parent

#### Flusso dopo la modifica:
1. Utente clicca su uno stato nella pipeline
2. Si apre un AlertDialog: "Conferma cambio stato" con stato vecchio → stato nuovo
3. Se stato terminale, campo testo per motivo chiusura
4. Utente conferma → mutazione parte → log evento + aggiornamento DB
5. Toast di successo/errore

### File coinvolti

| File | Modifica |
|------|----------|
| `src/components/trattative/TrattativaDetailDialog.tsx` | AlertDialog conferma + error handling migliorato |

