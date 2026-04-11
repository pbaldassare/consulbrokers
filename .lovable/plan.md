

## Piano: Correggere il cambio stato nel modale trattativa

### Problema
Il cambio stato dalla pipeline nel modale non si riflette visivamente perché `selectedTrattativa` è una copia locale (snapshot) che non si aggiorna quando la query viene invalidata. Il dato in DB viene aggiornato correttamente, ma il modale continua a mostrare lo stato vecchio.

### Soluzione

**File: `src/pages/TrattativeList.tsx`**
- Dopo la mutazione di cambio stato, aggiornare anche `selectedTrattativa` con il nuovo stato tramite callback `onOpenChange` o un meccanismo di refresh.
- Passare una prop `onRefresh` al `TrattativaDetailDialog` che aggiorni `selectedTrattativa` con i dati freschi dalla query.

**File: `src/components/trattative/TrattativaDetailDialog.tsx`**
- Dopo il successo di `cambiaStato`, aggiornare lo stato localmente nel trattativa object (optimistic update) oltre a invalidare la query, oppure ricaricare i dati della trattativa dal DB.
- Approccio scelto: fare una `refetch` della singola trattativa dopo il cambio stato e propagare il dato aggiornato.

### Implementazione concreta
1. In `TrattativaDetailDialog`, dopo `cambiaStato.onSuccess`, fare un fetch diretto della trattativa aggiornata e usare uno stato locale per il dato corrente
2. In `TrattativeList`, passare un setter per aggiornare `selectedTrattativa` quando il dialog lo richiede

Modifica minima: usare `useState` locale nel dialog per tracciare lo stato corrente, sincronizzato con la prop ma aggiornabile dopo mutazione.

