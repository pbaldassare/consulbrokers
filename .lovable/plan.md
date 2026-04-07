

## Piano: Multi-regione e keyword fissa "Brokeraggio assicurativo"

### Modifiche

**1. `src/pages/BandiPubbliciPage.tsx`**
- Rimuovere i chip keyword — la ricerca usa sempre "Brokeraggio assicurativo" come keyword fissa (precompilata e non modificabile, o nascosta)
- Cambiare il filtro regione da selezione singola a **selezione multipla** con checkbox: l'utente può selezionare piu regioni contemporaneamente
- Mostrare le regioni selezionate come badge/chip rimovibili
- Il campo keyword diventa read-only con valore "Brokeraggio assicurativo" oppure viene nascosto del tutto (l'utente cerca solo per regione/data/importo)

**2. `supabase/functions/cerca-bandi/index.ts`**
- Il parametro `regione` diventa un array di stringhe `regioni: string[]`
- Il prompt Browser Use elenca tutte le regioni selezionate: "Cerca bandi nelle regioni: Piemonte, Lombardia, Lazio"
- La keyword nel prompt diventa fissa: "brokeraggio assicurativo" (ignorando eventuali keyword dal frontend)

### Dettaglio UI regioni multi-select
- Un dropdown con checkbox per ogni regione + "Seleziona tutte"
- Sotto il dropdown, badge rimovibili per le regioni selezionate
- Il conteggio regioni selezionate visibile nel trigger del dropdown

### File coinvolti

| File | Azione |
|------|--------|
| `src/pages/BandiPubbliciPage.tsx` | Rimuovere chip, keyword fissa, regione multi-select |
| `supabase/functions/cerca-bandi/index.ts` | Accettare array regioni, keyword fissa nel prompt |

