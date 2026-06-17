## Obiettivo

Allineare i campi del form "Nuova Appendice" di `AppendiciPolizzaPage.tsx` a quelli del dialog `AppendiceDialog.tsx`, che è la fonte di verità (è il dialog che parte da Gestione Polizze e che effettivamente crea/aggiorna `appendici_polizza`).

## Modifiche a `src/pages/AppendiciPolizzaPage.tsx`

### 1. Lista `TIPI_APPENDICE`
Sostituire l'attuale `[modifica, integrazione, rettifica, annullamento_parziale]` con la stessa del dialog:
```ts
const TIPI_APPENDICE = [
  { value: "modifica", label: "Modifica" },
  { value: "proroga", label: "Appendice di proroga" },
  { value: "regolazione", label: "Regolazione" },
];
```

### 2. Etichette campi (matching 1:1 col dialog)
- `N° Appendice` → **`Numero *`** + sotto "Progressivo automatico" + input **readonly/disabled** (come nel dialog)
- `Data Appendice` → **`Data scadenza`**
- `Data Effetto` → **`Data effetto`** (lowercase coerente)
- `Oggetto` placeholder: `"Breve descrizione dell'oggetto dell'appendice"`
- `Note` → **`Note interne`** + cambio da `<Input>` a `<Textarea rows={2}>`
- `Allega documento` (dropzone) → **`Allegato (opzionale)`** con `<Input type="file" />` semplice (rimuovo la dropzone e l'icona `Upload`)

### 3. Ordine campi (uguale al dialog)
1. Numero | Tipo  (riga 1, 2 colonne)
2. Data scadenza | Data effetto
3. Oggetto (full width)
4. Note interne (full width)
5. Allegato (full width)

### 4. Branch "Regolazione"
Quando `tipo === "regolazione"`, mostrare lo stesso banner ambra del dialog e sostituire il pulsante "Salva Appendice" con "Apri form regolazione" che naviga a `/portafoglio/immissione?mode=regolazione&titoloMadreId=<paramTitoloId>` — coerente col flusso già introdotto.

### 5. Numero progressivo
L'input Numero diventa readonly: l'utente non lo modifica più (la logica `useEffect` che calcola `max+1` resta, ma rimuovo il caso "edit del numero").  
In modalità edit di un'appendice esistente resta visibile ma non modificabile.

### 6. Tabella "Appendici Esistenti"
Nessuna modifica strutturale. La colonna `Data` resta etichettata come prima (mostra `data_appendice` = data scadenza nel DB — il nome colonna DB non cambia).

## Cosa NON cambia

- Schema DB `appendici_polizza` (i campi `data_appendice`, `data_effetto`, `oggetto`, `tipo`, `note`, `file_path`, `nome_file` restano gli stessi)
- `AppendiceDialog.tsx` (è già la fonte di verità)
- Logica di salvataggio/upload/edit/delete della page
- Deep-link `?appendiceId=...`

## File toccati

- `src/pages/AppendiciPolizzaPage.tsx` (unico file modificato)
