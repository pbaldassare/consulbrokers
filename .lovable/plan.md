

## Piano: Conferma popup per "Segna Fondi Ricevuti" e possibilità di annullamento

### Problema attuale
1. Il pulsante "Segna Fondi Ricevuti" agisce immediatamente senza conferma
2. Una volta segnati i fondi come ricevuti, non è possibile annullare l'operazione

### Modifiche su `src/pages/TitoloDetail.tsx`

**1. Aggiungere un pulsante "Annulla Fondi Ricevuti"** accanto al badge verde "Fondi Ricevuti", che appare quando `fondi_ricevuti === true`

**2. Dialog di conferma per entrambe le azioni:**
- **Segna Fondi Ricevuti**: AlertDialog con messaggio "Confermi che i fondi per questo titolo sono stati effettivamente ricevuti?"
- **Annulla Fondi Ricevuti**: AlertDialog con messaggio "Sei sicuro di voler riportare questo titolo in stato 'In Attesa Fondi'?"

**3. Nuova mutation `annullaFondiMutation`**: aggiorna `fondi_ricevuti: false` + log attività con azione `fondi_ricevuti_annullato`

**4. Salvare in memoria** il comportamento di questa feature per riferimento futuro

### File coinvolti
- `src/pages/TitoloDetail.tsx` — 2 AlertDialog + mutation annullamento

