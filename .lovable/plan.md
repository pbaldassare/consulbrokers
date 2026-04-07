

## Piano: Integrazione Browser Use per ricerca Bandi Pubblici

### Approccio
Creare una Edge Function che usa l'API Browser Use per navigare siti di bandi pubblici (es. serviziocontrattipubblici.it, ANAC, SimoG) e restituire risultati strutturati. L'utente cerca dalla UI, la Edge Function invia il task al browser AI, che naviga i portali e restituisce i bandi trovati.

### Architettura

```text
UI (BandiPubbliciPage) → Edge Function → Browser Use API → Siti bandi pubblici
                                              ↓
                                     Risultati strutturati (JSON)
```

### Modifiche

**1. Secret `BROWSER_USE_API_KEY`**
- Salvare la chiave `bu_8Zu1X1M6lnYQcuIuKoACw2m4qQdG5MrWlYD1oHaVg4E` come secret del progetto

**2. Nuova Edge Function `supabase/functions/cerca-bandi/index.ts`**
- Riceve i filtri dal frontend (keyword, regione, importo, stato)
- Costruisce un task in linguaggio naturale per Browser Use, es: "Cerca bandi pubblici su serviziocontrattipubblici.it con parola chiave 'assicurazione' nella regione 'Lombardia'. Per ogni bando restituisci: titolo, ente, importo, scadenza, stato, link"
- Chiama `POST https://api.browser-use.com/api/v3/sessions` con structured output (JSON schema per lista bandi)
- Polling del task fino a completamento
- Restituisce i risultati strutturati al frontend
- CORS headers inclusi

**3. Aggiornare `src/pages/BandiPubbliciPage.tsx`**
- La funzione `cercaBandi` chiama la edge function via `supabase.functions.invoke('cerca-bandi', { body: filtri })`
- Mostra spinner durante l'attesa (può richiedere 30-60s per la navigazione AI)
- Messaggio che indica "Il browser AI sta cercando bandi..." durante il caricamento
- Popola i risultati con i dati restituiti

### File coinvolti

| File | Azione |
|------|--------|
| Secret `BROWSER_USE_API_KEY` | Aggiungere tramite tool |
| `supabase/functions/cerca-bandi/index.ts` | Nuovo — edge function con Browser Use API v3 |
| `src/pages/BandiPubbliciPage.tsx` | Aggiornare cercaBandi per chiamare edge function |

### Note
- Browser Use può impiegare 30-60 secondi per completare la ricerca (naviga siti reali)
- Il task verrà ottimizzato man mano che testiamo i risultati
- Si potranno aggiungere altri siti di bandi in futuro modificando il prompt

