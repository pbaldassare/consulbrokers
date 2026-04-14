

## Piano: Fix flusso provvigioni maturate (3 problemi)

### Situazione attuale
- Tutte le polizze incassate hanno `commerciale_id = NULL` e `percentuale_commerciale = 100` → provvigioni solo per Consulbroker
- `data_messa_cassa` non viene popolata durante la messa a cassa in `PortafoglioCaricoPage`
- `provvigioni_generate` è vuota — la edge function non genera record

### Cosa fare

**1. Popolare `data_messa_cassa` alla messa a cassa**
In `PortafoglioCaricoPage.tsx`, aggiungere `data_messa_cassa: new Date().toISOString().split('T')[0]` nell'update che cambia lo stato a `incassato`.

**2. Fix edge function `calcola-provvigioni`**
La funzione attuale potrebbe avere errori o non gestire il caso `commerciale_id = null`. Verificare i log e correggere per generare almeno la riga Consul quando `provvigioni_quietanza > 0`.

**3. Risposta alla domanda**
No, al momento nessun commerciale è collegato alle polizze incassate. Le provvigioni sono tutte al 100% per Consulbroker. Per avere provvigioni per altri destinatari, bisogna prima assegnare un `commerciale_id` e una `percentuale_commerciale < 100` alle polizze nel dettaglio titolo.

### File coinvolti
- **Modifica**: `src/pages/PortafoglioCaricoPage.tsx` — aggiungere `data_messa_cassa` nell'update
- **Modifica**: `supabase/functions/calcola-provvigioni/index.ts` — fix generazione record
- **Verifica**: log edge function per capire perché non genera record

