# Perché segreteria@ (Napoli) vede TESTA MAURIZIO (Bergamo)

Il cliente è correttamente assegnato a `ufficio_id = Bergamo`, e il profilo di `segreteria@consulbrokers.it` è correttamente su `Napoli`. Il problema sta nelle RLS: nella migration di provisioning sono state create **due famiglie di policy** per il ruolo `ufficio`:

- `Ufficio select/update/delete own ...` → filtra per `ufficio_id = get_my_ufficio_id()` ✅
- `Ufficio global select/update/delete ...` → permette tutto se `has_role(auth.uid(),'ufficio')` ❌

In Postgres le policy permissive sono in **OR**: basta la seconda per vedere/modificare qualunque riga. Risultato: ogni responsabile sede vede l'intero database.

Tabelle coinvolte: `clienti`, `titoli`, `sinistri`, `movimenti_contabili`.

## Fix proposto (una sola migration)

Per ciascuna delle 4 tabelle, **droppare** le policy `Ufficio global *` (SELECT, UPDATE, DELETE, INSERT-global) e tenere solo quelle `... own ...`, già scritte correttamente:

- USING: `has_role(auth.uid(),'ufficio') AND ufficio_id = get_my_ufficio_id()`
- WITH CHECK (insert/update): idem

L'admin mantiene visibilità totale tramite la policy `Admin all ...` (già presente, basata su `has_role(... ,'admin')`).
CFO / contabilità / produttore / cliente: invariati.

## Effetti attesi

- segreteria@ (Napoli) → vede solo clienti/titoli/sinistri/movimenti con `ufficio_id = Napoli`.
- TESTA MAURIZIO (Bergamo) sparisce dalla lista Clienti di Napoli.
- Admin principale: vede tutto come prima.
- Nessuna modifica al codice frontend.

## Verifica post-migration

1. Re-login come `segreteria@consulbrokers.it` → `/archivi/clienti` non mostra più TESTA MAURIZIO.
2. Login come admin → lista completa invariata.
3. Spot-check su `/portafoglio/carico` e `/sinistri` per la stessa sede.

## Dettagli tecnici

Policy da droppare (12 totali):

```
clienti:               Ufficio global select|insert|update|delete clienti
                       Ufficio select all clienti
titoli:                Ufficio global insert|update|delete titoli
                       Ufficio select all titoli
sinistri:              Ufficio global insert|update|delete sinistri
                       Ufficio select all sinistri
movimenti_contabili:   Ufficio global insert|update|delete movimenti_contabili
                       Ufficio select all movimenti
```

Le policy `Ufficio ... own ...` restano invariate e diventano le uniche attive per il ruolo `ufficio`.
