

## Piano: Area Documentale con CGA, Condizioni di Polizza e Archivio Compagnie

### Obiettivo
Trasformare la pagina placeholder `/portafoglio/documentale` in un archivio documentale completo ispirato al progetto [fba insurance](/projects/55a94ffb-6582-422b-813b-d2868a881612), con navigazione a cartelle gerarchiche, upload drag-and-drop, ricerca e organizzazione per compagnia/prodotto.

### Struttura dati

**Nuove tabelle DB (migrazione SQL):**

1. `document_folders` - cartelle gerarchiche
   - `id`, `name`, `folder_type` (compagnia/prodotto/sottoprodotto/generale), `description`, `icon` (emoji), `parent_folder_id` (self-ref), `compagnia_id` (FK compagnie), `order_index`, `active`, `created_at`

2. `document_library` - documenti caricati nelle cartelle
   - `id`, `folder_id` (FK document_folders), `file_name`, `file_url`, `file_type`, `file_size`, `description`, `tags` (text[]), `uploaded_by`, `active`, `uploaded_at`

3. RLS: admin full access, ufficio/produttore/cfo select, admin-only insert/update/delete su cartelle

4. Storage bucket: `document-library` per i file

**Seed iniziale cartelle** (nella migrazione): cartelle root per ogni compagnia esistente + sottocartelle tipo "CGA", "Condizioni di Polizza", "Fascicoli Informativi", "Modulistica".

### Componenti da creare

Tutti in `src/components/documentale/`:

1. **DocumentalePage.tsx** - Pagina principale con:
   - Header con titolo e breadcrumb di navigazione cartelle
   - Barra ricerca + pulsanti "Nuova Cartella" e "Carica Documento" (solo admin)
   - Griglia cartelle (FolderCard) e documenti (DocumentCard)
   - Drag & drop file esterni direttamente nella cartella corrente
   - Stato vuoto con messaggio

2. **FolderCard.tsx** - Card cartella con:
   - Icona (emoji o default folder), nome, tipo (badge), conteggio documenti
   - Drop zone per spostare documenti tra cartelle (drag & drop)
   - Menu contestuale admin (modifica, elimina)

3. **DocumentCard.tsx** - Card documento con:
   - Icona per tipo file (PDF rosso, Word blu, Excel verde, immagine viola)
   - Nome, dimensione, descrizione, tags come badge
   - Download diretto, spostamento, eliminazione (admin)
   - Drag per spostare in altra cartella

4. **CreateFolderDialog.tsx** - Dialog creazione cartella con:
   - Nome, tipo (compagnia/prodotto/sottoprodotto/generale), compagnia collegata, icona emoji, descrizione

5. **UploadDocumentDialog.tsx** - Dialog upload con:
   - Area drag-and-drop file, selezione cartella se non gia dentro una, descrizione, tags
   - Validazione tipo file (PDF, Word, Excel, immagini) e limite 50MB

6. **EditFolderDialog.tsx** - Dialog modifica cartella

7. **MoveDocumentDialog.tsx** - Dialog per spostare documento in altra cartella

### Routing

Aggiornare `src/App.tsx`: sostituire il PlaceholderPage su `/portafoglio/documentale` con il nuovo `DocumentalePage`.

### Contenuto tipico delle cartelle

La struttura ad albero sarà:
```text
Home
├── Generali Italia
│   ├── CGA (Condizioni Generali di Assicurazione)
│   ├── Condizioni di Polizza
│   ├── Fascicoli Informativi
│   └── Modulistica
├── Allianz
│   ├── CGA
│   ├── Condizioni di Polizza
│   └── Modulistica
├── UnipolSai
│   └── ...
└── Documenti Generali
    ├── Privacy e Consensi
    └── Normativa IVASS
```

### Dettagli tecnici

- Le cartelle usano `parent_folder_id` per la gerarchia (navigazione breadcrumb)
- I documenti vengono salvati nel bucket `document-library` di Supabase Storage con path `{folder_id}/{timestamp}_{filename}`
- Ricerca full-text su nome file, descrizione e tags
- Ordinamento per data o nome
- Conteggio documenti per cartella con query count

