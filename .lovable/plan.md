## Sostituzione select Banca in MessaCassaDialog

Sostituire la lista hardcoded di banche italiane con i **conti Consulbrokers di tipo `generico`**, usando il componente `ContoBancarioSelect` (già dotato di ricerca tramite `SearchableSelect`), coerente con il popup "Paga Rimessa".

### Modifica unica: `src/components/portafoglio/MessaCassaDialog.tsx`

1. Rimuovere costante `bancheItaliane` e import `Select`/`SelectItem` dove non più necessari per la banca.
2. Importare `ContoBancarioSelect` da `@/components/anagrafiche/ContoBancarioSelect`.
3. Quando `tipoPagamento === "bonifico"`, rendere `<ContoBancarioSelect tipi={["generico"]} value={contoId} onChange={...} />` al posto della select hardcoded.
4. Mantenere il campo DB esistente `titoli.banca_pagamento` (text): salvare l'etichetta del conto selezionato (`etichetta` o `etichetta — IBAN`) lookuppata dal record `conti_bancari`. Nessuna modifica di schema.
5. Validazione: bottone "Conferma Incasso" disabilitato finché `tipoPagamento === "bonifico"` e nessun conto selezionato (come oggi con la banca).

### Fuori scope
- Nessuna migration DB.
- Nessuna modifica al flow singola/bulk: il dialog è già condiviso.
- Le altre modalità (Contanti, POS, Assegno) restano invariate.
