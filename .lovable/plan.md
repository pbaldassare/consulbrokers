## Conto bancario inline per ogni Rapporto (no select)

Stesso pattern usato per l'agenzia in `CompagnieList`: niente più dropdown, ma campi inline che vengono persistiti in `conti_bancari` e collegati al rapporto.

### Modifiche a `RapportiCompagniaDialog.tsx`

**Rimuovo** `ContoBancarioSelect` dal form.

**Aggiungo** al form (sostituendo l'attuale campo "Conto bancario dedicato"):

| Campo | Tipo | Note |
|---|---|---|
| Etichetta conto | text | es. "Conto Nobis Torino" |
| Banca | text | es. "Intesa Sanpaolo" |
| IBAN | text | uppercase, no spazi, validazione IT 27 char |
| Intestato a | text | fallback automatico = `nome_rapporto` o "Compagnia + sede" |
| BIC | text (opz.) | |
| ABI · CAB | text (opz.) | |
| Note conto | text (opz.) | |

### Persistenza

Helper `persistContoRapporto(rapportoNomeFallback, form)`:
- Se IBAN vuoto → ritorna `null` (nessun conto, fallback al conto della compagnia madre).
- Se IBAN valorizzato:
  - Validazione: `intestato_a` derivato (form → `nome_rapporto` → ragione sociale agenzia). Banca fallback "Banca da definire".
  - `INSERT` (creazione nuovo rapporto) o `UPDATE` (modifica) sulla riga `conti_bancari` con `tipo='agenzia'`.
  - Ritorna l'`id` del conto.

`saveMutation`:
```text
1. Validazione form (nome_rapporto, gruppo_compagnia_id, IBAN se presente)
2. INSERT/UPDATE su compagnia_rapporti (senza conto_bancario_id se nuovo)
3. try { contoId = persistContoRapporto(...) ; UPDATE compagnia_rapporti SET conto_bancario_id }
   catch (errore conto) { DELETE rapporto appena creato → rollback ; rethrow }
```

In edit, se l'utente svuota l'IBAN, mettere `conto_bancario_id=null` (il record `conti_bancari` resta — non lo elimino per non rompere riferimenti storici, ma non è più collegato).

### Caricamento in edit

`useEffect` quando si apre `openEdit(r)`: se `r.conto_bancario_id` è valorizzato, fetch da `conti_bancari` e popola i campi (`etichetta`, `banca`, `iban`, `intestato_a`, `bic`, `abi`, `cab`, `note`).

### UI tabella rapporti

Aggiungo colonna **IBAN** (ultime 4 cifre del conto collegato) tramite join `conti_bancari!conto_bancario_id(iban, etichetta)`.

### File toccati

- `src/components/compagnie/RapportiCompagniaDialog.tsx` (unico file).
- Nessuna migration DB necessaria (la tabella `conti_bancari` esiste già, `compagnia_rapporti.conto_bancario_id` esiste già).

---

Confermi?