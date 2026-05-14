# Fix campo "Totale Provvigione (€)" non digitabile

## Problema

Nella card `PremiGaranziaCardShell.tsx` (sezione Provvigioni Firma/Quietanza):

1. L'input "Totale Provvigione (€)" è **controllato** con `value={totProv.toFixed(2)}` → ad ogni keystroke il valore viene riformattato dal parent a 2 decimali, rendendo impossibile digitare in modo naturale (caret salta, cifre vengono "mangiate", non si possono scrivere decimali parziali tipo "1.", "0.0", ecc.).
2. Se `totNetto <= 0` l'input viene **disabilitato** e il calcolo abbandonato → non si può inserire un importo manuale prima di avere un netto.
3. Stesso problema, in misura minore, su "% Agenzia" quando il valore arriva auto-calcolato.

## Soluzione (solo UI, file unico)

File: `src/components/polizze/PremiGaranziaCardShell.tsx`

### 1. Stato locale "draft" per i due input

Introdurre due stati locali stringa (`totDraft`, `pctDraft`) che tengono il testo digitato finché l'input è **focused**. Quando il campo perde focus o l'utente preme Invio → si normalizza e si chiama `onPercentualeAgenziaChange`. Quando il campo non è focused → si mostra il valore formattato dal prop.

Pattern:
```ts
const [totFocus, setTotFocus] = useState(false);
const [totDraft, setTotDraft] = useState("");
const totDisplay = totFocus ? totDraft : totProv.toFixed(2);
```

`onFocus` → inizializza draft con valore numerico corrente non formattato (es. `"0.4"` invece di `"0.40"`, virgola/punto accettati).
`onChange` → aggiorna solo `totDraft`.
`onBlur` / `Enter` → parse, calcola `newPct = (n / totNetto) * 100`, propaga.

### 2. Permettere editing anche con `totNetto <= 0`

Se `totNetto <= 0` e l'utente digita un importo, la card resta in stato "manuale": l'importo viene memorizzato come override (oppure semplicemente accettato e la % resta 0). In questa fase la cosa più pulita è **non disabilitare** l'input e, al blur, se `totNetto <= 0` lasciare la `%` invariata ma propagare comunque il valore via un nuovo callback opzionale `onProvvigioniOverrideChange` se presente; altrimenti no-op con feedback visivo. Per non allargare lo scope: rimuoviamo la `disabled` sul totale e, se `totNetto<=0`, mostriamo un hint "Inserire prima un Netto" sotto l'input — l'input resta scrivibile ma il blur non propaga.

### 3. Stesso pattern per `% Agenzia`

Solo focus/blur draft, no riformattazione mentre si digita.

### 4. Accettare virgola europea

Nel parse di blur: `parseFloat(draft.replace(",", "."))`.

## Out of scope

- Nessuna modifica a `ImmissionePolizzaPage.tsx`, alla logica di lookup produttore o alla persistenza DB.
- Nessuna modifica al layout/colori della card.

## File toccati

- `src/components/polizze/PremiGaranziaCardShell.tsx` (solo)
