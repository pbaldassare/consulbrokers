

## Problema: Tutte le righe mostrano "N/D" come nome compagnia

### Causa
La query dei titoli (riga 58) non dipende dal risultato della query `compagnie` (riga 36). Quando i titoli vengono caricati prima che la lista compagnie sia pronta, la `compagniaMap` è vuota e tutti i nomi risultano "N/D".

I dati nel DB sono corretti — tutte le compagnie sono attive e i `compagnia_id` nei titoli corrispondono a record reali. È un bug di **race condition** nel frontend.

### Soluzione

**File: `src/pages/contabilita/ECCompagniaContabPage.tsx`**

1. Aggiungere `compagnie` come dipendenza nella `queryKey` della query titoli (riga 59), oppure usare `enabled: !!compagnie` per attendere il caricamento delle compagnie prima di eseguire la query principale.

2. In alternativa (più robusto): fare il join direttamente nella query Supabase con `.select("..., compagnie!inner(nome, codice, comune, mail)")`, eliminando la necessità della `compagniaMap` separata.

**Approccio scelto**: opzione 2 — join diretto nella select, così i nomi arrivano insieme ai titoli senza dipendenze esterne. Rimuove la query separata `compagnie-ec` per il mapping (la mantiene solo per i filtri).

### Modifiche concrete
- Nella query titoli: aggiungere `compagnie(nome, codice, comune, mail)` nel select
- Nel loop di aggregazione: leggere il nome da `(t as any).compagnie?.nome` invece che dalla map
- Rimuovere la dipendenza da `compagniaMap` nel raggruppamento

