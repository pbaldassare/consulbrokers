

## Piano: Svuotare le rimesse premi esistenti e attendere ristrutturazione

### Contesto
Le rimesse premi (104 record) sono dati di test/vecchi che non riflettono il flusso corretto. Il flusso reale prevede: Carico del Mese → Messa a Cassa → Rimessa alle Compagnie. Prima di ricollegare tutto, bisogna pulire i dati vecchi.

### Intervento

**1. Migrazione SQL — svuotare le tabelle rimessa**
```sql
DELETE FROM rimessa_dettaglio;
DELETE FROM rimessa_premi;
```
Questo rimuove tutti i 104 record di rimessa e i relativi dettagli.

**2. Nessuna modifica al codice**
Le pagine `RimessaList.tsx`, `RimessaDetail.tsx` e la edge function `gestione-rimessa` restano invariate — mostreranno semplicemente una lista vuota. Quando strutturerai il flusso carico/messa a cassa, ricollegheremo tutto.

### File coinvolto
- Una sola migrazione SQL per il `DELETE`

### Prossimi passi (in attesa di tue indicazioni)
- Strutturare il flusso "Messa a Cassa" dei premi di rinnovo
- Collegare la messa a cassa alla generazione automatica delle rimesse per compagnia

