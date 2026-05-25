# Fix salvataggio Rami/Sottorami abilitati

## Diagnosi

Nel pannello "Gestione manuale Rami e Sottorami abilitati":
- Selezioni Ramo + sottoramo, premi Salva → niente succede, il pannello provvigioni resta "0 Rami · 0 sottorami".

Causa: `RamiAbilitatiEditor.tsx` usa la colonna **`compagnia_rapporto_id`** ovunque (SELECT / DELETE / INSERT), ma la colonna reale in DB si chiama **`rapporto_id`** (NOT NULL).

Verificato:
- `information_schema.columns` su `compagnia_rapporto_rami` → colonne: `id, rapporto_id (NOT NULL), gruppo_ramo_id (NOT NULL), ramo_id, created_at`.
- Il flusso AI (`RapportiCompagniaDialog.tsx`) e la lettura in `ProvvigioniRapportiTab.tsx` usano già `rapporto_id` correttamente — è solo l'editor manuale ad essere sbagliato.

Risultato attuale: l'INSERT lato PostgREST fallisce (campo NOT NULL mancante + colonna inesistente), la SELECT non trova mai righe → UI sempre vuota.

## Fix (un solo file)

`src/components/compagnie/RamiAbilitatiEditor.tsx`:
1. SELECT (~riga 47): `.eq("compagnia_rapporto_id", …)` → `.eq("rapporto_id", …)`
2. DELETE (~riga 77): stesso rename
3. INSERT payload (~righe 83 e 86): `compagnia_rapporto_id: …` → `rapporto_id: …`
4. Allineare anche la prop e il nome variabile (`compagniaRapportoId` resta nel codice, è solo la variabile JS che porta `rapportoId`: nessuna modifica al chiamante necessaria).

## Verifica post-fix

- Apri rapporto, aggiungi un Ramo + "Tutti i sottorami", premi Salva → toast successo, le righe compaiono in `compagnia_rapporto_rami`.
- Il pannello "Provvigioni" sopra mostra i gruppi abilitati e si possono inserire le percentuali (la mutation provvigioni era già corretta — diventerà utilizzabile non appena ci sono righe abilitate).

Nessun cambiamento di schema DB o di altri componenti: i due flussi (AI e manuale) convergono sullo stesso storage `compagnia_rapporto_rami(rapporto_id, …)`.
