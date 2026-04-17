
## Richiesta

Nel popup "Garantito" (sul TitoloDetail, route `/titoli/...`):

1. **Tipo Pagamento NON va richiesto** in fase di garantito → si imposterà in un secondo momento (quando la polizza sarà effettivamente incassata)
2. **Data Pagamento NON va mostrata/richiesta** → verrà compilata successivamente al momento dell'incasso reale

Quindi nel dialog "Garantito" devono restare solo i campi pertinenti alla fase di garanzia, NON quelli del pagamento.

## Investigazione

Devo verificare in `src/pages/TitoloDetail.tsx`:
- Quale dialog gestisce il flusso "Garantito" (Conferma Garantito)
- Quali campi mostra attualmente
- Quale logica/payload viene inviato al DB

Dallo screenshot vedo che il popup "Garantito" mostra:
- Data Messa a Cassa ✅ (resta)
- Data Pagamento ❌ (rimuovere)
- Data Decorrenza Rinnovo ✅ (resta)
- Tipo Pagamento ❌ (rimuovere)
- (eventuale Banca legata al tipo pagamento) ❌ (rimuovere)

## Piano

### File toccato
- `src/pages/TitoloDetail.tsx` — modificare il dialog "Garantito" rimuovendo:
  - Campo "Data Pagamento"
  - Campo "Tipo Pagamento" 
  - Campo "Banca" (condizionale al bonifico)
  - Riferimenti a queste variabili nello stato del form e nel payload di update

### Comportamento atteso dopo il fix

**Dialog Garantito** (azione di garanzia, NON incasso effettivo):
- Data Messa a Cassa
- Data Decorrenza Rinnovo
- Checkbox dichiarazione responsabilità
- Stato → `garantito` (non `incassato`)
- Nessun dato di pagamento (saranno compilati dopo, in fase di incasso reale)

**Dialog Incassa** (resta com'è — incasso effettivo):
- Tutti i campi pagamento (data pagamento, tipo, banca)
- Stato → `incassato`

### Nota importante da chiarire

Devo verificare nel codice attuale se il dialog "Garantito" attualmente:
- (a) imposta `stato = 'garantito'` e lascia in sospeso il pagamento, oppure
- (b) imposta `stato = 'incassato'` (uguale a Incassa) — in tal caso va corretto anche questo

E se lo stato `'garantito'` è ammesso dal vincolo DB su `titoli.stato` (che attualmente accetta: `attivo, sospeso, scaduto, incassato` — vedi memory `policy-states`). Se NON è ammesso, serve una migration per aggiungerlo, oppure si usa un campo separato (es. `garantito: bool` + `data_garanzia`) senza cambiare `stato`.

Procedo con la rimozione dei 2 campi (Data Pagamento + Tipo Pagamento + Banca) nel dialog Garantito. Per la gestione dello stato `garantito` nel DB verifico in fase di esecuzione e adatto la soluzione (aggiunta colonna booleana `garantito` + `data_garanzia` se lo stato non è ammesso, evitando di toccare `stato` finché non avviene l'incasso reale).
