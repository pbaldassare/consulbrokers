## Modifica

In `src/pages/ClienteDetail.tsx` (righe ~1810-1828) rimuovo il `<Button>` "Chiedi all'AI" posizionato tra "Nuova Polizza" e "Genera Precontrattuale" nell'header del dettaglio cliente.

Nessun'altra modifica: l'import di `Sparkles` e l'helper `pushAiEntityContext` restano se usati altrove (verifico e, se non più referenziati nel file, rimuovo anche gli import per evitare warning lint).

## Impatto
- UI: header cliente più pulito (Attivo · Nuova Polizza · Genera Precontrattuale).
- L'Assistente IA resta accessibile dalla sidebar; nessuna logica di business toccata.