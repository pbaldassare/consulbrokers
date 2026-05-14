## Problemi rilevati (con esempi concreti dalla polizza 122222)

1. **Garanzie non salvate completamente in immissione**  
   In `ImmissionePolizzaPage.finalizzaPolizza` il filtro `buildPremiInsert` scarta le righe con `netto=0 && tasse=0`. La polizza in DB ha **1 sola riga quietanza** (`DIA — 1.122,00`) e **zero righe firma**, anche se le card mostravano entrambe. Causa: la riga firma aveva sottoramo selezionato ma importi a 0 → scartata.

2. **Sezione "Importi" su TitoloDetail mostra ancora i campi legacy** (`premio_netto`, `addizionali`, `tasse`, `premio_lordo`, `premio_netto_quietanza`, ecc. + `VociRcaCard` che usa `rca_garanzie`). Nel nuovo modello la verità è `premi_garanzia_polizza` con `tipo_premio` firma/quietanza e `garanzia`=codice sottoramo. Risultato: l'utente vede `Premio Netto —`, `Tasse —` mentre i veri dati sono nella tabella `premi_garanzia_polizza`.

3. **Sezione "Periodo" mostra "Rate" come numero (1, 2, 4, 6, 12)** invece di **Frazionamento testuale** (Mensile/Trimestrale/Quadrimestrale/Semestrale/Annuale/Poliennale). La colonna `titoli.frazionamento` (text) esiste già e viene scritta in immissione, ma TitoloDetail la ignora.

4. **`tipo_rinnovo` legacy**: la verità UI è `titoli.tacito_rinnovo` (memory già documentata) — verificare nessun residuo.

5. **Polizze vecchie**: alcune avranno `frazionamento=NULL` ma `rate` valorizzato → derivare frazionamento al volo da `rate` per la sola visualizzazione (1→Annuale, 2→Semestrale, 3→Quadrimestrale, 4→Trimestrale, 12→Mensile, altri→Poliennale se >12 mesi durata, fallback "Annuale"). Errori residui non bloccano (richiesto dall'utente).

---

## Modifiche

### A. Fix salvataggio garanzie (`src/pages/ImmissionePolizzaPage.tsx`)
- In `buildPremiInsert`: cambiare filtro da `(codice||descrizione) && (netto||tasse)` a **`(sottoramoId || codice || descrizione)`**. Salvare anche righe con importi a 0 se hanno un sottoramo selezionato.
- Aggiungere campo `aliquota_tasse_pct` nel payload se la colonna esiste (verifico in fase impl); altrimenti niente.

### B. TitoloDetail — Sezione "Periodo" (src/pages/TitoloDetail.tsx ~2094-2228)
- **Visualizzazione**: sostituire `FieldRow label="Rate"` con `FieldRow label="Frazionamento" value={t.frazionamento || derivaFrazionamentoDaRate(t.rate, t.anni_durata)}`.
- **Editing**: sostituire input numerico "Rate annuali" con `Select` di Frazionamento (stessi 6 valori usati in immissione). Al salvataggio scrivere sia `frazionamento` (testo) sia `rate` (derivato via `frazionamentoToRate`).
- Aggiungere `frazionamento` al `periodoForm` state e al `savePeriodoMutation`.
- Estrarre helper `frazionamentoMesi/frazionamentoToRate/derivaFrazionamentoDaRate` in `src/lib/frazionamento.ts` riusato da entrambe le pagine.

### C. TitoloDetail — Sezione "Importi" (src/pages/TitoloDetail.tsx ~2569-2820+)
- **Rimuovere** dalla view i FieldRow legacy: `Premio Netto`, `Addizionali`, `Tasse`, `Premio Lordo`, e i corrispondenti gemelli `_quietanza`. Sostituirli con una **tabella riepilogo per riga garanzia** letta da `premi_garanzia_polizza` (group by `tipo_premio`), con totali calcolati.
- **Mantenere**: split provvigioni (`renderSplitImporti`) Firma + Quietanza, valuta, indicizzata, rimborso (campi tuttora utili).
- **Sostituire `VociRcaCard`** con `PremiGaranziaCardShell` (le due card Firma/Quietanza identiche all'immissione) per editing inline. Riusiamo lo stesso componente → garantisce parità grafica e di campi.
- L'`editingImporti` mutation viene semplificata: aggiorna solo provvigioni/valuta/indicizzata/rimborso su `titoli`; le righe garanzia sono salvate dal `PremiGaranziaCardShell` direttamente in `premi_garanzia_polizza` (debounced UPDATE/INSERT/DELETE come già avviene in card analoghe).
- Mirroring trigger `sync_quietanza_da_firma` resta valido.

### D. Allineamento polizze vecchie (no migrazione DB obbligatoria)
- Backfill **opzionale** (read-only safe): UPDATE `titoli SET frazionamento = CASE rate WHEN 1 THEN 'Annuale' WHEN 2 THEN 'Semestrale' WHEN 3 THEN 'Quadrimestrale' WHEN 4 THEN 'Trimestrale' WHEN 12 THEN 'Mensile' ELSE 'Annuale' END WHERE frazionamento IS NULL AND rate IS NOT NULL`. Eseguito una tantum via migration.
- Non si tocca `premi_garanzia_polizza` storica: le card sull'esistente mostreranno solo le righe presenti (nessun crash).

### E. Memory
- Aggiornare `mem://insurance/policy-financial-structure-expansion` per riflettere che TitoloDetail usa `PremiGaranziaCardShell` e non più `VociRcaCard` legacy.

---

## File toccati

- `src/pages/ImmissionePolizzaPage.tsx` (filtro garanzie)
- `src/pages/TitoloDetail.tsx` (Periodo + Importi)
- `src/lib/frazionamento.ts` (nuovo helper condiviso)
- Migration SQL: backfill `titoli.frazionamento`
- `mem://insurance/policy-financial-structure-expansion` (update)

## Esempio concreto post-fix per polizza 122222
- "Periodo" mostrerà: Frazionamento = **Annuale** (derivato da `rate=1` o dal valore salvato).
- "Importi" mostrerà 2 card identiche all'immissione: card Firma vuota (la riga non era stata salvata → ora editabile inline e re-inseribile), card Quietanza con riga `DIA — 1.122,00 €` modificabile.
- Spariscono i FieldRow `Premio Netto —`, `Tasse —` ecc. che confondevano.
- Provvigioni split (INTERFIDI 40% / Consulbrokers 60%) restano invariate.
