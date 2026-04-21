

## Richiesta

Nel form **Modifica Importi** (`TitoloDetail.tsx`), nel blocco **Firma**: quando cambio il **Premio Netto** (o Tasse / Addizionali), il **Premio Lordo** deve aggiornarsi automaticamente, non solo essere "suggerito" da cliccare manualmente.

## Stato attuale

Riga 2001-2010: il campo Premio Lordo Firma è editabile a mano e mostra una scritta "💡 Calcolato: € X (clicca per applicare)" che richiede un click per essere applicato.

## Soluzione

### Auto-aggiornamento Premio Lordo Firma

Modifica negli `onChange` dei tre campi che concorrono al lordo (Netto, Addizionali, Tasse) nel blocco Firma:
- Quando uno dei tre cambia → ricalcolo automaticamente `premio_lordo = netto + addizionali + tasse` e aggiorno il form
- Il campo `premio_lordo` resta comunque editabile manualmente (override consapevole), ma se l'utente tocca uno dei 3 input "sorgente" dopo, viene riallineato

### "Sticky override" (per non perdere modifiche manuali)

Tengo un flag locale `lordoFirmaTouched` (boolean):
- Se l'utente edita direttamente il campo Premio Lordo → flag = true
- Se l'utente edita Netto/Addizionali/Tasse → ricalcolo e resetto flag = false
- All'apertura del form (load da DB) → flag = false

Così il comportamento è: di default il lordo segue netto+add+tasse; se l'utente lo forza manualmente, resta forzato finché non tocca di nuovo gli input sorgente.

### UI

- Rimuovo la scritta "💡 Calcolato: € X (clicca per applicare)" sotto il lordo (non serve più, è automatico)
- Aggiungo una piccola scritta `Aggiornato automaticamente da Netto + Addizionali + Tasse` (testo helper grigio piccolo) sotto il campo, visibile solo quando NON è stato forzato manualmente
- Se forzato manualmente e diverso dal calcolato, mostro un piccolo warning ambra "⚠ valore manuale ≠ calcolato (€ X)"

### Stesso comportamento opzionale per Quietanza?

Lato Quietanza non c'è un campo `premio_lordo_quietanza` separato (è solo "Totale calcolato" in sola lettura), quindi nessuna modifica lì — già funziona auto.

## File toccati

- `src/pages/TitoloDetail.tsx`:
  - Aggiungo state `lordoFirmaTouched` (~3 righe)
  - Modifico onChange di `premio_netto`, `addizionali`, `tasse` (Firma) per ricalcolare il lordo (~10 righe)
  - Modifico onChange di `premio_lordo` per settare il flag touched (~3 righe)
  - Sostituisco la scritta "Calcolato (clicca per applicare)" con helper text condizionale (~5 righe)
  - Reset di `lordoFirmaTouched = false` quando si apre il form da `titolo` caricato

## Cosa NON faccio

- Non tocco la logica di auto-coerenza già presente nel `mutationFn` (resta come safety net al salvataggio)
- Non tocco il blocco Quietanza (totale già auto-calcolato in UI)
- Non modifico i flussi Immissione / Rinnovo / Appendici

## Verifica

1. Apro polizza → click "Modifica" su Importi
2. Cambio Premio Netto Firma da 11635,99 → 12000 → vedo Premio Lordo aggiornarsi a 12000+364,01+addizionali in tempo reale
3. Cambio manualmente Premio Lordo a 13000 → resta 13000, helper sparisce, compare warning
4. Cambio di nuovo Premio Netto → il lordo torna a essere ricalcolato e il warning sparisce
5. Salvo → DB coerente

