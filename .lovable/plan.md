## Diagnosi
Cliccando "Applica" sul bulk-apply non viene fatta nessuna chiamata POST/PATCH a `provvigioni_compagnia_ramo`. Causa root:

- L'`upsertMutation` usa `.upsert(payload, { onConflict: "compagnia_rapporto_id,gruppo_ramo_id,ramo_id" })`.
- In DB esiste solo un **indice unico PARZIALE** (`provv_rapporto_gr_ramo_unique` con `WHERE attiva = true AND gruppo_ramo_id IS NOT NULL`), **non un constraint**. PostgREST non può usare indici parziali come target di `ON CONFLICT` → l'upsert fallisce con errore "no unique or exclusion constraint matching…", che viene mostrato brevemente nel toast e poi sparisce.
- Inoltre il flusso passa per un `AlertDialog` di conferma che aggiunge frizione per un'operazione non distruttiva.

## Fix

### 1. Riscrivere `upsertMutation` senza `.upsert()` (file `src/components/compagnie/ProvvigioniRapportiTab.tsx`)
Le righe in input hanno già `id` quando esistono (vengono da `provvMap`). Quindi splittare:
- Righe con `id` → `update({ percentuale_provvigione, attiva: true }).eq("id", r.id)`
- Righe senza `id` → `insert(payload)` in batch
Eseguire in parallelo con `Promise.all`, propagare il primo errore.
Questo elimina la dipendenza dal constraint mancante e funziona per tutti i casi (default ramo con `ramo_id=null` incluso).

### 2. Rimuovere la conferma `AlertDialog` per il bulk-apply non distruttivo
- Se `overwrite === false` → applicare direttamente senza dialog (sono solo righe nuove, non distruttivo).
- Mantenere la conferma solo quando `overwrite === true` (sovrascrive valori esistenti) e per il `Reset sottorami` (cancella override).

### 3. Toast più chiari
- Aggiungere nel `onError` di `upsertMutation` il messaggio Postgres pulito (era già lì, ma con il nuovo flusso senza upsert sarà più affidabile).
- Sul success del bulk-apply mostrare il numero di righe applicate: `toast.success(\`Applicata % a ${n} sottorami\`)`.

## Out of scope
- Nessuna migrazione DB necessaria. L'indice parziale esistente continua a proteggere dai duplicati a livello DB; semplicemente non lo usiamo come ON CONFLICT da PostgREST.
- Nessuna modifica al calcolo provvigioni o alla catena di risoluzione.

## File toccati
- `src/components/compagnie/ProvvigioniRapportiTab.tsx` — riscrittura `upsertMutation` + by-pass AlertDialog quando non si sovrascrive.
