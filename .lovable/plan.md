

## Piano: Integrazione Rete Commerciale nel Form di Creazione Cliente

### Problema attuale

Quando si crea un nuovo cliente, il dialog chiede solo dati anagrafici e contatti. L'assegnazione dell'Account Executive e dei Corrispondenti avviene solo dopo, nella pagina di dettaglio (`ClienteDetail.tsx` → sezione `CodiciCommercialiSection`). Questo obbliga l'operatore a creare il cliente, poi navigare al dettaglio, poi compilare la rete commerciale.

### Cosa cambia

Il dialog "Nuovo Cliente" in `ClientiList.tsx` viene ampliato con una sezione **Rete Commerciale** visibile durante la creazione. Dopo il salvataggio del cliente, i codici commerciali vengono inseriti automaticamente nella tabella `codici_commerciali_cliente`.

### Struttura del form aggiornato

```text
Dialog "Nuovo Cliente" (max-w-3xl)
├── Tipo Cliente (privato/azienda)
├── AI Document Scanner
├── Dati Anagrafici (come ora)
├── Contatti (come ora)
├── Gruppo Finanziario (come ora)
└── [NUOVO] Rete Commerciale
    ├── Account Executive
    │   └── Profilo (SearchableSelect), % Provvigione, Società/Brand
    ├── Corrispondente 1  (collassabile, opzionale)
    │   └── Profilo, % Provvigione, Società/Brand, Filiale, Mandato, Date
    ├── Corrispondente 2  (collassabile, opzionale)
    └── Corrispondente 3  (collassabile, opzionale)
```

L'Account Executive e visibile per default (campo obbligatorio suggerito). I Corrispondenti sono in Accordion collassabili, compilabili opzionalmente.

### Modifiche

| File | Modifica |
|---|---|
| **`src/pages/ClientiList.tsx`** | Aggiungere query `profili_commerciali`, state per AE + 3 corrispondenti (profilo_id, percentuale, societa_brand, filiale, mandato, date, altro_broker), sezione UI con SearchableSelect per ogni ruolo, logica post-insert che fa upsert su `codici_commerciali_cliente` |

### Dettagli tecnici

- Si riutilizza la stessa query `profiles` con filtro `ruolo IN ('produttore','ufficio','backoffice','admin')` gia presente in `ClienteDetail.tsx`
- Dopo `createMutation` restituisce `data.id`, si fa un batch insert su `codici_commerciali_cliente` per ogni ruolo compilato (profilo_id non vuoto)
- Il dialog passa da `max-w-2xl` a `max-w-3xl` per ospitare i campi aggiuntivi
- I campi AE sono in linea (Profilo + % + Societa), i Corrispondenti in Accordion con tutti i campi (filiale, mandato, date, altro broker)
- Nessuna modifica DB: la tabella `codici_commerciali_cliente` esiste gia con tutte le colonne necessarie

