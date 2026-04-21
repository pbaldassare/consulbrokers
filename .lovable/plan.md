

## Logica corretta Carico del Mese

Ho frainteso prima. La regola corretta è l'**opposto**:

- Carico del mese **X** → mostra polizze con `data_scadenza` nel mese **X + 12 mesi**
- Esempio: Carico **Aprile 2025** → polizze che scadono ad **Aprile 2026**
- Quindi se oggi è Aprile 2026, il "Carico del mese corrente" di default mostra le scadenze di **Aprile 2027** (le polizze da lavorare/rinnovare adesso, la cui nuova annualità partirà ad aprile 2027 dopo la scadenza dell'attuale ad aprile 2026).

In pratica il Carico è il **lavoro di preparazione del rinnovo** che si fa 12 mesi prima della prossima scadenza.

## Modifiche

### `src/pages/PortafoglioCaricoPage.tsx`

1. Calcolo intervallo di scadenza shiftato di **+12 mesi** rispetto al mese selezionato:
   ```ts
   const scadenzaDate = addMonths(caricoDate, 12);
   const caricoStart = format(startOfMonth(scadenzaDate), "yyyy-MM-dd");
   const caricoEnd   = format(endOfMonth(scadenzaDate),   "yyyy-MM-dd");
   ```
   Le 3 query (`portafoglio-carico`, `portafoglio-carico-totale`, `portafoglio-carico-pending`) usano questo intervallo sul filtro `data_scadenza`.

2. UI / etichette:
   - Header navigazione mese: resta es. "Aprile 2025" (mese di lavorazione carico).
   - Sottotitolo esplicativo: *"Mostra polizze in scadenza ad Aprile 2026 (12 mesi dopo)"*.
   - Card "Polizze in scadenza" → rinomina in "Polizze da rinnovare".
   - Banner/Dialog rinnovi in attesa: testo aggiornato al mese di scadenza reale.

3. Nessuna modifica a DB, view `v_portafoglio_titoli`, Polizze Attive, Storico, dashboard.

### Memory

- Aggiorno `mem://insurance/portfolio-management-views` documentando: "Carico del Mese X = scadenze del mese X+12".
- Aggiorno `mem://insurance/portfolio-april-2026-reconciliation`: il dataset "16 polizze €89.951,50 con scadenza Aprile 2026" diventa il riferimento di riconciliazione del **Carico Aprile 2025** (non più Aprile 2026).

## Verifica

1. Vado su `/portafoglio/carico` e seleziono **Aprile 2025**.
2. La lista mostra le polizze con `data_scadenza` tra 01/04/2026 e 30/04/2026.
3. Il sottotitolo recita "Mostra polizze in scadenza ad Aprile 2026".
4. Cambio mese a **Maggio 2025** → vedo scadenze Maggio 2026.
5. Polizze Attive e Storico restano invariate.

