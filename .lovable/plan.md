
## Richiesta

Rinominare 3 etichette di pulsanti nel dettaglio titolo (`TitoloDetail.tsx`), sezione "Messa a Cassa":

1. **"Metti a Cassa"** → **"Incassa"**
2. **"Copertura Garantita"** → **"Garantito"**
3. **"Conferma Conferimento"** → **"Conferma Garantito"** (probabilmente nel dialog di conferma)

## Da verificare

- `src/pages/TitoloDetail.tsx` — trovare le 3 stringhe esatte dei pulsanti/dialog
- Verificare se "Conferma Conferimento" è il titolo di un AlertDialog/Dialog o un button text, e se ci sono altre occorrenze (descrizioni, toast, log) da allineare

## Modifiche

Solo cambi di label testuali, nessuna logica toccata. Verifico anche eventuali toast/messaggi correlati per coerenza ("Messa a cassa eseguita" → potrebbe restare oppure diventare "Incasso registrato" — chiedo se vuoi propagare il rename anche ai messaggi di conferma).

### File toccato
- `src/pages/TitoloDetail.tsx` — 3 sostituzioni puntuali

### Nota
Procedo con il rename solo dei 3 elementi visibili indicati. Lascio invariati toast, log attività e nomi di campo DB (`data_messa_cassa`, ecc.) per non rompere la contabilità. Se vuoi che propaghi il termine "Incasso/Garantito" anche ai toast e ai titoli di sezione ("Messa a Cassa" header → "Incasso") fammelo sapere prima.
