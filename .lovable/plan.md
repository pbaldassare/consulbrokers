
## Richiesta

1. La card **"Messe a Cassa"** (incassi del mese) sulla dashboard mostra **0**, ma l'utente ha appena fatto operazioni di "Garantito"/"Incassa" → il conteggio non si aggiorna.
2. Quando si **annulla** un'operazione di messa a cassa/garantito su un titolo, lo stato deve **tornare indietro a "da mettere in copertura"** (cioè stato `attivo` con `data_messa_cassa = NULL`, riportandolo nel "Carico del Mese" / "Fuori Copertura").

## Investigazione

Verifico:
1. **Query "Incassi del Mese"** in `useDashboardData.ts` (`loadUfficio`) — cosa conta esattamente
2. **DB reale** — quali titoli hanno `data_messa_cassa` impostata nel mese corrente vs stato `garantito`/`incassato`
3. **`annullaMessaACassa.ts`** — la funzione di annullamento esistente: quali campi resetta? Riporta lo stato a `attivo`?
4. **Pulsante "Annulla"** — dove è esposto (TitoloDetail? PortafoglioCarico?) e quali privilegi richiede

## Piano

### 1. Card "Messe a Cassa" — riallineare conteggio

In `useDashboardData.ts > loadUfficio()`:
- La query attuale conta probabilmente solo `stato = 'incassato'` con `data_messa_cassa` nel mese.
- Va estesa a: tutti i titoli con **`data_messa_cassa` nel mese corrente** (indipendentemente dallo stato finale `garantito` / `incassato` / `pagato`), perché un titolo "garantito" è già "messo a cassa" (= operazione fatta), solo il pagamento effettivo arriverà dopo.
- Filtro corretto:
  ```sql
  WHERE data_messa_cassa >= date_trunc('month', CURRENT_DATE)
    AND data_messa_cassa < date_trunc('month', CURRENT_DATE) + interval '1 month'
  ```
  (senza filtro su `stato`)

### 2. Annulla messa a cassa → torna in "da coprire"

Verifico `src/lib/annullaMessaACassa.ts`. La funzione deve resettare:
- `stato` → `'attivo'`
- `data_messa_cassa` → `NULL`
- `data_pagamento` → `NULL`
- `data_incasso` → `NULL`
- `tipo_pagamento` → `NULL`
- `banca_pagamento` → `NULL`
- `importo_incassato` → `NULL`
- `data_decorrenza_rinnovo` → `NULL` (opzionale, da chiarire)

Dopo l'annullamento il titolo:
- Sparisce da "Messe a Cassa" (incassi del mese)
- Riappare in "Carico del Mese" / "Fuori Copertura" (perché `attivo` + `data_messa_cassa IS NULL`)
- Sparisce da "Garantito" se la flag `garantito` esisteva → resettare anche quella

### 3. Verifica pulsante "Annulla" presente nel TitoloDetail
Confermare che esista già un pulsante "Annulla Messa a Cassa" visibile (con privilegi admin) che invoca `annullaMessaACassa`. Se non c'è, aggiungerlo nel TitoloDetail dopo il blocco "Stato cassa".

### 4. Invalidate query post-annullamento
Dopo `annullaMessaACassa` invalidate:
- `["dashboard-ufficio"]`
- `["portafoglio-carico"]`
- `["portafoglio-carico-totale"]`
- `["titolo", id]`

### File toccati
- `src/hooks/useDashboardData.ts` — fix conteggio "Messe a Cassa"
- `src/lib/annullaMessaACassa.ts` — verificare/completare reset campi + log + invalidate
- `src/pages/TitoloDetail.tsx` — verificare presenza pulsante Annulla e collegamento

### Investigazione preliminare (da fare in default mode)
- `code--view src/lib/annullaMessaACassa.ts`
- `code--view src/hooks/useDashboardData.ts` (sezione loadUfficio incassi)
- Query DB: `SELECT id, numero_titolo, stato, data_messa_cassa, data_decorrenza_rinnovo FROM titoli WHERE data_messa_cassa >= '2026-04-01' OR (stato='attivo' AND data_scadenza BETWEEN '2026-04-01' AND '2026-04-30');`
