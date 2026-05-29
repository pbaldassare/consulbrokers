## Problema
La edge function `supabase/functions/notifica-messa-cassa-agenzia/index.ts` è già implementata (genera HTML formale, risolve destinatario `rapporto.email_messe_a_cassa → compagnia.email_messe_a_cassa → fallback pscarpelli@consulbrokers.it`, invoca `send-email`, logga su `log_attivita`) ma **non viene mai invocata dal frontend**. Una ricerca su tutto il repo non trova alcun `invoke("notifica-messa-cassa-agenzia")`. Quindi nessuna email parte quando si mette a cassa una polizza.

## Fix

### 1. `src/components/portafoglio/MessaCassaDialog.tsx`
Dopo l'`update` di `titoli` (riga ~67) e dopo il fire-and-forget di `calcola-provvigioni` (riga ~96), aggiungere per ogni titolo messo a cassa:

```ts
supabase.functions.invoke("notifica-messa-cassa-agenzia", {
  body: { titolo_id: t.id }
}).catch((e) => console.error("notifica messa a cassa failed", e));
```

Fire-and-forget come `calcola-provvigioni`: non blocca l'UX, errori solo in console + log_attivita lato server.

### 2. Verifica altri punti di messa a cassa
Controllare se anche queste pagine settano `data_messa_cassa` direttamente senza passare dal dialog, e in tal caso aggiungere la stessa invoke:
- `src/pages/contabilita/ECClientiContabPage.tsx`
- `src/pages/contabilita/ECCompagniaContabPage.tsx` (azione "messa a cassa massiva", se presente)
- `src/pages/contabilita/ContabilitaUfficio.tsx`

Se l'update passa da una edge function (es. `gestione-rimessa`), valutare se chiamare la notifica lato server invece che dal client (più affidabile). In prima battuta resto sul client per non toccare altro.

### 3. Test manuale
- Annullare la messa a cassa sulla polizza 184667297 (Campobasso) e rifarla → verificare che parta l'email a `pscarpelli@consulbrokers.it` (fallback, dato che agenzia Campobasso non ha `email_messe_a_cassa` configurata).
- Controllare `log_attivita` per la riga `notifica_messa_cassa_inviata`.

## Fuori scope
- Non tocco la edge function (già OK).
- Non aggiungo nuovi campi email su compagnie/rapporti (già esistono `email_messe_a_cassa`).
- Non modifico template HTML né wording.