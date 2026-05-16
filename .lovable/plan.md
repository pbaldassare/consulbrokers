## Problemi rilevati dai log

1. **`intestato_a` obbligatorio in `conti_bancari`** ma il form lo invia vuoto → `23502 not-null constraint`.
2. **Agenzia orfana** — `compagnie` viene creata prima del conto; se il conto fallisce, l'agenzia resta salvata e il codice resta occupato → al retry parte `23505 duplicate codice`.
3. **Messaggio d'errore poco chiaro** — il toast mostra il messaggio Postgres grezzo.

## Soluzione (solo `src/pages/CompagnieList.tsx`)

### A. Default e validazione in `persistContoAgenzia`
- Se `conto_intestato_a` è vuoto → fallback a `form.nome` (ragione sociale).
- Se `conto_iban` valorizzato ma `conto_banca` vuoto → fallback "Banca da definire" (così l'etichetta resta sensata).
- Validazione preventiva: se IBAN compilato senza intestatario derivabile (anche `nome` vuoto) → throw con messaggio chiaro "Specifica l'intestatario del conto".

### B. Rollback in `createMutation`
```ts
const { data: created } = await supabase.from("compagnie").insert(...).select("id").single();
const newId = created.id;
try {
  const contoId = await persistContoAgenzia(newId, form);
  if (contoId) await supabase.from("compagnie").update({ conto_bancario_id: contoId }).eq("id", newId);
} catch (e) {
  // rollback: elimina la compagnia appena creata per liberare il codice
  await supabase.from("compagnie").delete().eq("id", newId);
  throw e;
}
```

### C. Messaggi d'errore amichevoli
Estendere `onError` per mappare:
- `23502` con "intestato_a" → "Manca l'intestatario del conto bancario"
- `23505` con "codice" → "Codice già in uso" (già presente)
- altri → messaggio originale

## Note
- Nessuna migrazione DB: la `NOT NULL` su `intestato_a` resta (è corretta — un conto senza intestatario non ha senso).
- Le agenzie "orfane" già salvate nei tentativi precedenti (`5fcb5e72…`, `bca0c964…`) restano in tabella; posso ripulirle con una migration se confermi.
