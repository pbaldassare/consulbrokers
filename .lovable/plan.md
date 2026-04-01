

## Piano: Fix RLS sinistri per utente cliente

### Problema
I sinistri esistono nel DB (8 record) ma il cliente "Comune di Varese" non li vede perche:

1. **Manca il ruolo nella tabella `user_roles`**: l'utente `746c540d-...` non ha il ruolo `cliente` in `user_roles`, quindi `has_role(auth.uid(), 'cliente')` ritorna `false`
2. **La RLS policy e sbagliata**: la policy "Cliente select own sinistri" controlla `cliente_id = auth.uid()`, ma i sinistri usano `cliente_anagrafica_id` (non `cliente_id`), e il mapping utente-cliente passa tramite la funzione `get_my_cliente_ids()`

### Soluzione (1 migrazione SQL)

1. **Inserire il ruolo `cliente`** per l'utente nella tabella `user_roles`
2. **Sostituire la RLS policy** "Cliente select own sinistri" con una che controlla `cliente_anagrafica_id IN (SELECT * FROM get_my_cliente_ids())` — lo stesso pattern gia usato nelle query frontend e nella policy dei titoli

### File coinvolti

| File | Azione |
|------|--------|
| Migrazione SQL | INSERT user_role + DROP/CREATE policy sinistri |

Nessuna modifica ai file frontend.

