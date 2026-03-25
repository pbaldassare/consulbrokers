

## Piano: Potenziamento Cruscotto Giornaliero

### Stato attuale
La pagina `CruscottoGiornaliero.tsx` esiste gia con: KPI entrate/uscite/saldo, anomalie bancarie KO, scadenze fornitori, movimenti da riconciliare e movimenti del giorno.

### Cosa manca (da aggiungere)

1. **KPI "Incassi da Verificare"** — Titoli con `stato = 'da_incassare'` o simili, cioe premi attesi ma non ancora registrati come incassati. Conteggio + importo totale con link alla lista titoli filtrata.

2. **KPI "Quadratura Cassa"** — Confronto tra saldo cassa atteso (saldo ieri + entrate oggi - uscite oggi) e saldo effettivo. Mostra la differenza con alert se != 0.

3. **Sezione "Titoli in Scadenza Oggi/Settimana"** — Query su titoli con `data_scadenza` nel range oggi+7gg e stato attivo, per anticipare gli incassi attesi.

4. **Progress bar di riconciliazione** — Percentuale movimenti riconciliati vs totali del giorno, con barra visuale.

5. **Filtro data** — Permettere di visualizzare il cruscotto per una data diversa da oggi (utile il lunedi per recuperare il weekend).

### File coinvolti

| Azione | File |
|--------|------|
| Modificare | `src/pages/contabilita/CruscottoGiornaliero.tsx` — aggiungere nuove query, KPI cards, sezione titoli, filtro data, progress bar |

### Dettagli tecnici

- Nuove query Supabase: `titoli` filtrati per `data_scadenza` e stato, `movimenti_contabili` del giorno precedente per saldo iniziale
- Nessuna nuova tabella DB necessaria, tutto basato su tabelle esistenti
- Progress bar con componente `Progress` gia disponibile
- DatePicker per il filtro data con `Calendar` esistente

