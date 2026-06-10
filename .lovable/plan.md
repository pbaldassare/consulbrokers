## Fix conteggio badge "Agenzie collegate"

**File**: `src/pages/CompagnieList.tsx` (~righe 1074-1085, dentro `CompagnieMadriTab` → query `agenzie-madri-list`).

Aggiungere il filtro `is_principale = false` alla select sui rapporti N:N, così il conteggio esclude i rapporti principali auto-creati dal trigger DB (sono già rappresentati nel conteggio 1:N tramite `compagnie.gruppo_compagnia_id`).

```ts
const { data: rapportiData } = await supabase
  .from("compagnia_rapporti")
  .select("compagnia_id, gruppo_compagnia_id")
  .eq("attivo", true)
  .eq("is_principale", false);   // ← nuovo
```

Risultato: CATTOLICA mostra badge **2** (= 2 agenzie 1:N + 0 rapporti N:N veri), coerente col popup "Nessun rapporto N:N registrato".
