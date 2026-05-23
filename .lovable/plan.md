## Problema

Verificato in DB: il movimento `SO` e la voce `sospensione_polizza` in `log_attivita` vengono **già scritti correttamente**. Non vengono mostrati nella UI perché il dialog **non invalida le query** di `movimenti-polizza` e `timeline`. Inoltre il dialog non permette di allegare un documento alla sospensione, e l'attuale `DocumentiTab` salva il file con un nome auto-generato non modificabile.

## Modifiche

### 1. `src/components/polizze/SospensionePolizzaDialog.tsx`

**a) Invalidazione cache completa** dopo la mutation (così il movimento SO compare subito nella tab "Dettaglio Movimenti" e l'azione nella tab "Log Attività"):
- `["movimenti-polizza", titoloId]`
- `["timeline", "titolo", titoloId]`
- `["documenti", "titolo", titoloId]`
- (mantenute le esistenti per titolo/portafoglio)

**b) Sezione "Documento allegato (opzionale)"** nel form, sopra il footer:
- Input file (`<input type="file">`) con bottone "Seleziona file"
- Quando un file è scelto, mostra una riga con:
  - Input testuale **editabile** con il nome visualizzato (default = nome originale del file, estensione preservata)
  - Bottone X per rimuovere
- Validazione 10 MB (stessa di DocumentiTab)

**c) Upload nella mutation** (prima dell'insert del movimento, solo se file presente):
- Path storage: `titolo/${titoloId}/sospensione_${Date.now()}_${nomeOriginale}`
- Upload su bucket `documenti_titoli`
- Insert in tabella `documenti` con:
  - `nome_file = displayName` (quello editato dall'utente)
  - `path_storage`, `bucket_name`, `entita_tipo='titolo'`, `entita_id=titoloId`
  - `caricato_da = user.id`
- `logAttivita` riceve anche `documento_id` nel `dettagli_json`
- Descrizione movimento SO arricchita: `…+ " (allegato: <nome>)"` se presente

**d) Reset campi file** al `useEffect` su `open` (insieme agli altri campi).

### 2. Nessuna modifica DB

Si usano le tabelle/bucket esistenti (`documenti`, bucket `documenti_titoli`).

### 3. `public/version.json` → bump timestamp.

## Note tecniche

- Il nome modificabile rispetta l'estensione originale: se l'utente cancella l'estensione, viene riaggiunta in fase di insert per preservare l'apertura/preview.
- Nessuna modifica al `DocumentiTab` esistente in questa iterazione (l'utente lamenta il nome non modificabile *nel contesto della sospensione*; la richiesta più ampia di rename inline nella libreria documenti si può affrontare separatamente).
