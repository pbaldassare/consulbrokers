## Causa
La tabella `rca_usi` contiene **43 righe attive** ma molte sono duplicati esatti dello stesso `(codice, descrizione)`:

| codice + descrizione | righe |
|---|---|
| `1 - CONTO PROPRIO` | 5 |
| `2 - CONTO TERZI` | 3 |
| `1 - PRIVATO` | 3 |
| `2 - LOCAZIONE SENZA CONDUC.` | 2 |
| `13 - Trasporto C/Proprio` | 2 |
| `14 - Trasporto C/Terzi` | 2 |
| `15 - Uso Speciale` | 2 |

Sono 12 righe duplicate (43 → 31 distinte). Probabile esito di import multipli storici. La hook `useRcaUsi` mostra ogni record, quindi appaiono ripetuti nella select.

Restano poi alcune **descrizioni simili ma con codice diverso** (legittime varianti ANIA), es. `1 CONTO PROPRIO` vs `5 CONTO PROPRIO`, `5 SCUOLA GUIDA` vs `8 SCUOLA GUIDA`. Quelle NON sono duplicati tecnici e vanno mantenute (codici differenti = significati differenti per le compagnie).

## Verifica utilizzo
Nessun record in `veicoli_polizza.uso` referenzia attualmente questi id (campo testuale, non FK). La pulizia è quindi sicura.

## Soluzione

**Migrazione SQL** che disattiva (`attivo=false`) i duplicati esatti per `(codice, descrizione)`, conservando per ciascun gruppo l'`id` più piccolo (deterministico).

```sql
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY codice, descrizione
           ORDER BY id
         ) AS rn
  FROM rca_usi
  WHERE attivo = true
)
UPDATE rca_usi
SET attivo = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
```

Risultato atteso: lookup passa da 43 → 31 voci, senza ripetizioni nella select "Uso".

## Fuori scopo
- Non unifico le varianti maiuscole/minuscole (`Trasporto C/Proprio` vs `TRASPORTO CONTO PROPRIO`) né le descrizioni simili: hanno codici ANIA diversi e cancellarle può rompere logiche o report.
- Nessuna modifica al frontend.