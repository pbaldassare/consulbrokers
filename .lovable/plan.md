

## Piano: Completare il flusso di pagamento rimesse in EC Compagnia

### Problema principale
I titoli già pagati (presenti in `rimessa_dettaglio`) continuano a comparire nella lista EC Compagnia. Dopo il pagamento dovrebbero sparire da qui e restare solo nello Storico Rimesse.

### Modifiche

**1. `src/pages/contabilita/ECCompagniaContabPage.tsx`**

- **Escludere titoli già rimessi**: nella query, recuperare tutti gli ID da `rimessa_dettaglio` e filtrarli lato client (come già fa l'edge function), oppure meglio: aggiungere una subquery per escluderli. Poiché PostgREST non supporta `NOT IN` su subquery, si recuperano i `titolo_id` da `rimessa_dettaglio` in una query parallela e si filtrano lato JS prima del grouping.
- **AlertDialog di conferma pre-dialog**: prima di aprire il dialog "Paga Rimessa", mostrare un AlertDialog che riepiloga quanti titoli e l'importo totale, con "Procedi" / "Annulla". Solo dopo il "Procedi" si apre il dialog con IBAN/importo/note.
- **Ricalcolare "Da Rimettere"**: togliere la colonna "Già Rimesso" (non serve più se i titoli rimessi sono esclusi — il saldo sarà sempre lordo - provvigioni). Oppure mantenere "Già Rimesso" come KPI globale per riferimento.

**2. Flusso popup a 2 livelli**:
1. Click "Paga Rimessa" → **AlertDialog**: "Stai per creare una rimessa per [Compagnia] con N titoli per un totale di €X. Vuoi procedere?"
2. Conferma → **Dialog** con IBAN, importo (modificabile), note
3. Click "Conferma Pagamento" → invocazione edge function → redirect a Storico Rimesse

**3. Aggiornamento post-pagamento**: dopo `onSuccess`, invalidare queries per far sparire i titoli pagati dalla vista.

### File coinvolti
- `src/pages/contabilita/ECCompagniaContabPage.tsx` — filtro titoli rimessi + AlertDialog pre-conferma

