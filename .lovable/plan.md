

## Piano: Migliorare la ricerca bandi -- ente promotore, download PDF, salvataggio completo

### Problema attuale
- Il prompt chiede la "stazione appaltante" ma non enfatizza abbastanza l'ente promotore
- Non viene scaricato il PDF del bando
- I dati in DB non includono il documento PDF

### Modifiche

#### 1. Migrazione DB: aggiungere colonna `pdf_path` alla tabella `bandi_pubblici`
```sql
ALTER TABLE public.bandi_pubblici ADD COLUMN IF NOT EXISTS pdf_path text;
```
Per salvare il percorso del PDF nello storage Supabase.

#### 2. Edge Function `cerca-bandi/index.ts` -- migliorare il prompt
- Aggiungere al prompt l'istruzione esplicita di estrarre il **nome completo dell'ente/stazione appaltante che promulga il bando** (non solo "stazione appaltante" generico)
- Aggiungere il campo `"ente_tipo"` (es. Comune, ASL, Regione, Università, ecc.)
- Chiedere al browser AI di **navigare nella scheda di ogni bando e scaricare/copiare il link diretto al PDF del bando** (campo `"pdf_url"`)
- Mappare i nuovi campi nel `mapBando()`

#### 3. Edge Function `scarica-bando-pdf/index.ts` (nuova)
Nuova Edge Function che:
- Riceve `{ bando_id, pdf_url }` 
- Scarica il PDF dall'URL
- Lo carica nel bucket `documenti_generali` con path `bandi/{scheda_id}.pdf`
- Aggiorna `bandi_pubblici.pdf_path` con il path storage
- Gestisce CORS e autenticazione

#### 4. Frontend `BandiPubbliciPage.tsx`
- Mostrare l'ente in modo più prominente nella card (con icona Building)
- Aggiungere bottone "Scarica PDF" per ogni bando con `pdf_url`
- Il bottone chiama la nuova Edge Function per scaricare e salvare il PDF
- Se il PDF è già salvato (`pdf_path` presente), mostrare un link diretto allo storage
- Aggiungere nella card il campo `ente_tipo` se disponibile

#### 5. Upsert aggiornato
- Salvare anche `pdf_url` e `ente_tipo` nel DB (dopo migrazione)

### File coinvolti

| File | Modifica |
|------|----------|
| Migrazione SQL | Aggiunta colonne `pdf_path`, `pdf_url`, `ente_tipo` |
| `supabase/functions/cerca-bandi/index.ts` | Prompt migliorato + nuovo campo nel mapping |
| `supabase/functions/scarica-bando-pdf/index.ts` | Nuova funzione per download e storage PDF |
| `src/pages/BandiPubbliciPage.tsx` | UI migliorata per ente + bottone scarica PDF |

### Dettagli tecnici

**Prompt migliorato** (estratto chiave):
> Per ogni bando, estrai il nome COMPLETO dell'ente che promulga/pubblica il bando (es. "Comune di Milano", "ASL Roma 1", "Università degli Studi di Bologna"), il tipo di ente (Comune, ASL, Regione, Università, Ministero, Azienda Ospedaliera, ecc.), e il link diretto al documento PDF del bando se disponibile nella pagina di dettaglio.

**Edge Function scarica-bando-pdf**: usa `fetch()` per scaricare il PDF dall'URL, poi `supabase.storage.from('documenti_generali').upload()` per salvarlo, infine aggiorna il record in DB.

