## Problema

In **Immissione Polizza**, selezionando il sottoramo `QA — R.C. AUTO` la riga di Premio per Garanzia non sta calcolando come dovrebbe:
- **IPT** = `netto × aliquota_provinciale%` (16% per BS / default)
- **SSN** = `netto × 10,5%`
- **Lordo** = `netto + IPT + SSN`

Il codice in `PremiGaranziaCardShell.tsx` contiene già la logica RCA principale (rilevamento via `isRcaPrincipaleCodice`, fetch `aliquote_provinciali_rca`, formula tasse), ma in alcuni casi la cella mostra ancora "Aliquota %" semplice e il lordo viene calcolato come `netto × (1+aliquota/100)` invece della formula corretta.

## Cause individuate

1. **Race aliquota provinciale**: se l'utente seleziona il sottoramo prima che la query a `aliquote_provinciali_rca` sia tornata (`aliquotaProv` ancora a default 16), e poi cambia il netto, il valore può restare disallineato dal default. Inoltre se la query fallisce silenziosamente non c'è log/feedback.

2. **Reset incompleto cambiando sottoramo**: passando da una voce RCA a un'altra (o viceversa), i flag `isRcaPrincipale/imposta/ssn/aliquotaProvinciale` non sempre vengono ripuliti correttamente, lasciando residui che falsano il calcolo.

3. **Lookup provincia cliente**: se `provincia_residenza` è null usiamo `provincia_sede`, ma per persona fisica il campo da usare è solo residenza. Va comunque garantito un fallback a `aliquotaProv = 16` quando entrambi i campi sono null (oggi accade già, ma senza warning).

4. **Header colonna fuorviante**: l'intestazione recita `Aliquota % / IPT+SSN` ma per le voci RCA serve esplicitare "IPT €" e "SSN €" così l'utente capisce cosa sta vedendo.

## Modifiche

### `src/components/polizze/PremiGaranziaCardShell.tsx`

1. **Logging diagnostico** (rimuovibile dopo verifica): all'arrivo della query `aliquote_provinciali_rca` loggare `console.info("[RCA] provincia=BS aliquota=16")` per confermare il valore caricato.

2. **`handleGaranziaSelect`**: ricalcolare sempre IPT/SSN anche se `netto = 0`, settandoli a `"0.00"` invece che `""`, in modo che la riga mostri subito i campi attivi e non vuoti. Quando si passa da RCA → non-RCA, azzerare esplicitamente `imposta`, `ssn`, `aliquotaProvinciale`, `isRcaPrincipale = false`.

3. **`handleNettoChange`**: se la riga è marcata RCA principale ma per qualche motivo `aliquotaProvinciale` è `undefined`, usare `aliquotaProv` di stato (già fatto) e **scrivere** il valore nella riga in modo che sia persistito al save.

4. **Header colonna**: cambiare label da `Aliquota % / IPT+SSN` a `Tasse / IPT + SSN €` con sub-header chiaro per le righe RCA.

5. **Recalcolo on-mount**: quando il componente riceve righe già marcate `isRcaPrincipale` (es. da bozza/ripristino) ma con `imposta`/`ssn` vuoti e `netto > 0`, eseguire un ricalcolo automatico una sola volta in `useEffect`.

### `src/pages/ImmissionePolizzaPage.tsx`

6. Verificare che `clienteDettaglio` includa `provincia_residenza` e `provincia_sede` (già presente). Aggiungere log: `console.info("[Immissione] provinciaCliente=", provinciaCliente)` accanto al passaggio prop.

7. Nel salvataggio in `premi_garanzia_polizza`, garantire che `aliquota_tasse_pct` per riga RCA usi `r.aliquotaProvinciale ?? 16` (oggi prende `aliquotaProv` solo dal closure). Così riaprendo il titolo da `TitoloDetail` la card `VociRcaCard` legge il valore corretto.

## Verifica manuale

1. Aprire Immissione Polizza per un cliente con `provincia_residenza='BS'`.
2. Selezionare gruppo ramo R.C.A., poi sottoramo `QA — R.C. AUTO` su una riga della card Firma.
3. Inserire netto = `1000` → la riga deve mostrare:
   - IPT = `160,00`
   - SSN = `105,00`
   - Tasse € = `265,00`
   - Lordo = `1.265,00`
4. Override manuale di IPT a `150` → SSN resta `105`, Lordo diventa `1.255`.
5. Salvare il titolo, riaprirlo da `TitoloDetail`: la card `VociRcaCard` Firma deve mostrare gli stessi valori senza ricalcoli.

## Fuori scope

- Nessuna migrazione DB.
- Nessuna modifica a `VociRcaCard` (post-creazione già funziona).
- Nessuna modifica ai flussi Rinnovo/Duplicazione/Sospensione.
