## Problema
Sulla polizza 184667297 la card "Premio Lordo" mostra **1971,08 €** (aggregato corretto: netto 1686,81 + tasse 238,22 + SSN 46,05) ma l'header in alto mostra **Importo Firma 1925,03 €**. Causa: `titoli.premio_lordo` in DB è ancora il vecchio valore (senza SSN). Polizza già `incassato` → `TitoloImportiPremiBlock` è in `isLocked` e non riallinea.

Inoltre `provvigioni_firma` salva valori a 10 decimali (es. `188,5672000000`).

Regola che il cliente esprime:
- **Cliente paga sempre il LORDO** → header e E/C Cliente devono mostrare `premio_lordo = netto + tasse + ssn + addizionali`.
- **E/C Agenzie sempre al NETTO delle provvigioni** → la rimessa alla Compagnia è `premio_lordo − provvigioni` (logica già presente nel PDF E/C Agenzia, ma con `premio_lordo` errato il netto risultava sbagliato).

Conteggio attuale: **11 titoli su 32** hanno `premio_lordo` divergente dalla somma dei componenti.

## Modifiche

### 1. Migrazione DB (riallineamento dati esistenti)
- Update `titoli` impostando `premio_lordo = round(coalesce(premio_netto,0)+coalesce(tasse,0)+coalesce(ssn_firma,0)+coalesce(addizionali,0), 2)` dove diverge di > 0,01 €.
- Arrotondare `provvigioni_firma` e `provvigioni_quietanza` a 2 decimali per tutti i record.

### 2. Trigger DB (mantenimento futuro)
- Trigger `BEFORE INSERT OR UPDATE ON titoli`:
  - Ricalcola `premio_lordo = round(netto+tasse+ssn_firma+addizionali, 2)` ogni volta che cambia uno dei componenti (o quando `premio_lordo` non quadra).
  - Arrotonda `provvigioni_firma`, `provvigioni_quietanza`, `percentuale_provvigione` a 2/4 decimali (importi 2, percentuali 4).
- Non modifica i titoli con stato `incassato` per i campi diversi da `premio_lordo` (consistenza forte: il lordo deve sempre essere la somma reale).

### 3. Frontend
- `TitoloImportiPremiBlock`: anche con `isLocked = true`, ricalcola `premio_lordo` (sola colonna sicura) quando le righe `premi_garanzia_polizza` aggregate divergono dal DB. Non riscrive netto/tasse/SSN per non alterare lo storico.
- `PolizzaHeaderCard`: nessun cambio (già legge `t.premio_lordo`, che dopo migrazione sarà corretto).

### 4. Verifica E/C Agenzie
- `ECAgenziaPdfPage` espone già `premio` e `provvigioni` separati; il netto rimessa = `premio - provvigioni - r.a.`. Dopo la migrazione i totali saranno coerenti. Nessuna modifica codice.

### 5. Memoria
- Nuova memoria `mem://accounting/lordo-cliente-netto-agenzia` con le due regole:
  - Cliente: addebita sempre il lordo (`titoli.premio_lordo` = netto+tasse+SSN+addizionali).
  - Agenzia: rimessa = lordo − provvigioni (− R.A.).

## Non incluso
- Nessun cambio a UI cards Premio/Quietanza (già corrette).
- Nessun cambio agli E/C Clienti (allineati al filtro `data_messa_cassa` nella patch precedente).

## Verifica
- Polizza 184667297: header passa da 1925,03 € a **1971,08 €**; provvigioni 188,57.
- E/C Agenzia per questa polizza: premio 1971,08 − provvigioni 188,57 = **1782,51 €** rimessa.
- Query di controllo: `select count(*) from titoli where abs(premio_lordo-(premio_netto+tasse+ssn_firma+addizionali))>0.01` → 0.
