

## Piano: Ristrutturazione completa modulo Trattative

### Problema attuale
Il modulo trattative è minimale: modale piccolo con pochi campi, nessun upload documenti, nessun log visibile, nessun calendario, nessun collegamento ufficio, gestione stati basilare.

### Modifiche previste

#### 1. Migrazione DB -- nuovi campi e tabelle

**Nuove colonne su `trattative`:**
- `ufficio_id` (uuid, FK → uffici) -- collegamento obbligatorio all'ufficio
- `data_apertura` (date, default CURRENT_DATE)
- `data_scadenza` (date) -- deadline prevista
- `priorita` (text: bassa/media/alta/urgente)
- `prodotto` rinominato/mantenuto, aggiunta `sottoprodotto`
- `premio_effettivo` (numeric) -- premio reale a chiusura
- `motivo_chiusura` (text) -- perché vinta/persa
- `assegnato_a` (uuid, FK → profiles) -- responsabile della trattativa

**Nuovi stati:** aperta → contatto → preventivo → in_negoziazione → proposta_inviata → chiusa_vinta → chiusa_persa → sospesa

**Nuova tabella `trattativa_documenti`:**
- id, trattativa_id (FK), nome_file, file_path (storage), tipo_documento, note, uploaded_by, created_at
- RLS allineata a trattative

**Nuova tabella `trattativa_eventi`:**
- id, trattativa_id (FK), tipo_evento (nota/telefonata/email/appuntamento/cambio_stato/documento), descrizione, data_evento, created_by, created_at, dettagli_json
- Questo è il log/timeline interno della trattativa visibile nel modale

**Nuova tabella `trattativa_scadenze`:**
- id, trattativa_id (FK), titolo, data_scadenza, completata, created_by, created_at
- Per gestire reminder e calendario interno

#### 2. Frontend -- Modale dettaglio trattativa completo

Sostituzione del dialogo di modifica con un **modale full-width a tab**:

- **Tab Dettagli**: tutti i campi (soggetto, ramo, compagnia, ufficio, premio previsto/effettivo, priorità, date apertura/scadenza, assegnato a, motivo chiusura, note). Modifica inline con salvataggio.
- **Tab Timeline/Log**: lista cronologica di tutti gli eventi (cambio stato, modifiche campi, note manuali, telefonate, email). Possibilità di aggiungere note/eventi manualmente. Ogni cambio stato e modifica viene loggato automaticamente qui.
- **Tab Documenti**: upload file collegati alla trattativa (preventivi, proposte, contratti). Lista documenti con download/anteprima.
- **Tab Scadenze**: calendario semplice con scadenze/appuntamenti collegati. Aggiunta/completamento scadenze.

#### 3. Gestione stati migliorata

Pipeline visuale con gli 8 stati. Cambio stato con conferma e nota obbligatoria. Ogni transizione logga automaticamente un evento nella timeline. Per chiusa_vinta/persa richiede motivo_chiusura.

#### 4. Lista trattative migliorata

- Colonna ufficio nella tabella
- Filtro per ufficio
- Indicatore priorità
- Conteggio documenti e scadenze aperte

### File coinvolti

| File | Modifica |
|------|----------|
| Migrazione SQL | Nuove colonne + 3 tabelle + RLS + indici |
| `src/pages/TrattativeList.tsx` | Lista migliorata + apertura modale dettaglio |
| `src/components/trattative/TrattativaDetailDialog.tsx` | **Nuovo** - Modale full con tab |
| `src/components/trattative/TrattativaDettagliTab.tsx` | **Nuovo** - Tab dettagli/form |
| `src/components/trattative/TrattativaTimelineTab.tsx` | **Nuovo** - Timeline eventi |
| `src/components/trattative/TrattativaDocumentiTab.tsx` | **Nuovo** - Upload e lista documenti |
| `src/components/trattative/TrattativaScadenzeTab.tsx` | **Nuovo** - Scadenze/calendario |
| `src/components/trattative/StatoPipeline.tsx` | **Nuovo** - Barra stati visuale |
| `src/integrations/supabase/types.ts` | Auto-aggiornato dopo migrazione |

### Dettagli tecnici

I documenti vengono salvati nel bucket `documenti_generali` con path `trattative/{trattativa_id}/{filename}`. La timeline usa la tabella `trattativa_eventi` (separata da `log_attivita` per visibilità diretta nel modale). Le RLS delle nuove tabelle seguono lo stesso pattern delle trattative (admin all, ufficio own, produttore own).

