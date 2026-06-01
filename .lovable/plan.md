## Fix: conti bancari non visibili in nessun tab

**Causa root (confermata da network logs):** la query in `ContiBancariPage.tsx` riceve `PGRST201 — Could not embed because more than one relationship was found for 'conti_bancari' and 'compagnie'`. Esistono due FK fra le due tabelle:

1. `conti_bancari.compagnia_id → compagnie.id` (quella che vogliamo)
2. `compagnie.conto_bancario_id → conti_bancari.id` (relazione inversa)

PostgREST non sa quale usare → risponde HTTP 300 → la lista resta vuota in tutti i tab, anche se i contatori (che non usano embed) mostrano i numeri reali (Consulbrokers 4, Agenzie 10, Tutti 14).

**Fix (1 sola riga, `src/pages/anagrafiche/ContiBancariPage.tsx` riga 164):**

Disambiguare l'embed indicando la FK esatta:

```ts
.select(
  "*, compagnia:compagnie!conti_bancari_compagnia_id_fkey(id,nome,codice,tipo), rapporto:compagnia_rapporti(id,codice_mandato,gruppo_compagnia:gruppi_compagnia(descrizione))",
  { count: "exact" }
)
```

Nessun'altra modifica: filtri, paginazione, UI e contatori restano invariati. Dopo il fix i 14 conti già presenti in DB compaiono nei rispettivi tab.