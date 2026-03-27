

## Piano: Rinominare Executive → Backoffice e auto-compilare

### Cosa cambia

1. In tutta la UI dei ruoli commerciali, "Executive" diventa "Backoffice"
2. Quando si crea un nuovo cliente, il ruolo "Backoffice" viene auto-compilato con l'utente backoffice loggato (o il primo backoffice trovato nel sistema)

### File da modificare

**1. `src/pages/ClientiList.tsx`**
- Label "Executive" → "Backoffice" nel accordion (riga ~920)
- `{ ruolo: "Executive", data: executive }` → `{ ruolo: "Backoffice", ... }` (riga ~231)
- Variabile `executive` rinominata `backoffice` per chiarezza
- Auto-compilazione: dopo il fetch dei `profiliCommerciali`, trovare il profilo con ruolo `backoffice` e pre-settare lo state `backoffice.profilo_id` automaticamente

**2. `src/pages/ClienteDetail.tsx`**
- `ruoliCommerciali` array: `{ value: "executive", label: "Executive" }` → `{ value: "backoffice", label: "Backoffice" }` (riga 37)
- Nella `CodiciCommercialiSection`, il matching avviene per ruolo, quindi i nuovi record useranno "backoffice"

### Logica auto-compilazione (ClientiList - creazione)

Quando il dialog di creazione si apre:
- Query i profili con ruolo `backoffice`
- Se l'utente corrente ha ruolo `backoffice`, pre-popola con il suo ID
- Altrimenti, prende il primo backoffice attivo disponibile
- L'utente puo comunque cambiarlo manualmente

### Nessuna modifica DB
Il campo `ruolo` in `codici_commerciali_cliente` e un testo libero, quindi il valore "Backoffice" funziona senza migrazioni.

