

## Piano: Salvataggio automatico dei documenti scansionati nell'anagrafica cliente

### Problema attuale
Il componente `AiDocumentScanner` estrae i dati dal documento ma **non conserva il file** (JPEG/PDF) nell'anagrafica del cliente. Il file viene letto, inviato all'AI, e poi perso.

### Soluzione

**1. Modificare `AiDocumentScanner.tsx`**
- Aggiungere una nuova prop opzionale `onFileReady?: (file: File) => void`
- Quando un file viene processato con successo, chiamare `onFileReady(file)` oltre a `onExtracted(data)`
- Il componente resta generico e riusabile

**2. Modificare `ClientiList.tsx`**
- Accumulare i file scansionati in uno state array `scannedFiles: { file: File, documentType: string }[]`
- Nei callback `onFileReady` degli scanner (carta identita, tessera sanitaria, visura camerale), pushare il file nell'array
- **Dopo la creazione del cliente** (nel `onSuccess` della mutation): per ogni file accumulato, fare upload su bucket `documenti_clienti` e inserire record nella tabella `documenti` con `entita_tipo = 'cliente'` e `entita_id = id_cliente_appena_creato`
- La mutation `createMutation` deve restituire l'ID del cliente creato (modificare per usare `.select().single()`)

**3. Modificare `ImmissionePolizzaPage.tsx`**
- Stesso pattern: salvare il file della copia polizza nel bucket `documenti_generali` collegato all'entita polizza dopo il salvataggio

### Dettagli tecnici

- Upload path: `cliente/{clienteId}/{timestamp}_{filename}`
- Bucket: `documenti_clienti`
- Record `documenti`: `nome_file`, `path_storage`, `bucket_name`, `entita_tipo='cliente'`, `entita_id`, `caricato_da`
- I file vengono salvati solo dopo la creazione riuscita del cliente, per evitare orfani nello storage

### File coinvolti

| Azione | File |
|--------|------|
| Modificare | `src/components/AiDocumentScanner.tsx` — aggiungere prop `onFileReady` |
| Modificare | `src/pages/ClientiList.tsx` — accumulare file e salvarli post-creazione |
| Modificare | `src/pages/ImmissionePolizzaPage.tsx` — salvare copia polizza scansionata |

