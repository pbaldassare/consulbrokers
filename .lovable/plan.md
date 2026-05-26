## Obiettivo

Calcolare le **provvigioni per ogni riga garanzia** in base alla matrice `provvigioni_compagnia_ramo` (Rapporto Compagnia/Agenzia + Gruppo Ramo + Sottoramo della riga), applicarle al **Premio Netto di quella riga**, e mostrarne la **somma nel totale provvigioni** delle card Firma e Quietanza.

Oggi invece viene usata **una sola %** (quella prevalente del gruppo) applicata all'intero netto, ignorando che ogni sottoramo può avere un'aliquota diversa (es. Cattolica/Campobasso × ZQ: QA = 8%, 093 = 20%, resto 12%).

## Cosa cambia

### 1. Mappa % per sottoramo (nuovo hook in `ImmissionePolizzaPage.tsx`)

Quando cambiano `selectedRapportoId` + `selectedGruppoRamoId`, eseguire **una sola query** a `provvigioni_compagnia_ramo` e costruire:

```
pctByRamoId: Map<ramo_id, percentuale>
pctDefault:  number | null   // riga con ramo_id NULL, se esiste
pctPrevalente: number        // % più frequente nel gruppo (fallback)
```

### 2. Risoluzione % per riga

Per ogni `GaranziaRow` (Firma e Quietanza):
- se `row.sottoramoId` ha match in `pctByRamoId` → usa quella %
- altrimenti `pctDefault` se presente
- altrimenti `pctPrevalente` (con flag "approssimato")

Salvato in `row.percAuto` (nuovo campo opzionale di `GaranziaRow`, solo runtime, non persistito).

### 3. Calcolo totali

```
provvFirma     = Σ (row.netto × row.percAuto / 100)   su premiFirmaRows
provvQuietanza = Σ (row.netto × row.percAuto / 100)   su premiQuietanzaRows
```

Sostituisce il calcolo attuale `premioNettoNum × percentualeProvvigione / 100`.

La "% Agenzia" mostrata in header diventa la **media ponderata** sul netto totale (display only), calcolata da `provvFirma / premioNettoNum × 100`. Resta il badge `auto` con fonte (es. "calcolata per riga dalla matrice").

### 4. Override manuale

Due livelli, additivi:
- **Override globale** (comportamento attuale): se l'utente digita in "% Agenzia", `percentualeProvvigioneAuto=false` e la stessa % viene applicata a tutte le righe (sovrascrive `row.percAuto`). Bottone `↻ Auto` ripristina il calcolo per-riga.
- **Override per riga** (fuori scope di questo cambio): non aggiunto ora, si valuta dopo se serve.

### 5. UI

- Tooltip/sublabel sotto "% Agenzia": "Calcolata per riga dalla matrice — clicca per dettaglio" (apre un piccolo Popover con tabella `Sottoramo → % → Netto → Provv` già esistente nell'aiuto provvigioni; se non c'è, semplice testo nel banner fonte).
- Banner warning ⚠ mostrato solo se almeno una riga è fallback prevalente (sottoramo non scelto o non in matrice).

### 6. Salvataggio

Nessun cambio schema. `titoli.percentuale_provvigione` continua a contenere la media ponderata (come oggi `percentualeProvvigione`). `premi_garanzia_polizza` non riceve nuovi campi.

## File da modificare

- `src/pages/ImmissionePolizzaPage.tsx` — nuovo hook che carica la mappa, calcolo `provvFirma`/`provvQuietanza` per somma riga, propagazione della media ponderata in `percentualeProvvigione` quando in modalità auto.
- `src/lib/resolveProvvigione.ts` — esportare una funzione `resolveMatricePerRapportoGruppo(rapportoId, gruppoRamoId)` che ritorna `{ pctByRamoId, pctDefault, pctPrevalente, isUniform }`. La funzione attuale `resolvePercentualeProvvigione` resta come fallback per casi singoli.
- `src/components/polizze/PremiGaranziaCardShell.tsx` — nessun cambio funzionale obbligatorio; opzionale: passare `fonteAuto` con messaggio "calcolata per riga".

## Fuori scope

- Override per-riga della % (potenziale step successivo).
- Modifica `TitoloDetail.tsx` / polizze esistenti (allineamento separato, come da memoria).
- Calcolo Commerciale/Brokeraggio: restano sul netto totale come oggi.
