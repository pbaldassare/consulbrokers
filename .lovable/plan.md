# Gestione avanzata Sottoramo nell'Import IA tariffario

## Obiettivo
Nel dialog **Import IA tariffario provvigioni** (Compagnie → Rapporto → Import IA) la colonna **Sottoramo DB** oggi permette di scegliere **un solo** sottoramo (o "default ramo"). L'utente vuole poter:

1. Selezionare **tutti** i sottorami del Ramo DB scelto con un click.
2. Selezionare **alcuni** sottorami (multi-selezione a checkbox).
3. Mantenere l'opzione "default ramo" (nessun sottoramo) come oggi.

## Comportamento UI (file: `src/components/compagnie/ProvvigioniRapportiTab.tsx`, componente `AiImportDialog`)

- Sostituire l'attuale `SearchableSelect` nella cella **Sottoramo DB** con un nuovo **MultiSelect a popover**:
  - Trigger: pulsante che mostra
    - "— Default ramo —" se nessun sottoramo selezionato
    - "Tutti i sottorami (N)" se tutti selezionati
    - "X sottorami" o l'unico nome se selezione parziale
  - Contenuto popover: 
    - Riga in alto **"Seleziona tutti / Deseleziona tutti"** (toggle)
    - Lista checkbox dei sottorami del Ramo DB corrente
    - Search box (riuso pattern `Command`)
  - Disabilitato finché non è scelto un Ramo DB
- Stato per riga: campo `ramo_ids: string[]` (vuoto = default ramo). Si sostituisce a `ramo_id: string | null`.
- Cambio Ramo DB → reset `ramo_ids` a `[]`.
- Badge **Stato**: `OK` quando `gruppo_ramo_id` valido e `%` numerica (indipendentemente da quanti sottorami).
- Contatore footer: `Salva N` dove **N = numero totale di righe che verranno inserite**, cioè per ogni riga `max(ramo_ids.length, 1)` (1 = default ramo). Esempio: 4 righe con sottorami [3, 0, 2, 5] → bottone "Salva 11".

## Logica di salvataggio

In `onConfirm` espandere ogni riga valida:

```ts
valid.flatMap(r => {
  const ids = r.ramo_ids?.length ? r.ramo_ids : [null]; // null = default ramo
  return ids.map(ramo_id => ({
    gruppo_ramo_id: r.gruppo_ramo_id,
    ramo_id,
    percentuale: Number(r.percentuale),
  }));
})
```

Il chiamante `onConfirm` (più in alto in `ProvvigioniRapportiTab`) riceve già un array piatto di righe `{gruppo_ramo_id, ramo_id, percentuale}` → **nessuna modifica lato server / API**. La deduplica e l'upsert su `provvigioni_compagnia_ramo` esistenti continuano a funzionare.

## Match IA iniziale

Quando l'IA riconosce **un** sottoramo, lo si inserisce come `ramo_ids: [matchedId]` (comportamento attuale, solo nel nuovo formato array).

## Out of scope
- Nessuna modifica al modello DB.
- Nessuna modifica all'edge function `parse-tariffario-rami`.
- Layout, colonne, pulsanti header del dialog restano invariati.
- Manuale / CSV / "Copia da altro rapporto" non toccati.

## File da modificare
- `src/components/compagnie/ProvvigioniRapportiTab.tsx` (solo `AiImportDialog` e tipi interni)

Confermi e procedo?
