## Obiettivo

Permettere a un titolo di avere **N produttori commerciali** che si dividono le provvigioni (Firma e Quietanza). Consulbrokers SPA prende sempre la quota residua (`100 - somma %`).

Esempio: INTERFIDI 30% + Studio X 20% → Consulbrokers 50%.

## 1. Database

Nuova tabella `titoli_split_commerciali` (1..N righe per titolo):

| campo | tipo | note |
|---|---|---|
| `titolo_id` | uuid FK titoli ON DELETE CASCADE | |
| `anagrafica_commerciale_id` | uuid FK anagrafiche_professionali | obbligatorio |
| `commerciale_user_id` | uuid FK profiles | opzionale (per produttori interni) |
| `percentuale` | numeric(5,2) | 0 < x ≤ 100 |
| `ordine` | int | per stabilità UI |
| `note` | text | opzionale |

**Vincoli:**
- UNIQUE `(titolo_id, anagrafica_commerciale_id)` — niente duplicati
- Trigger di validazione: somma percentuali per titolo_id ≤ 100 (blocco INSERT/UPDATE/DELETE se supera)
- RLS: stessi permessi della tabella `titoli` (chi vede/modifica il titolo, vede/modifica gli split)

**Migrazione dati esistenti:**
Per ogni titolo con `anagrafica_commerciale_id IS NOT NULL`, INSERT 1 riga split copiando `anagrafica_commerciale_id`, `commerciale_id`, `percentuale_commerciale`. I campi singoli su `titoli` rimangono come legacy (non rimossi, ma non più letti).

## 2. Edge function `calcola-provvigioni`

Riscrittura della "PRIMARY PATH":
1. Leggi `titoli_split_commerciali` per il titolo
2. Per ogni riga: crea `provvigioni_generate` con `tipo_destinatario='commerciale'`, importo = `provvQuietanza * %/100`
3. Calcola `percAdmin = 100 - somma(%)`. Se > 0, crea riga admin (Consulbrokers) con quel residuo
4. Mantieni la regola `solo_statistico` se uno degli split = anagrafica admin
5. Fallback: se nessuno split, usa il vecchio comportamento basato su `anagrafica_commerciale_id` legacy (per titoli non migrati)

## 3. UI `TitoloDetail.tsx`

**Sezione "Commerciale & Provvigioni" (edit mode):**
- Sostituisco l'attuale singola riga (anagrafica + %) con un **elenco righe** dinamico
- Per ogni riga: SearchableSelect anagrafica + input % + bottone rimuovi
- Pulsante "+ Aggiungi produttore"
- Riepilogo sotto: `Totale produttori: X% — Consulbrokers SPA: Y% (residuo)`
- Validazione live: somma > 100 → riga rossa, salvataggio bloccato
- Per ogni anagrafica selezionata mostro hint `Default: 40%` con bottone "Usa default"

**View mode + cards split (sotto VociRcaCard Firma/Quietanza):**
- `renderSplitImporti()` ora itera su tutte le righe split + aggiunge la riga Consulbrokers residua
- Layout: una riga per produttore con nome, %, importo €; ultima riga Consulbrokers in evidenza

**Persistenza:**
- Su salvataggio titolo: diff sulla lista split → INSERT/UPDATE/DELETE su `titoli_split_commerciali`
- Trigger DB blocca eventuali somme > 100 lato server

## 4. Aree collegate da verificare (read-only, niente modifiche logica)

- `cfo_*` RPC: usano `produttore_nome` su `titoli`, non toccati
- Report provvigioni: già leggono `provvigioni_generate` riga per riga → funziona automaticamente con N righe
- Estratti conto produttore: idem, già per-riga

## 5. Memoria

Aggiorno `mem://insurance/policy-commission-split` per documentare il nuovo modello multi-produttore con tabella `titoli_split_commerciali` come unica verità.

## Out-of-scope

- Non rimuovo le colonne legacy `anagrafica_commerciale_id` / `percentuale_commerciale` / `commerciale_id` da `titoli` (resto di compatibilità)
- Niente cambi alla matrice provvigioni o al fallback legacy
