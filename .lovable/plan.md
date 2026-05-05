## Problemi rilevati

1. **Card di split (Commerciale/Consul) non si aggiornano** quando cambio le provvigioni dalla card RCA. Causa: `TitoloDetail` legge `t.provvigioni_firma/quietanza` dallo snapshot iniziale; `onProvvigioniChange` aggiorna il DB e fa `invalidateQueries(["titolo", id])`, ma se la query key effettiva è diversa (es. `["titolo-detail", id]`) l'invalidate non rifresca e lo split mostra il vecchio valore.

2. **Card Quietanza non auto-popolata**: la riga RCA Quietanza dovrebbe essere creata dal trigger DB `premi_garanzia_sync_quietanza`. Sul titolo corrente sospetto che le righe Firma esistano da prima della migration o che il trigger non scatti se la riga RCA Firma esiste già senza modifiche successive (il backfill nella migration esegue solo `sync_quietanza_da_firma` su titoli con righe `firma`, ma se in seguito si aggiunge la prima riga RCA Firma di un titolo nuovo il trigger gira correttamente — il problema è sui titoli storici dove il backfill non ha trovato la riga oppure è stato eseguito prima dell'INSERT dell'RCA principale).

3. **Pulsante "Risincronizza" non funziona**: la mutation chiama `supabase.rpc("sync_quietanza_da_firma", {p_titolo_id})`; se la funzione non è esposta via PostgREST manca `GRANT EXECUTE ... TO authenticated` (la migration non lo include), quindi la chiamata fallisce silenziosamente con 404 RPC.

4. **Totali Tasse non scorporabili/modificabili**: oggi nel riquadro "Totali" la card "Totale Tasse" è un singolo numero. L'utente vuole 3 input editabili (IPT, SSN, Tasse accessorie) che si propaghino sulla riga RCA principale (IPT/SSN) e ridistribuiscano la quota accessorie sulle voci non-RCA in proporzione (oppure aggiornino l'aliquota effettiva).

---

## Modifiche

### A. `supabase/migrations/<new>.sql` — fix RPC e trigger
- `GRANT EXECUTE ON FUNCTION public.sync_quietanza_da_firma(uuid) TO authenticated, service_role;`
- Backfill aggressivo: per ogni titolo con righe `tipo_premio='firma'` ma senza riga RCA Quietanza, eseguire `sync_quietanza_da_firma`.
- Aggiungere trigger anche sull'INSERT della **prima** riga Firma per garantire la creazione dello specchio Quietanza (già coperto dal trigger `AFTER INSERT OR UPDATE OR DELETE` esistente — verificare non ci sia condizione `WHEN` che lo blocchi).

### B. `src/components/polizze/VociRcaCard.tsx`
1. **Risincronizza più robusto**: gestire l'errore RPC mostrando il messaggio reale e, in fallback, eseguire il reset lato client (DELETE righe quietanza non-personalizzate + reinsert da firma) se l'RPC restituisce 404/permission denied.
2. **Card Totali → 3 input editabili**:
   - Sostituire blocco singolo "Totale Tasse" con 3 input mini-card affiancati: **IPT**, **SSN**, **Tasse accessorie**.
   - Default = `totali.imposta`, `totali.ssn`, `totali.tasseAcc`.
   - onBlur IPT / SSN → `handleImpostaOverrideBlur` / `handleSsnOverrideBlur` sulla riga RCA principale (riusa logica esistente).
   - onBlur Tasse accessorie → calcola nuova `aliquota_tasse_pct` media: `nuovaAliq = (nuoveTasseAcc / sommaNettoNonRca) * 100` e applica via `handleAliquotaBlur` su tutte le voci non-RCA (oppure su un'unica voce "wrapper" se ne esiste solo una). Se non ci sono voci accessorie, disabilita l'input.
   - Mantenere il "Totale Tasse" complessivo come label sopra i 3 campi (read-only).

### C. `src/pages/TitoloDetail.tsx`
1. **Reattività split**: in `onProvvigioniChange` di entrambe le `<VociRcaCard>` aggiungere:
   - `await supabase.from("titoli").update(...)` (già fatto)
   - **invalidare TUTTE le query del titolo**: usare predicate `qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0]?.toString().startsWith("titolo") && q.queryKey.includes(t.id) })`
   - oppure più semplicemente aggiungere a `setT` locale (se `t` è uno state) il nuovo valore: `setTitolo(prev => ({ ...prev, provvigioni_firma: v }))` per refresh immediato dello split senza attesa del refetch.
2. Verificare la query key reale del titolo (linea attorno a 2501 usa `["titolo", t.id]`) — controllare che la `useQuery` principale del titolo usi la stessa.

---

## Punti tecnici

- La logica split provvigioni in sé è corretta (commerciale = `provv × %/100`, agenzia = resto, caso admin = 100% agenzia statistico). Il bug è di **reattività React Query**, non di formula.
- Per il caso Quietanza non visibile: se il problema persiste anche dopo il GRANT, valuteremo un INSERT esplicito al primo render della VociRcaCard quietanza quando esiste una RCA Firma ma manca la RCA Quietanza (fallback client-side dello stesso comportamento del trigger).

---

## Aggiornamento memoria

Aggiornare `mem://insurance/rca-voci-composizione-premio` con:
- nota su GRANT EXECUTE su `sync_quietanza_da_firma`
- nota sui 3 input editabili IPT/SSN/Tasse accessorie nel riquadro Totali
