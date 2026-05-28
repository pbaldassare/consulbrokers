## Diagnosi

In `/contabilita/ec-agenzia/in-pagamento` le 3 rimesse di Campobasso mostrano `0,00 €` e 0/0/1 titoli. Verifica DB:

- Solo 1 titolo della compagnia è in stato `incassato` (n° 184667297, premio_lordo 1.971,08) ma ha `importo_incassato = NULL`.
- 1 rimessa contiene quel titolo con `importo = 0` (perché l'edge function copia `importo_incassato`, che è NULL).
- Le altre 2 rimesse sono completamente vuote (0 dettagli) → la guard "Nessun titolo disponibile" non è scattata perché un titolo era ancora disponibile al primo click, ma evidentemente sono state create con doppi click prima che la lista venisse aggiornata.

Due bug indipendenti:

1. **Edge function `metti_in_pagamento`** (`supabase/functions/gestione-rimessa/index.ts`, riga 86 e 107): usa `importo_incassato` come fonte sia per il totale che per il dettaglio → se la messa-a-cassa non lo ha popolato (NULL), tutto va a zero.
2. **UI `ECCompagniaContabPage`** permette doppi click consecutivi sullo stesso set di titoli prima dell'invalidazione → rimesse fantasma.

## Modifiche

### 1. Edge function `gestione-rimessa` (azione `metti_in_pagamento`)
- Estendere la select titoli a: `id, importo_incassato, premio_lordo`.
- Calcolare `importo_da_rimettere = importo_incassato ?? premio_lordo` per ogni titolo.
- Usare quel valore sia in `totale` che in `dettagli[].importo`.
- Idem per azione `crea` (legacy compagnie) per coerenza.

### 2. Pulizia dati
Migration one-shot per cancellare le 2 rimesse vuote correnti (id `191e6b3c-...` e `f218e86e-...`) e ricalcolare l'importo del dettaglio della rimessa `17948caf-...` (settandolo a 1971.08 = `premio_lordo`) e il suo `totale_importi`.

### 3. UI `ECCompagniaContabPage.tsx`
- Disabilitare la CTA "Metti in pagamento" se `mettiInPagamentoMutation.isPending` (anti doppio-click).

### Fuori scope
- Non si modifica la logica "messa a cassa" che lascia `importo_incassato` NULL (richiede analisi a parte).
- Nessun cambio a `ECClientePdfPage` / E/C clienti / E/C produttori.

## Risultato atteso
Dopo la fix: la rimessa esistente di Campobasso mostra €1.971,08 con 1 titolo; non si creano più rimesse vuote; futuri "metti in pagamento" funzionano anche se `importo_incassato` è NULL (fallback su `premio_lordo`).