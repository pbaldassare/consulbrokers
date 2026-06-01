## Problema

La quietanza generata automaticamente alla messa a cassa mostra `premio_lordo` 1921.95 invece di 1968.00. Il netto (1683.73), le tasse (238.22), l'SSN (46.05) e le provvigioni (188.20) sono identici tra polizza madre e quietanza: l'unico campo sbagliato è `premio_lordo` della rata successiva, che vale `netto + tasse` invece di `netto + tasse + ssn + addizionali`.

Causa: la funzione DB `genera_quietanza_su_messa_cassa` (trigger su `titoli` quando si passa a `incassato`) ricalcola `premio_lordo` senza includere l'SSN (e probabilmente nemmeno le addizionali).

## Intervento

1. **Migration** sulla funzione `genera_quietanza_su_messa_cassa`: nel blocco di INSERT della rata successiva, impostare
   `premio_lordo = COALESCE(premio_netto,0) + COALESCE(tasse,0) + COALESCE(ssn_firma,0) + COALESCE(addizionali,0)`
   coerentemente con il trigger `trg_titoli_normalizza_importi` già attivo sul resto dei titoli (memoria `accounting/lordo-cliente-netto-agenzia`).

2. **Backfill** una-tantum nella stessa migration:
   ```sql
   UPDATE titoli
   SET premio_lordo = COALESCE(premio_netto,0) + COALESCE(tasse,0) + COALESCE(ssn_firma,0) + COALESCE(addizionali,0)
   WHERE sostituisce_polizza IS NOT NULL
     AND data_messa_cassa IS NULL
     AND stato <> 'stornato'
     AND ABS(premio_lordo - (COALESCE(premio_netto,0)+COALESCE(tasse,0)+COALESCE(ssn_firma,0)+COALESCE(addizionali,0))) > 0.01;
   ```
   Così la quietanza 184667297 riga 1 torna a 1968.00 senza richiedere intervento manuale.

3. **Verifica**: rileggere la riga 184667297/1 e confermare `premio_lordo = 1968.00`; refresh della pagina cliente.

## Note

- Nessuna modifica al frontend o ai trigger di normalizzazione esistenti.
- Nessun impatto su polizze già messe a cassa correttamente (il filtro `ABS(...) > 0.01` evita aggiornamenti inutili).
- Il fix è coerente con la memoria `insurance/auto-quietanza-su-messa-cassa` e con `accounting/lordo-cliente-netto-agenzia`.
