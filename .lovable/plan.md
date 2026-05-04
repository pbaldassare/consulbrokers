# Import portafoglio aprile 2026 (16 polizze)

## Step 1 — Anagrafiche di supporto

| Tabella | Inserimento |
|---|---|
| `compagnie` | `SOCIETA' REALE MUTUA DI ASS.NI MALLOZZI SRL` (gruppo: REALE MUTUA) |
| `uffici` | `SEDE CATANIA` — codice `CT`, città Catania, provincia CT |
| `profiles` (backoffice) | GUARRACINO GAETANO, Gestione Milano |
| `profiles` (produttore = Consul) | INTERFIDI SRL, SCIORIO NICOLA, Consulbrokers Digital Srl, E.M.A. SOLUZIONI ASSICURATIVE SRL |

## Step 2 — Inserimento 16 titoli

Per ogni riga del file:
- `cliente_id` ← cliente keeper corrispondente
- `compagnia_id` ← compagnia mappata (CONSULBROKERS Milano per AXKY13OP)
- `ramo_id` ← ramo mappato
- `ufficio_id` ← Ufficio di Napoli o nuova SEDE CATANIA
- `commerciale_id` ← Consul (NULL per le 3 polizze CONSULBROKERS senza produttore)
- `specialist` ← testo (`GUARRACINO GAETANO` o `Gestione Milano`)
- `numero_titolo`, `premio_lordo` ← dal file
- `provvigioni_firma` ← colonna "Attive" (provvigioni attive)
- `provvigioni_quietanza` ← colonna "Passive" (provvigioni passive)
- `data_scadenza` ← colonna "Scadenza" (scadenza rata)
- `durata_a` / `garanzia_a` ← colonna "Scad Polizza"
- `durata_da` / `garanzia_da` ← Scad Polizza − 1 anno (o − 4 anni per la poliennale Lo Giudice 2027-01-19)
- `rate` ← colonna "Fraz" (1 o 3)
- `periodicita` ← `annuale` (o `quadrimestrale` se Fraz=3)
- `stato` ← `attivo`
- `tacito_rinnovo` ← `true`
- `produttore_nome` ← testo del produttore (per backup leggibilità)
- `ae_nome` ← `SEDE NAPOLI` / `SEDE CATANIA`

Per le 5 polizze con targa (riga 2,4,6,7,10 del file) inserisco anche record in `veicoli_polizza` con: `targa`, `tipo_veicolo` (AUTOVETTURA / MOTOCICLO / NATANTE).

## Step 3 — Verifica finale

Conteggio titoli per cliente, totale premio lordo (atteso ~€ 89.951), totale Attive (~€ 6.346), totale Passive (~€ 2.890).

## Note
Operazione idempotente: uso `ON CONFLICT DO NOTHING` su anagrafiche supporto. Se rilanciata non duplica.
