## Causa

Salvando la polizza, il payload verso `titoli` include `gruppo_compagnia_id`, ma la tabella `titoli` **non ha** quella colonna → Postgrest risponde `PGRST204: Could not find the 'gruppo_compagnia_id' column of 'titoli'`.

La compagnia madre è già derivabile via `compagnia_rapporto_id → compagnia_rapporti.gruppo_compagnia_id`, quindi non serve duplicarla in `titoli`.

## Fix

In `src/pages/ImmissionePolizzaPage.tsx` (funzione `finalizzaPolizza`, intorno alla riga 1011): **rimuovere `gruppo_compagnia_id` dal payload `insert` su `titoli`**. Lo stato locale può restare per uso UI/filtri.

## Fuori scope

- Nessuna migration: non aggiungiamo colonne ridondanti.
- Lettura/join `gruppo_compagnia_id` in altre query: già funzionano via `compagnia_rapporti`.
