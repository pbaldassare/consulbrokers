
## Richiesta

Nella pagina **Carico del Mese** (`/portafoglio/carico`), il pulsante "Cassa" (icona/azione di riga) deve:

1. **Aprire lo stesso popup di "Messa a Cassa"** già presente nel `TitoloDetail.tsx` (con i campi: data messa cassa, data incasso, importo incassato, tipo pagamento, ecc.)
2. **Supportare la selezione multipla**: quando l'utente seleziona più polizze (checkbox in tabella) e clicca "Cassa", il popup deve applicare gli stessi valori (data, tipo pagamento, opzionalmente importi) **a tutte le polizze selezionate in contemporanea**, in un'unica operazione.

## Investigazione necessaria

Prima di implementare devo verificare:

1. **`src/pages/PortafoglioCaricoPage.tsx`** — capire:
   - Come è implementato oggi il pulsante "Cassa" di riga (cosa fa attualmente — apre un dialog semplice? va a `TitoloDetail`? esegue un update inline?)
   - Se esiste già la selezione multipla con checkbox e una toolbar di azioni bulk
   - Quali colonne/azioni bulk esistono già

2. **`src/pages/TitoloDetail.tsx`** — estrarre il dialog di "Messa a Cassa" come componente riutilizzabile (oggi è inline nel detail) per poterlo richiamare anche dalla pagina Carico

3. **Logica di update** — il dialog oggi aggiorna 1 titolo: va esteso a N titoli (loop oppure update batch con `IN (...)`)

## Piano di implementazione

### 1. Estrarre il dialog Messa a Cassa
Creare nuovo componente `src/components/portafoglio/MessaCassaDialog.tsx` con:
- Props: `titoliIds: string[]` (1 o N), `open`, `onOpenChange`, `onSuccess`
- Form: data messa cassa, data incasso, importo incassato (disabilitato se selezione multipla — usa premio_lordo di ciascun titolo), tipo pagamento, note
- Submit: aggiorna **tutti** i titoli in un'unica chiamata Supabase + log attività per ciascuno + invalidate queries

### 2. Refactor TitoloDetail
Sostituire il dialog inline con il nuovo `MessaCassaDialog` passando `titoliIds={[id]}` (singolo). Comportamento invariato.

### 3. PortafoglioCaricoPage
- Verificare/aggiungere selezione multipla via checkbox (sembra già presente dallo screenshot — colonna checkbox in tabella)
- Aggiungere toolbar bulk azioni che appare quando N≥1 selezionate, con pulsante "Incassa selezionate (N)"
- Il pulsante "Cassa" di riga apre il dialog con un solo ID
- Il pulsante bulk apre lo stesso dialog con la lista di ID selezionati

### 4. Comportamento selezione multipla nel dialog
- Header: "Incasso multiplo: N polizze (totale lordo €X.XXX)"
- Importo incassato: nascosto/auto (somma o per-riga = premio_lordo di ciascuna)
- Data messa cassa, data incasso, tipo pagamento: applicati a tutte
- Submit: update batch con `.in('id', titoliIds)` per i campi comuni, poi cambio stato per ciascuna a `incassato`

### File toccati
- `src/components/portafoglio/MessaCassaDialog.tsx` (nuovo)
- `src/pages/TitoloDetail.tsx` (refactor: usa nuovo dialog)
- `src/pages/PortafoglioCaricoPage.tsx` (toolbar bulk + collega pulsante riga al nuovo dialog)

### Conferma prima di procedere
Per la selezione multipla, l'**importo incassato** di ciascuna polizza deve essere preso automaticamente dal `premio_lordo` di ognuna (default), oppure preferisci consentire l'editing per ciascuna nella griglia del dialog? Il default consigliato (auto = premio_lordo di ciascuna) è quello standard per gli incassi di rinnovo — procedo con questo se non specifichi diversamente.
