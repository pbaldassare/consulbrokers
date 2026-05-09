## Fonte dati confermata

La tabella **`anagrafiche_professionali`** (UI: *Anagrafiche Amministrative*) è la fonte unica per Produttori, Account Executive, Resp. Sede e Specialist.

Mapping tipo → ruolo UI:
- `corrispondente` → Produttore (include esterni come Interfidi)
- `account_executive` → Account Executive
- `responsabile_sede` → Resp. Sede
- `backoffice` → Specialist

Collegamento ai titoli: `titoli.anagrafica_commerciale_id` → `anagrafiche_professionali.id` (FK già presente).

## Problema attuale

Le 3 pagine Provvigioni usano `profiles` (utenti del gestionale) per popolare il filtro Produttore, e applicano il filtro su `provvigioni_generate.user_id`. Risultato: i produttori reali presenti in `anagrafiche_professionali` ma senza utenza non compaiono nel dropdown e non sono filtrabili.

## Modifiche

### 1. Nuovo hook `src/hooks/useProduttoriLookup.ts`
```ts
supabase.from("anagrafiche_professionali")
  .select("id, nome, cognome, ragione_sociale, tipo")
  .eq("tipo", "corrispondente")
  .eq("attivo", true)
  .order("ragione_sociale", { nullsFirst: false })
```
Restituisce `Option[]` con `value = id`, `label = ragione_sociale ?? "cognome nome"`.

### 2. Pagine da aggiornare
- `src/pages/ProvvigioniMaturatePage.tsx`
- `src/pages/ProvvigioniSedePage.tsx`
- `src/pages/PagamentiProvvigioniList.tsx`

In ciascuna:
- sostituire la `useQuery` su `profiles` con `useProduttoriLookup()`
- cambiare il filtro applicato:
  ```ts
  // prima
  if (filters.produttoreId) q = q.eq("user_id", filters.produttoreId);
  // dopo
  if (filters.produttoreId) q = q.eq("titoli.anagrafica_commerciale_id", filters.produttoreId);
  ```
- nelle aggregazioni "Top Produttori": joinare `titoli.anagrafica_commerciale:anagrafiche_professionali(id, nome, cognome, ragione_sociale)` e usare quel record come chiave/label, con fallback a `titoli.produttore_nome` solo per record storici senza FK

### 3. Nessuna modifica DB
Solo refactor frontend; tutte le FK necessarie esistono già.

## Verifica

1. `/provvigioni-maturate`: dropdown Produttore mostra tutti i `corrispondente` attivi di `anagrafiche_professionali`
2. Selezionando un produttore, KPI/tabella si filtrano sui titoli con `anagrafica_commerciale_id` corrispondente
3. Stesso comportamento su `/provvigioni-sede` e `/pagamenti-provvigioni`
4. "Top Produttori" raggruppa per `anagrafica_commerciale_id` (con fallback a `produttore_nome` per i record storici)
