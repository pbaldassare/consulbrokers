## Obiettivo
Eliminare i doppioni di date nelle card Quietanza: **Garanzia Da/A** restano solo nella card **Periodo**; le quietanze ereditano le finestre temporali calcolate automaticamente da `garanzia_da` + `garanzia_a` + `frazionamento` (12/6/4/3/1 mesi · poliennale = 1/anno).

## Cosa cambia nella UI

### Card Periodo (resta sorgente unica)
- `durata_da`, `durata_a`, `anni_durata`, `frazionamento`
- `garanzia_da`, `garanzia_a` (← unica fonte)
- `data_competenza`, `limite_mora`, `tacito_rinnovo`, `gg_mora`, `disdetta`

### Card Quietanze (snellita)
Ogni card "Rata N/M" mostra in **header read-only**:
- `Rata N/M` · `garanzia_da → garanzia_a` (calcolate) · `competenza` · `scadenza`

Campi **editabili** per riga (solo importi/provvigioni):
- `premio_netto`, `tasse`, `ssn`, `addizionali`, `premio_lordo` (auto)
- `provv_firma`, `provv_quietanza`

**Rimossi** dalle card quietanza: i 4 datepicker `Garanzia Da/A` + `Competenza/Scadenza` (diventano label nell'header, non input).

Pulsante "Modifica finestre" (opzionale, collassato) per casi rari in cui serve override manuale di una singola finestra — apre i datepicker inline solo per quella rata.

## Logica di calcolo finestre (`computeQuietanzePlan`)
Già supporta tutto. Per ogni rata `i ∈ [1..N]`:
- `garanzia_da_i = garanzia_da + (i-1) × passo`
- `garanzia_a_i = garanzia_da + i × passo − 1 giorno` (ultima rata clampa a `garanzia_a`)
- `competenza_i = garanzia_da_i`
- `scadenza_i = garanzia_da_i + gg_mora`

Passo per frazionamento: Mensile=1m, Bimestrale=2m, Trimestrale=3m, Quadrimestrale=4m, Semestrale=6m, Annuale=12m, Poliennale=12m (N=anni_durata).

## File da modificare
1. **`src/components/polizze/QuietanzeEditor.tsx`**
   - Rimuovere i 4 `<DatePicker>` (garanzia/competenza/scadenza) dal corpo card.
   - Spostare le date come testo nell'header card (`Rata N/M · gg/mm/aa → gg/mm/aa`).
   - Mantenere solo Netto, Tasse, SSN, Addiz., Lordo, Provv. Firma, Provv. Quietanza.
   - Toggle "Personalizza finestre" → mostra inline i datepicker solo se serve override.
2. **`src/pages/ImmissionePolizzaPage.tsx`**
   - Assicurarsi che cambi a `garanzia_da/a` o `frazionamento` nella card Periodo rigenerino `quietanzeDrafts` con le nuove finestre (preservando importi/provvigioni già editati per indice).
   - Effect: `useEffect([garanzia_da, garanzia_a, frazionamento, anni_durata, gg_mora]) → recomputePlan + merge importi esistenti`.

## Comportamento al save
Invariato: `INSERT polizze` → trigger genera N quietanze → loop `UPDATE` con i draft (ora solo importi/provvigioni, le finestre coincidono già con quelle del trigger).

## Override manuale (edge case)
Se l'utente attiva "Personalizza finestre" su una rata, salviamo anche `garanzia_da/a/competenza/scadenza` di quella rata nell'UPDATE (oggi già lo facciamo).

## Out of scope
- Backfill polizze esistenti (già fatto).
- Logica frazionamento/poliennale (già OK).
- Schema DB invariato.
