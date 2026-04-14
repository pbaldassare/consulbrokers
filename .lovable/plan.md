

## Piano: Sezione Regolazione editabile nel dettaglio polizza

### Obiettivo
Trasformare la sezione "Regolazione" in `TitoloDetail.tsx` da sola lettura a completamente modificabile, con salvataggio diretto su database.

### Intervento in `src/pages/TitoloDetail.tsx`

1. **Aggiungere stato locale per i campi regolazione**
   - `editingRegolazione` (boolean) per toggle view/edit
   - Stato per ogni campo: `regolazione` (checkbox), `periodicita` (select), `tipo_scadenza` (select), `giorni_presentazione` (number), `tipo_lettera_regolazione` (select), `libro_matricola` (radio)
   - Inizializzazione dai dati correnti del titolo quando si entra in edit

2. **Sostituire i `FieldRow` nella sezione Regolazione con input editabili**
   - Checkbox per "Regolazione Sì/No"
   - SearchableSelect per Periodicità (annuale, semestrale, trimestrale, mensile)
   - SearchableSelect per Tipo Scadenza (no_scadenza, a_scadenza)
   - Input number per GG Presentazione
   - SearchableSelect per Tipo Lettera (standard, personalizzata, nessuna)
   - RadioGroup per Libro Matricola (no, auto, altro)
   - Stessi controlli e opzioni già usati in `ImmissionePolizzaPage.tsx`

3. **Pulsante Modifica/Salva nell'header della sezione**
   - Icona matita per entrare in edit
   - Pulsanti "Salva" e "Annulla" visibili in modalità edit

4. **Mutation di aggiornamento**
   - `supabase.from("titoli").update({...campi_regolazione}).eq("id", titoloId)`
   - Invalidazione query dopo il salvataggio
   - Toast di conferma

### Import aggiuntivi necessari
- `Checkbox`, `Label`, `RadioGroup`, `RadioGroupItem` dai componenti UI
- `SearchableSelect` dal componente custom
- `Input` dal componente UI

### File coinvolto
- `src/pages/TitoloDetail.tsx`

### Dettaglio tecnico
- Nessuna migrazione database: i campi `regolazione`, `periodicita`, `tipo_scadenza`, `giorni_presentazione`, `tipo_lettera_regolazione`, `libro_matricola` esistono già nella tabella `titoli`
- Pattern coerente con i controlli già presenti in `ImmissionePolizzaPage.tsx`

