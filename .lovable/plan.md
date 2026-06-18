## Step 1 wizard apertura sinistro — ricerca cliente → ricerca polizza

Modifico **solo** lo Step 1 di `src/pages/SinistroAperturaWizardPage.tsx`. Nessuna modifica a schema DB, RLS, edge functions o altri step.

### Comportamento nuovo

```text
Step 1: Cliente & Polizza
─────────────────────────────────
1) Cerca cliente               [SearchableSelect]
   → digita nome / cognome / ragione sociale / CF / P.IVA
   → query su `clienti` (limit 25, debounce 350ms)
   → mostra: Nome/RagSoc · CF/P.IVA · tipo

2) (dopo selezione cliente)
   Cliente selezionato: ACME SRL · 12345678901   [Cambia]

3) Polizza del cliente         [SearchableSelect, disabled finché non c'è cliente]
   → carica automaticamente TUTTE le polizze attive del cliente selezionato
     (titoli + polizza_cga, eq cliente_anagrafica_id, stesso pattern già usato
      per `preselectedClienteId`)
   → ricerca testuale lato client sul numero polizza
   → "Nessuna polizza per questo cliente" se lista vuota
   → resta opzionale: "Prosegui senza polizza" come oggi
```

Se l'utente cambia cliente, resetto `titolo_id`, `selectedPolizzaData` e la lista polizze.

### Modifiche tecniche (un solo file)

`src/pages/SinistroAperturaWizardPage.tsx`:

- Nuovi stati: `selectedClienteId`, `selectedClienteData`, `clientiSearchText`, `clientiList`, `clientiLoading`.
- Nuova `useEffect` debounced (350ms) che cerca clienti su `clienti` (`or(cognome.ilike, nome.ilike, ragione_sociale.ilike, codice_fiscale.ilike, partita_iva.ilike)`, `limit(25)`).
- Riuso del blocco già esistente (righe ~114-150) che carica `titoli` + `polizza_cga` per un `cliente_anagrafica_id`: lo estraggo in una funzione `loadPolizzeForCliente(clienteId)` chiamata sia dal preselect URL sia dalla nuova selezione manuale.
- Rimuovo la ricerca polizze "globale" (righe 211-258 + il blocco `onSearchChange` dentro `SearchableSelect` polizze, righe 525-555): la lista è ora derivata dal cliente.
- Filtro testuale polizze: client-side su `polizzeList` con `polizzaSearchText`.
- Reset della polizza quando cambia cliente.
- Preserva il flusso esistente con `preselectedClienteId` (deep-link da scheda cliente): seleziona automaticamente il cliente e mostra subito le sue polizze.
- Persistenza bozza: aggiungo `cliente_id` allo schema/draft Step 1 (opzionale) così che ricaricando la bozza il cliente venga riselezionato; il salvataggio finale del sinistro continua a usare `selectedPolizzaData?.cliente_anagrafica_id` esattamente come oggi (nessun cambio in `handleSubmit`).
- Testo descrittivo dello Step 1 aggiornato: "Seleziona prima il cliente, poi scegli una delle sue polizze attive. La polizza è facoltativa."

### Cosa NON cambia

- Nessuna modifica a Step 2/3/4/5, salvataggio sinistro, RLS, edge functions, tipi Supabase.
- Naming/terminologia invariati (Cliente, Polizza).
- Pattern UI: `SearchableSelect`, debounce 350ms, limit 25 (memory rules).