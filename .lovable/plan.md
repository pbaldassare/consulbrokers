

## Piano: Distinguere Polizze Attive, Carico del Mese e Storico Polizze

### Logica attuale (problemi)
- **Polizze Attive**: `stato = 'attivo' AND garanzia_a >= oggi` — OK
- **Carico del Mese**: filtra solo per `data_scadenza` nel mese, senza considerare lo stato — potrebbe includere polizze già scadute o sospese
- **Storico Polizze**: non esiste come pagina separata

### Definizioni corrette

| Sezione | Filtro | Scopo |
|---------|--------|-------|
| **Polizze Attive** | `stato = 'attivo' AND garanzia_a >= oggi` | Polizze in vigore, copertura valida |
| **Carico del Mese** | `data_scadenza nel mese selezionato AND stato IN ('attivo', 'incassato')` | Quietanzamento e rinnovi del mese — solo polizze operative |
| **Storico Polizze** | `stato IN ('scaduto', 'sospeso') OR (stato = 'attivo' AND garanzia_a < oggi)` | Archivio polizze non più in vigore |

### Azioni

1. **Aggiornare `PortafoglioCaricoPage.tsx`** — aggiungere filtro `stato IN ('attivo', 'incassato')` alla query per escludere polizze scadute/sospese dal carico

2. **Creare `PortafoglioStoricoPage.tsx`** — nuova pagina con la stessa struttura tabellare delle altre, che mostra polizze scadute, sospese o con garanzia scaduta. Stessi filtri (ricerca, compagnia, ramo) e paginazione server-side

3. **Aggiungere route** in `src/routes/portafoglio.tsx` per `/portafoglio/storico`

4. **Aggiungere voce sidebar** in `AppSidebar.tsx`: "Storico Polizze" con icona `Archive`, dopo "Carico del Mese"

### File coinvolti
- `src/pages/PortafoglioCaricoPage.tsx` — aggiunta filtro stato
- `src/pages/PortafoglioStoricoPage.tsx` — nuova pagina
- `src/routes/portafoglio.tsx` — nuova route
- `src/components/AppSidebar.tsx` — nuova voce menu

