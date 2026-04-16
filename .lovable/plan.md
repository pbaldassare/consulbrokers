

## Piano: Annullamento rimessa con ripristino titoli a "carico del mese"

### Obiettivo
Aggiungere la possibilità di annullare una rimessa dallo Storico Rimesse, riportando i titoli inclusi allo stato `incassato` (cioè ancora "da rimettere" — visibili di nuovo in EC Compagnia). Il titolo resta incassato, torna semplicemente disponibile per una nuova rimessa.

### Logica
1. L'annullamento **elimina i record `rimessa_dettaglio`** della rimessa → i titoli tornano visibili in EC Compagnia (che filtra per `NOT IN rimessa_dettaglio`)
2. La rimessa viene marcata come `stato: "annullata"` (non cancellata, per storico)
3. Serve una nuova action `annulla` nella Edge Function `gestione-rimessa`

### Modifiche

**1. Edge Function `supabase/functions/gestione-rimessa/index.ts`** — nuova action `annulla`
- Riceve `rimessa_id` e `created_by`
- Cancella tutti i record da `rimessa_dettaglio` dove `rimessa_id` = id
- Aggiorna `rimessa_premi.stato` a `"annullata"`
- Log attività con azione `annullamento_rimessa`

**2. `src/pages/contabilita/StoricoRimessePage.tsx`** — pulsante annulla con AlertDialog
- Aggiungere colonna "Azioni" con pulsante "Annulla" (icona Undo) per ogni rimessa non già annullata
- AlertDialog di conferma: "Sei sicuro di voler annullare questa rimessa? I titoli torneranno disponibili per una nuova rimessa."
- Mutation che invoca `gestione-rimessa` con `action: "annulla"`
- Badge "Annullata" rosso per le rimesse annullate

**3. `src/pages/RimessaDetail.tsx`** — stesso pulsante annulla nel dettaglio
- Aggiungere pulsante "Annulla Rimessa" nella card Azioni (con AlertDialog)
- Dopo annullamento, redirect a Storico Rimesse

### File coinvolti
- `supabase/functions/gestione-rimessa/index.ts` — action `annulla`
- `src/pages/contabilita/StoricoRimessePage.tsx` — pulsante + AlertDialog + mutation
- `src/pages/RimessaDetail.tsx` — pulsante + AlertDialog + mutation

