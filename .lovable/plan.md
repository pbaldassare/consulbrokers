

## Piano: Polling a 30s e parsing corretto dei risultati Browser Use

### Problema
1. Il polling ogni 5 secondi e inutile — Browser Use impiega minuti, non secondi
2. I dati tornano dal Browser Use nel formato corretto (il JSON che hai incollato) ma il parser/mapper potrebbe non estrarli bene dalla risposta della sessione

### Modifiche

**1. `src/pages/BandiPubbliciPage.tsx`**
- Cambiare `POLL_INTERVAL_MS` da 5000 a 30000 (30 secondi)
- Cambiare il primo poll delay da 8000 a 30000 (primo poll dopo 30s, non 8s)

**2. `supabase/functions/cerca-bandi/index.ts`**
- Migliorare `parseOutput` per gestire il caso in cui Browser Use restituisce il JSON dentro blocchi markdown (```json ... ```) o con testo aggiuntivo prima/dopo
- Aggiungere log del raw output ricevuto dalla sessione per debug
- Verificare che `checkSession` legga il campo corretto della risposta API (potrebbe essere `output`, `result`, o `final_result` a seconda della versione API)

**3. Rideploy della edge function**

### Dettagli tecnici

| File | Cosa cambia |
|------|------------|
| `src/pages/BandiPubbliciPage.tsx` | `POLL_INTERVAL_MS = 30000`, primo poll a 30s |
| `supabase/functions/cerca-bandi/index.ts` | Log raw output, parsing robusto markdown/text wrapper, check campi API response |

