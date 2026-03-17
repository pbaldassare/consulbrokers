

## Piano: Aggiungere export XML alla pagina Backup & Export

### Cosa cambia

Aggiungere un secondo pulsante "Esporta XML" accanto a quello CSV esistente per ogni tabella. L'XML generato avrà una struttura standard con root element basato sul nome tabella e ogni riga come elemento figlio.

### Interventi su `src/pages/BackupExport.tsx`

1. **Aggiungere funzione `toXml`** che converte un array di oggetti in XML strutturato:
   - Root: `<export table="nome_tabella" date="YYYY-MM-DD">`
   - Ogni riga: `<row>` con sotto-elementi per ogni colonna (es. `<id>valore</id>`)
   - Escape dei caratteri speciali XML (`&`, `<`, `>`, `"`, `'`)

2. **Generalizzare `downloadBlob`** per accettare il MIME type (`text/csv` o `application/xml`)

3. **Aggiungere `handleExportXml`** (o parametrizzare `handleExport` con un formato `csv | xml`) che:
   - Scarica gli stessi dati da Supabase
   - Converte in XML con `toXml`
   - Scarica il file `.xml`
   - Logga l'attivita con formato nel `dettagli_json`

4. **UI**: Aggiungere un secondo pulsante "Esporta XML" con icona `FileCode` (o `FileText`) in ogni card, accanto al pulsante CSV esistente. Il loading state traccerà anche il formato per evitare conflitti.

### Struttura XML generata

```text
<?xml version="1.0" encoding="UTF-8"?>
<export table="titoli" date="2026-03-17" count="150">
  <row>
    <id>uuid-value</id>
    <numero_titolo>T-001</numero_titolo>
    <stato>attivo</stato>
    ...
  </row>
  ...
</export>
```

### File coinvolti
- **Modificato**: `src/pages/BackupExport.tsx`

