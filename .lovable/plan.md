## Obiettivo
Quando si clicca **Annullamento** su una polizza/quietanza, oggi viene solo settato `stato='annullato'`. Servirà un cleanup a cascata totale: polizza/quietanza resta come record `titoli` in stato `annullato` (per tenere agganciato il `log_attivita`), tutto il resto viene eliminato — **anche provvigioni e rimesse già pagate**.

## Implementazione

### 1. Nuova funzione `src/lib/annullaPolizza.ts`

```ts
annullaPolizza(titoloId: string): Promise<AnnullaPolizzaResult>
```

Steps:
1. **Carica il titolo** (`numero_titolo`, `riga`, `sostituisce_polizza`).
2. **Trova ricorsivamente le quietanze figlie** via `sostituisce_polizza = numero_titolo AND sostituisce_riga = riga` (poi figlie di figlie).
3. `idsToClean = [titoloId, ...quietanze]`.
4. **Cascade delete senza blocchi** (ordine importante per FK):
   - `pagamenti_provvigioni_righe` WHERE `provvigione_id IN (SELECT id FROM provvigioni_generate WHERE titolo_id IN (...))`
   - `provvigioni_generate` WHERE `titolo_id IN (...)`
   - `rimessa_dettaglio` WHERE `titolo_id IN (...)`
   - `movimenti_contabili` WHERE `riferimento_tipo='titolo' AND riferimento_id IN (...)`
   - `movimenti_polizza` WHERE `titolo_id IN (...)`
   - `titoli_split_commerciali` WHERE `titolo_id IN (...)`
   - Quietanze figlie: `DELETE FROM titoli WHERE id IN (quietanze)`
5. **Update titolo madre/quietanza target**: `stato='annullato'` + reset campi messa a cassa (`data_messa_cassa`, `data_incasso`, `data_pagamento`, `importo_incassato`, `tipo_pagamento`, `banca_pagamento`, `conferimento_gestito=false`, `data_conferimento_gestito=null`).
6. **Log unico** in `log_attivita`:
   ```
   azione: "annullamento_polizza_cascade"
   entita_tipo: "titolo"
   entita_id: titoloId
   severity: "warning"
   dettagli_json: { quietanze_eliminate, provvigioni_eliminate, pagamenti_righe_eliminate, rimessa_dettagli_eliminati, movimenti_eliminati, splits_eliminati, includeva_provvigioni_pagate: boolean }
   ```
7. Return contatori.

**Nota**: la funzione gestisce sia la polizza madre (`riga = polizza originale`) che una quietanza singola — la logica ricorsiva al punto 2 si limita ai discendenti del titolo target, quindi annullando una quietanza non si tocca la madre né le sorelle.

### 2. `src/pages/TitoloDetail.tsx` (riga 1560)

Sostituire l'`onClick` dell'`AlertDialogAction` "Conferma Annullamento":

```tsx
onClick={async () => {
  const res = await annullaPolizza(id!);
  if (!res.ok) { toast.error(res.error); return; }
  toast.success(
    `Polizza annullata: ${res.quietanzeEliminate} quietanze, ${res.provvigioniEliminate} provvigioni, ${res.movimentiEliminati} movimenti rimossi`
  );
  queryClient.invalidateQueries();
}}
```

Aggiornare il testo dell'`AlertDialogDescription` per avvisare che verranno eliminate anche le provvigioni/rimesse già pagate:

> "Annullando la polizza {numero} verranno eliminati: quietanze successive, provvigioni (anche se già pagate), righe rimessa, movimenti contabili ed estratti conto collegati. Resterà solo il log dell'operazione. Confermi?"

Import: `import { annullaPolizza } from "@/lib/annullaPolizza";`

### 3. Memoria
Nuovo file `mem://insurance/policy-cancellation-cascade.md` + entry in `mem://index.md`:
> Annullamento polizza/quietanza → cascade-delete di provvigioni_generate, pagamenti_provvigioni_righe, rimessa_dettaglio, movimenti_contabili, movimenti_polizza, titoli_split_commerciali e quietanze discendenti. Anche le provvigioni/rimesse già pagate vengono eliminate. Il titolo target resta in stato 'annullato' come ancoraggio per log_attivita. Annullamento su quietanza singola tocca solo quella riga + discendenti.

## Fuori scope
- `annullaMessaACassa` resta invariato.
- Nessuna modifica a trigger DB.
- Nessuna modifica a `pagamenti_provvigioni` (header distinta) — vengono toccate solo le righe.