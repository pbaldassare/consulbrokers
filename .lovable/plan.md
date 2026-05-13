## Obiettivo
Per i clienti **Privato**, allineare i campi obbligatori a: **Nome, Cognome, Codice Fiscale, Indirizzo Residenza, Email, Sede**. Tutto il resto (Data di Nascita, Luogo di Nascita, CAP/Città/Provincia, Gruppo Finanziario, Specialist) diventa opzionale a livello di blocco salvataggio.

## Modifiche

### 1. `src/components/clienti/NuovoClienteDialog.tsx` — `getMissingFields()` (righe ~456-464)
Ramo `tipoCliente === "privato"`, lista finale obbligatori:
- Nome, Cognome, Codice Fiscale, Indirizzo Residenza, Email, **Sede** (`ufficioClienteId`)
- Rimuovere da obbligatori: CAP, Città, Provincia
- (Gruppo Finanziario resta obbligatorio perché governa il tipo cliente — necessario al funzionamento del form)

### 2. `src/pages/ClienteDetail.tsx` — `requiredFieldsList` Privato (righe ~1472-1482)
Nuova lista per Privato:
- `ufficio_id` (Sede)
- `nome` ← **da aggiungere**
- `cognome` ← **da aggiungere**
- `codice_fiscale` (con checksum)
- `indirizzo_residenza`
- `email` (con regex)

Rimuovere da obbligatori: `gruppo_finanziario_id`, `specialist_id`, `data_nascita`, `luogo_nascita` (restano editabili e mostrati, ma non bloccano il salvataggio).

### 3. Label/asterischi
Aggiornare gli asterischi `*` nelle label coerentemente (aggiungere su Nome/Cognome/Sede dove mancano in ClienteDetail; togliere da CAP/Città/Provincia/Data nascita/Luogo nascita in NuovoClienteDialog e ClienteDetail per il ramo Privato).

## Fuori scope
- Nessuna modifica a schema DB / RLS / edge functions.
- Ramo Azienda/Ente invariato.
- Validazione checksum CF resta attiva quando il campo è valorizzato.
