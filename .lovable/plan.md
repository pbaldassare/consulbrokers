

## Piano: Completare il form Immissione Polizza allineandolo al vecchio sistema

### Analisi differenze (screenshot vs attuale)

Il **TitoloDetail** (visualizzazione) è già abbastanza completo. Il problema principale è il form **ImmissionePolizzaPage** che non cattura molti campi che il vecchio sistema richiede. I campi esistono già nel DB (tabella `titoli`) ma non vengono inseriti.

| Sezione | Campi mancanti in ImmissionePolizzaPage |
|---|---|
| **Periodo** | Garanzia Da/A, Data Competenza, Limite Mora, Disdetta (mesi) |
| **Regolazione** | Intera sezione mancante: checkbox Sì, Tipo Lettera (dropdown), Tipo Scadenza (dropdown), GG Presentazione, Periodicità (già presente ma va spostata qui), Libro Matricola (radio No/Auto/Altro) |
| **Importi** | Riga Quietanza (Netto/Add./Tasse/Totale/Provv.), checkbox Rimborso, Indicizzata, No Calcolo Tasse, Pag. Diretto Compagnia, Emissione Fee, Formato Elettronico, Fax Incasso (radio Sì/No), Cambio, Copertura (data + numero), Incasso (data + numero + codice) |
| **Contratto** | Vincolo come dropdown (non text), Gruppo Ramo mostrato come badge |

### Cosa fare

**File unico da modificare: `src/pages/ImmissionePolizzaPage.tsx`**

1. **Sezione Periodo** — aggiungere i campi:
   - `garanziaDa`, `garanziaA` (date)
   - `dataCompetenza` (date)
   - `limiteMora` (date)
   - `disdettaMesi` (number)

2. **Nuova sezione Regolazione** — aggiungere fieldset dopo Periodo:
   - `regolazione` (checkbox Sì)
   - `tipoLetteraRegolazione` (dropdown: specificare tipo)
   - `tipoScadenza` (dropdown: no scadenza, a scadenza)
   - `giorniPresentazione` (number)
   - Spostare `periodicita` qui (dal periodo)
   - `libroMatricola` (radio: No / Auto / Altro)

3. **Sezione Importi** — espandere significativamente:
   - Aggiungere riga **Firma** e riga **Pros. Quietanza** con struttura tabellare (Netto, Addizionali, Tasse, Totale calcolato, Provvigioni calcolate)
   - Aggiungere checkbox/flag: `rimborso`, `indicizzata`, `noCalcoloTasse`, `pagDirettoCompagnia`, `emissioneFee`, `formatoElettronico`
   - Aggiungere radio `faxIncasso` (Sì/No)
   - Aggiungere campo `cambio` (numerico, default 1)
   - Aggiungere campi `coperturaDa` (date) + `coperturaNumero` (text)
   - Aggiungere campi incasso: `dataIncasso` (date), `numeroIncasso` (text)

4. **Sezione Contratto** — piccolo fix:
   - `vincolo` da Input a SearchableSelect (dropdown: "Specificare il vincolo (eventuale)")
   - Mostrare il **Gruppo/Categoria** del ramo selezionato come Badge, come nel vecchio sistema

5. **Aggiornare `finalizzaPolizza()`** per includere tutti i nuovi campi nel payload di salvataggio

### Nessuna modifica DB
Tutti i campi esistono già nella tabella `titoli` (garanzia_da, garanzia_a, data_competenza, limite_mora, disdetta_mesi, regolazione, tipo_scadenza, giorni_presentazione, tipo_lettera_regolazione, libro_matricola, rimborso, indicizzata, pag_diretto_compagnia, formato_elettronico, premio_netto_quietanza, addizionali_quietanza, tasse_quietanza, provvigioni_quietanza, ecc.)

