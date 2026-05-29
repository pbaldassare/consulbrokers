## Obiettivo
Quando l'utente clicca **Annullamento** sulla polizza, oggi `changeStatoMutation.mutate("annullato")` si limita a settare `stato='annullato'` e a resettare i campi di messa a cassa. Le quietanze figlie, le provvigioni, i movimenti contabili e i dettagli rimessa restano in DB → la polizza appare ancora negli E/C, nei totali provvigioni, nei carichi rimessa.

Servirà un cleanup a cascata: la polizza madre resta come record `titoli` (in stato `annullato`) per mantenere il `log_attivita` agganciato, ma tutto il resto viene eliminato.

## Implementazione

### 1. Nuova funzione `src/lib/annullaPolizza.ts`
Cascade cleanup atomico (lato client, una transazione logica con rollback manuale via log):

```ts
annullaPolizza(titoloId: string): Promise<AnnullaPolizzaResult>
```

Steps:
1. **Carica il titolo madre** (`numero_titolo`, `riga`) — per trovare quietanze figlie via `sostituisce_polizza = numero_titolo AND sostituisce_riga = riga`.
2. **Trova tutte le quietanze figlie** (ricorsivamente: anche figlie di figlie).
3. **Set di id da pulire** = `[titoloMadre, ...quietanze]`.
4. **Blocco se rimesse pagate**: query `rimessa_dettaglio` JOIN `rimesse` su quegli id → se esiste una rimessa con `stato='pagata'` → return `{ok:false, error:"…rimessa già pagata, impossibile annullare"}`.
5. **Blocco se provvigioni pagate**: `provvigioni_generate` con `pagata=true` AND `titolo_id IN (...)` → return errore.
6. **Delete cascata** (ordine):
   - `rimessa_dettaglio` WHERE `titolo_id IN (...)`
   - `provvigioni_generate` WHERE `titolo_id IN (...)`
   - `movimenti_contabili` WHERE `riferimento_tipo='titolo' AND riferimento_id IN (...)`
   - `movimenti_polizza` WHERE `titolo_id IN (...)`
   - `titoli_split_commerciali` WHERE `titolo_id IN (...)`
   - Quietanze figlie: `titoli` WHERE `id IN (quietanze)` (delete fisica)
7. **Update polizza madre**: `stato='annullato'`, reset di tutti i campi messa a cassa (come fa già `annullaMessaACassa`).
8. **Log unico** in `log_attivita`:
   ```
   azione: "annullamento_polizza_cascade"
   entita_tipo: "titolo"
   entita_id: titoloId  // madre
   severity: "warning"
   dettagli_json: { quietanze_eliminate, provvigioni_eliminate, movimenti_eliminati, rimessa_dettagli_eliminati, splits_eliminati }
   ```
9. Return contatori.

### 2. `src/pages/TitoloDetail.tsx`
Sostituire l'`onClick` dell'`AlertDialogAction` "Annulla polizza" (riga ~1560):

```tsx
onClick={async () => {
  const res = await annullaPolizza(id!);
  if (!res.ok) { toast.error(res.error); return; }
  toast.success(`Polizza annullata (${res.quietanzeEliminate} quietanze, ${res.provvigioniEliminate} provv., ${res.movimentiEliminati} mov. rimossi)`);
  queryClient.invalidateQueries(); // ricarica tutto
}}
```

Rimuovere quindi la chiamata a `changeStatoMutation.mutate("annullato")` in quel punto. Il resto del `changeStatoMutation` resta com'è per gli altri stati.

### 3. Aggiornare memoria
`mem://insurance/policy-cancellation-cascade.md` + entry in `mem://index.md`:
> Annullamento polizza esegue cascade-delete su quietanze figlie, provvigioni, movimenti contabili, movimenti_polizza, rimessa_dettaglio, splits. Polizza madre resta come stato 'annullato' per tracciamento log_attivita. Bloccato se rimesse o provvigioni già pagate.

## Domande di chiarimento

1. **Provvigioni/rimesse già pagate**: confermi che in quel caso devo **bloccare** l'annullamento (mostrando errore), oppure preferisci che proceda comunque eliminando anche quelle (perdendo traccia del pagato)?
2. **Annullamento di una quietanza singola** (non della madre): per ora il bottone Annullamento sulla quietanza figlia farà cascade solo su quella riga + sue eventuali figlie successive, non sulla madre. OK?

## Fuori scope
- Non tocco `annullaMessaACassa` (resta per annullare solo l'incasso senza annullare la polizza).
- Non modifico i trigger DB esistenti (`trg_titoli_normalizza_importi`, auto-quietanza).
- Non tocco `pagamenti_provvigioni` / `pagamenti_provvigioni_righe` (riferiscono `provvigioni_generate.id`: se ci sono pagamenti emessi → blocco al punto 5).