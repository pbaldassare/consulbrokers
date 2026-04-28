## Obiettivo

Nella tab **Compagnie** (gruppi madre, tabella `gruppi_compagnia`) eliminare i duplicati che differiscono solo per maiuscole/minuscole (o spazi), unendoli in un'unica voce e ricollegando tutte le agenzie figlie.

## Duplicati rilevati nel DB

Il check case-insensitive su `gruppi_compagnia.descrizione` ha trovato 4 coppie:

| Norm. | Voce A (codice / descr / n. agenzie) | Voce B (codice / descr / n. agenzie) |
|---|---|---|
| AIG | GC001 / "AIG" / 5 | GC011 / "Aig" / 1 |
| ASSIMOCO | GC007 / "ASSIMOCO" / 0 | GC019 / "Assimoco" / 1 |
| ROLAND | GC105 / "ROLAND" / 1 | GC109 / "Roland" / 1 |
| PLURIMANDATARIO | PLURIMANDATARIO / "PLURIMANDATARIO" / 54 | GC099 / "Plurimandatario" / 86 |

Nessun altro duplicato esatto (case-insensitive + trim) presente. La tabella `compagnie` (le 649 agenzie/sedi) non contiene nomi duplicati.

## Strategia di merge

Per ogni coppia: scegliere un **vincitore** (quello da tenere) e un **perdente** (da eliminare). Regole:

1. **PLURIMANDATARIO**: si tiene la riga con `codice = 'PLURIMANDATARIO'` (è il fallback di sistema riconosciuto dal codice in `CompagnieList.tsx` tramite la costante `PLURIMANDATARIO_CODE` e dalla edge function `import-compagnie`). Le 86 agenzie collegate a "Plurimandatario" (GC099) verranno spostate sotto "PLURIMANDATARIO".
2. **AIG / ASSIMOCO / ROLAND**: si tiene la riga in **MAIUSCOLO** (allineato alle convenzioni di `GRUPPI_STATISTICI` in `CompagnieList.tsx`, tutte maiuscole). Codici tenuti: GC001, GC007, GC105.

### Migrazione SQL (in un'unica transazione)

Per ciascuna coppia, nello stesso ordine:

```sql
-- Sposta le agenzie figlie dal "perdente" al "vincitore"
UPDATE compagnie
SET gruppo_compagnia_id = '<id_vincitore>',
    gruppo_compagnia    = '<descrizione_vincitore>'
WHERE gruppo_compagnia_id = '<id_perdente>';

-- Elimina la riga duplicata
DELETE FROM gruppi_compagnia WHERE id = '<id_perdente>';
```

Nessuna FK formale punta a `gruppi_compagnia` (verificato su `information_schema`); l'unica colonna applicativa che la referenzia è `compagnie.gruppo_compagnia_id` (le tabelle `compagnie_snapshot_*` sono backup storici e restano intatte).

Inoltre, allineamento del campo denormalizzato `compagnie.gruppo_compagnia` (testo) ai casi corretti in maiuscolo per coerenza visiva nella select "Compagnia / Agenzia di rif." già introdotta.

## Prevenzione futura

Aggiungere un **unique index case-insensitive** su `gruppi_compagnia` per evitare il rientro di duplicati:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS gruppi_compagnia_descrizione_ci_uniq
  ON public.gruppi_compagnia (UPPER(TRIM(descrizione)));
```

E, lato UI (`CompagnieMadriTab` in `src/pages/CompagnieList.tsx`), nelle mutation `create` ed `update` aggiungere un check preventivo: se esiste già un gruppo con `UPPER(TRIM(descrizione))` uguale (escludendo l'id corrente in update), mostrare toast di errore "Esiste già una compagnia con questo nome" senza chiamare il DB.

## Cosa NON viene fatto

- Nessun cambio di schema su `compagnie` (i 649 record sono già univoci).
- Nessuna modifica alle tabelle snapshot di backup (`compagnie_snapshot_post_dedup`, `compagnie_snapshot_round2`).
- Nessuna modifica al fallback applicativo `PLURIMANDATARIO_CODE` (continua a funzionare, anzi diventa univoco).

## File toccati

- **Migrazione DB**: 4 merge + 4 delete + 1 unique index (un'unica migration).
- `src/pages/CompagnieList.tsx`: aggiunta validazione anti-duplicato (case-insensitive) nelle mutation `createMutation` e `updateMutation` di `CompagnieMadriTab`.
