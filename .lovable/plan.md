## Obiettivo
Aggiungere **"Polizza Libro Matricola"** come **nuovo Tipo Operazione** (radio), accanto a Polizza / Emittenda / Polizza Auto. Quando selezionato, in aggiunta al form polizza normale appare un **modale dedicato** per gestire la lista mezzi.

## Conferma di comprensione (rivista)
- "Libro Matricola" è una **quarta opzione** nel radio "Tipo Operazione" (`Polizza`, `Emittenda`, `Polizza Auto`, **`Polizza Libro Matricola`**).
- Il form generale resta uguale (Contratto, Premio, Garanzie ecc.).
- In più appare un bottone "Gestisci Libro Matricola (N mezzi)" che apre un modale con una tabella di righe.
- Riga: **Targa, Data inclusione, Data esclusione, Note** — tutti opzionali, nessuna validazione bloccante.
- Bottone "+ Aggiungi mezzo" per nuova riga; icona cestino per rimuovere.
- Le righe sono persistite in DB nella nuova tabella `libro_matricola_mezzi` collegata a `titoli.id` (cascade delete).
- Niente generazione automatica di quietanze per mezzo; niente integrazione con `veicoli_polizza`.

## Implementazione

### 1. Migrazione DB
- Nuova tabella `public.libro_matricola_mezzi`:
  - `id uuid pk default gen_random_uuid()`
  - `titolo_id uuid not null references titoli(id) on delete cascade`
  - `targa text`, `data_inclusione date`, `data_esclusione date`, `note text`
  - `created_at`, `updated_at` con trigger `update_updated_at_column`
  - index su `titolo_id`
- GRANT a `authenticated` (SELECT/INSERT/UPDATE/DELETE) e `service_role` (ALL).
- RLS abilitata; policy: accessibile agli authenticated (riusa pattern delle altre tabelle figlie di `titoli`, es. `premi_garanzia_polizza`).
- Marker per riconoscere la modalità: usare `titoli.tipo_operazione = 'libro_matricola'` (verificare valori esistenti su `titoli` prima della migrazione; se vincolato da enum/check, estendere).

### 2. Nuovo componente
`src/components/polizze/LibroMatricolaDialog.tsx`
- Props: `open`, `onOpenChange`, `righe`, `onChange(nuoveRighe)`, `readOnly?`.
- Dialog (shadcn) con tabella editabile: Targa (uppercase auto), Data inclusione (Shadcn DatePicker), Data esclusione (DatePicker), Note (Input), bottone rimuovi per riga.
- Footer: "+ Aggiungi mezzo" + Conferma/Annulla.
- Nessuna validazione obbligatoria; righe completamente vuote vengono filtrate al salvataggio.

### 3. `ImmissionePolizzaPage.tsx`
- Aggiungere radio "Polizza Libro Matricola" in Tipo Operazione.
- Stato `righeMatricola: LibroMatricolaRiga[]`.
- Quando tipo === libro_matricola: mostrare bottone "Gestisci Libro Matricola (N mezzi)" e aprire `LibroMatricolaDialog`.
- In `handleSubmit`: dopo insert titolo, bulk insert delle righe non-vuote in `libro_matricola_mezzi`.

### 4. `TitoloDetail.tsx`
- Caricare righe esistenti se `tipo_operazione === 'libro_matricola'`.
- Stesso bottone + dialog.
- Update: diff delle righe (delete rimosse / insert nuove / update modificate).
- Rispettare lock UI esistente (messa a cassa / stornata) → `readOnly` nel dialog.

### 5. Memoria
- Nuovo file `mem://insurance/libro-matricola.md`: descrizione del Tipo Operazione, tabella DB, comportamento UI, opzionalità campi.
- Aggiornare `mem://index.md`.

## Fuori scope
- Nessun import CSV/Excel dei mezzi.
- Nessun calcolo di premio per mezzo.
- Nessuna sincronizzazione con `veicoli_polizza` / `rca_dati`.
