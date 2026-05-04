## Modifica regola "Carico del Mese"

### Comportamento attuale
La pagina `/portafoglio/carico` mostra le polizze in scadenza nel mese **+12** rispetto al mese di lavorazione (lavorazione preventiva del rinnovo). Es.: Aprile 2026 → mostra scadenze Aprile 2027.

### Nuovo comportamento richiesto
Il "Carico del Mese X" deve mostrare le polizze con `data_scadenza` **nel mese X stesso** (mese corrente di navigazione).

Esempio: navigando ad Aprile 2026 → mostra le polizze in scadenza dal 1 al 30 Aprile 2026.

### Movimento dopo Messa a Cassa
Quando una polizza viene messa a cassa, deve "uscire" dal carico del mese corrente e ricomparire nel carico della **scadenza successiva**, calcolata in base al frazionamento (`rate`):
- Annuale (rate=1) → +12 mesi
- Semestrale (rate=2) → +6 mesi
- Quadrimestrale (rate=3) → +4 mesi
- Trimestrale (rate=4) → +3 mesi
- Mensile (rate=12) → +1 mese

Questo meccanismo è già gestito dal flusso esistente: la messa a cassa di una rata genera la **quietanza successiva** (movimento PQ) con la nuova `data_scadenza` (scadenza di quietanza), e il titolo principale conserva la `data_scadenza` di polizza. La distinzione **scadenza polizza vs scadenza quietanza** è già presente nei dati.

### Implementazione (1 sola modifica)

File: `src/pages/PortafoglioCaricoPage.tsx`

1. Riga 47: rimuovere `addMonths(caricoDate, 12)`:
   ```ts
   const scadenzaDate = caricoDate;
   ```
2. Aggiornare il sottotitolo (riga 302-304) rimuovendo "(12 mesi dopo il mese di lavorazione)" e mostrando solo: *"Polizze in scadenza a {mese}"*.
3. Aggiornare il commento alla riga 46.

### Note
- Filtro applicato su `data_scadenza` (scadenza di polizza/quietanza presente nella view `v_portafoglio_titoli`); non serve toccare la query, solo l'intervallo.
- Conferma: per Aprile 2026 vedrai le 16 polizze già rebindate ai nuovi specialist (Guarracino / Gestione Milano), totale lordo ~€89.951,50.
- Il banner "rinnovi in attesa" continua a riferirsi allo stesso mese (coerente).
- Nessuna migrazione DB necessaria.
