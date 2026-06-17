## Filtro Cliente in Gestione Polizze: usare OR su `cliente_id` e `cliente_anagrafica_id`

### Causa
Su `titoli` (e quindi su `v_portafoglio_titoli`) il legame al cliente è **doppio**:
- `cliente_id` → `clienti.id` (29 titoli su 102)
- `cliente_anagrafica_id` → **anch'esso `clienti.id`** (76 titoli su 102), nonostante il nome suggerisca `anagrafiche_professionali.id`. Verificato: 76/76 matchano `clienti.id`, 0/76 matchano `anagrafiche_professionali.id`.

Il fix recente filtrava solo su `cliente_id`, escludendo i 76 titoli "legacy" — fra cui le 5 polizze di Baldassare Paolo. Per questo `Nessuna polizza` quando lo selezioni.

### Modifica

`src/pages/GestionePolizzePage.tsx` — sostituire il filtro singolo con un OR:

```ts
if (clienteId) {
  q = q.or(`cliente_id.eq.${clienteId},cliente_anagrafica_id.eq.${clienteId}`);
}
```

Niente altre modifiche: l'opzione Cliente continua a venire da `public.clienti` (corretto), la SearchableSelect è invariata.

### Aggiornare la memoria

`mem://insurance/v-portafoglio-titoli-cliente-keys.md` va riscritta: `cliente_anagrafica_id` su `titoli` **contiene `clienti.id`** (legacy naming). Per filtrare titoli per cliente serve `cliente_id OR cliente_anagrafica_id`. Idem dovunque si filtri `titoli`/`v_portafoglio_titoli` per cliente — vado a fare un audit (ripgrep) e segnalo (senza correggerli ora, fuori scope) i punti che usano solo una delle due colonne.

### Test

Aggiornare `tests/e2e/11-gestione-polizze-operazioni.spec.ts`: il fixture `createTestTitolo` valorizza `cliente_anagrafica_id` (vedi helper) — verificare che il filtro mostri il titolo con la SearchableSelect su `clienti.id` come prima.

### Fuori scopo
- Migrazione dati per consolidare `cliente_id` (riempire `cliente_id` dove c'è solo `cliente_anagrafica_id`): è un cleanup separato che richiede approvazione esplicita.
- Refactor delle altre pagine che filtrano titoli per cliente.
