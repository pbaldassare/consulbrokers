# Allineamento UI al master `conti_bancari`

Hai ragione: il master `conti_bancari` è in piedi, ma alcune pagine "vecchie" mostrano ancora i form testuali liberi per IBAN / intestatario / banca, e il PDF E/C Agenzia legge ancora dai vecchi campi `compagnie.iban` invece del master. Questo è ciò che vedi ancora "vecchio".

## Pagine da sistemare

### 1) `src/pages/CompagnieList.tsx` — tab "Coordinate Bancarie"
Oggi mostra input testuali liberi per: `iban`, `codice_abi`, `codice_cab`, `intestato_a`, `bic`, `citta_banca`.

Cambio:
- Rimuovere quei 6 input.
- Aggiungere un solo `ContoBancarioSelect` (filtro `tipi=['compagnia','generico']`) legato a `compagnie.conto_bancario_id`.
- Sotto il select, anteprima read-only delle coordinate (intestatario, banca, IBAN mascherato, BIC) lette da `conti_bancari`.
- Link: "Gestisci i conti in Anagrafiche → Conti Bancari".
- I vecchi campi non vengono più scritti (restano in DB per back-compat, come da memoria del piano).

### 2) `src/pages/AnagraficheCompagniePage.tsx` — tab "Banca" / "RUI & Banca"
Oggi mostra `banca_riga1/2/3`, `abi`, `cab`, `iban`, `intestatario_cc`, sia in colonna tabella che nel form.

Cambio:
- Form: stesso pattern del punto 1 — un solo `ContoBancarioSelect` su `conto_bancario_id`, anteprima coordinate, link al master.
- Tabella: la colonna "Banca / IBAN" diventa una sola, mostra `etichetta` del conto collegato + IBAN mascherato (join con `conti_bancari`). Se non collegato → "—".
- Rimosse le tre righe `banca_riga1/2/3` e i campi ABI/CAB/IBAN/intestatario dal form.

### 3) `src/pages/contabilita/ECAgenziaPdfPage.tsx` — generazione PDF
Oggi `select(... iban, intestato_a ...)` da `compagnie` e usa quei valori nel PDF.

Cambio:
- Query estesa con `conto_bancario_id` e join annidato `conti_bancari!compagnie_conto_bancario_id_fkey ( iban, intestato_a, banca, bic )`.
- Cascata di risoluzione (stessa logica di `ECClientePdfPage`):
  1. `compagnie.conto_bancario_id` → `conti_bancari` (se valorizzato)
  2. fallback: `conti_bancari WHERE tipo='compagnia' AND is_default=true`
  3. fallback finale: campi vecchi `compagnie.iban` / `intestato_a` (per back-compat finché non puliamo i dati) — con warning in console
- Il riquadro "override manuale" prima di stampare il PDF resta, ma viene pre-popolato dal master.

## Fuori scope (chiedo conferma se vuoi farlo ora)

- Pulizia colonne deprecate (`compagnie.iban/intestato_a/bic/citta_banca/codice_abi/codice_cab`, `companies.banca_riga1/2/3`, `iban_dedicato` su rapporti, `uffici.iban/intestato_a/banca`): le lascio in DB. Se confermi, in un secondo step le marchiamo come deprecate con un commento SQL e poi le droppiamo dopo la verifica.
- `RapportiCompagniaDialog`: l'input testuale `iban_dedicato` non è più visibile in UI ma viene ancora salvato nello state. Posso rimuoverlo del tutto dal payload (resta solo `conto_bancario_id`).

## Risultato per l'utente

In tutte le pagine compagnia vedi un unico campo "Conto bancario" che pesca dal master `conti_bancari` (gestito in *Anagrafiche → Conti Bancari*), con anteprima coordinate. L'E/C Agenzia PDF mostra l'IBAN del master, niente più dato locale orfano.

Procedo?
