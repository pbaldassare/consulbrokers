

## Specialist obbligatorio nella card "Assegnazioni Gestionali"

### Stato attuale

- **Sede** (`ufficio_id`) e **Gruppo Finanziario** (`gruppo_finanziario_id`) sono già obbligatori per qualsiasi tipo cliente (privato/azienda/ente) e bloccano il Salva. ✅
- **Specialist** invece NON è un campo diretto su `clienti`: è una riga della tabella `codici_commerciali_cliente` con `ruolo='backoffice'`. Oggi nella card "Assegnazioni Gestionali" è solo una nota testuale che rimanda alla sezione "Codici Commerciali (Rete)" in fondo. Va reso editabile lì in alto e obbligatorio.

### Cosa cambia

**File unico: `src/pages/ClienteDetail.tsx`**

1. **Query Specialist corrente**: nella card "Assegnazioni Gestionali" aggiungo un `useQuery` (chiave `["specialist_cliente", clienteId]`) che legge da `codici_commerciali_cliente` la riga con `ruolo='backoffice'` per il cliente corrente, restituendo `profilo_id`.

2. **Query lista Specialist**: aggiungo un `useQuery` per profili con `ruolo='backoffice'` attivi (riuso pattern già esistente in `CodiciCommercialiSection`).

3. **UI**: sostituisco il blocco descrittivo attuale (righe 1599-1607) con un `SearchableSelect` "Specialist *" che mostra `cognome nome` dei profili backoffice. Bordo rosso + asterisco + hint "Campo obbligatorio" se vuoto, identico a Sede/Gruppo Finanziario.

4. **Mutation**: cambio del valore → upsert su `codici_commerciali_cliente` con `{ cliente_id, ruolo: 'backoffice', profilo_id, percentuale: 0 }` e `onConflict: "cliente_id,ruolo"`. Invalido sia `["specialist_cliente", clienteId]` sia `["codici_commerciali", clienteId]` per tenere in sync la sezione in fondo.

5. **Validazione obbligatoria**: aggiungo `specialist_id` a `requiredFieldsList` (per entrambi privati e aziende), valutando contro il valore della query Specialist (non contro `ef`). Il counter "Compila i campi obbligatori (N)" e il blocco Salva si aggiornano automaticamente. Tecnicamente: introduco una variabile `specialistAssigned: boolean` e la includo nel calcolo di `requiredFieldsList`.

6. **Coerenza con sezione "Codici Commerciali (Rete)"**: la riga Specialist resta visibile e modificabile anche in fondo (per dettagli aggiuntivi: percentuale, mandato, date). La modifica in alto popola solo `profilo_id`; gli altri campi opzionali si gestiscono in fondo come oggi. Le due viste leggono dalla stessa tabella → restano sempre sincronizzate.

### Cosa NON tocco

- Schema DB, RLS, Edge Functions, altri tab/pagine.
- Sezione "Codici Commerciali (Rete)" in fondo: invariata, continua a permettere la gestione completa di tutti i ruoli (AE, Specialist, Agente, Produttore Sede).
- Logica auto-fill CF, hint coerenza, combobox comuni — invariati.
- Sede e Gruppo Finanziario: già obbligatori, nessun cambio.

### Verifica

1. Apro un cliente senza Specialist assegnato → card "Assegnazioni Gestionali" mostra il select Specialist vuoto con bordo rosso e hint "Campo obbligatorio". Counter "Compila i campi obbligatori (N)" incrementato di 1, Salva disabilitato.
2. Seleziono uno Specialist dalla tendina in alto → bordo rosso sparisce, contatore decresce, riga corrispondente appare popolata anche nella sezione "Codici Commerciali (Rete)" in fondo (stesso `profilo_id`).
3. Modifico lo Specialist nella sezione in fondo → la card in alto si aggiorna (cache invalidata).
4. Cliente azienda/ente: stesso comportamento, Specialist obbligatorio anche lì.
5. Cliente già completo con Sede + Gruppo + Specialist → nessuna regressione, Salva subito abilitato.

