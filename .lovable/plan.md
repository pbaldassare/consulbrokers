## Obiettivo
Rimuovere il campo **Tipo Portafoglio** dall'UI delle pagine titolo (mantenendolo in DB per compatibilità con dati esistenti).

## Modifiche

### `src/pages/TitoloDetail.tsx`
- Rimuovere `FieldRow "Tipo Portafoglio"` (riga 1722) dalla vista contratto.
- Rimuovere il blocco `<Label>` + `SearchableSelect` per `tipo_portafoglio` in modalità edit (righe ~1795-1801).
- Rimuovere `tipoPortafoglioOpts` (riga 392) e il campo dal `contrattoForm` initial state (riga 379), dal reset (riga 483), dall'array dei campi salvati (riga 505) e dal payload mutation (riga 518).

### `src/pages/ImmissionePolizzaPage.tsx`
- Rimuovere lo state `tipoPortafoglio` (riga 56).
- Rimuovere il campo dal payload di insert (riga 402) — il default DB resta `null`/legacy.
- Rimuovere il blocco UI `<Label>Tipo Portafoglio</Label> + SearchableSelect` (righe 719-720+).

### `src/components/polizze/RinnovoTitoloDialog.tsx`
- Rimuovere `tipo_portafoglio: "rinnovo"` (riga 245) dal payload — lasciare il campo a `null`.

## Non toccato
- Schema DB: la colonna `titoli.tipo_portafoglio` resta (no migration), per non rompere dati storici e altre query.
- `types.ts`: rigenerato automaticamente.

## Verifica
- Aprire un titolo: nessuna riga "Tipo Portafoglio" visibile.
- In modifica contratto: campo assente.
- Immissione polizza: form senza il select.
- Rinnovo titolo: funziona normalmente.