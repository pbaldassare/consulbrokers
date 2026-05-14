Obiettivo: in Immissione Polizza, quando l’utente inserisce o modifica IPT/tasse e SSN sulla riga QA/RCA, il Premio Lordo non deve essere ricalcolato o modificato da quei valori.

Piano:
1. Aggiornare `PremiGaranziaCardShell` separando il valore lordo di riga dal totale tasse per le righe RCA:
   - il campo `Premio Lordo` deve restare guidato dal premio netto, non da IPT + SSN;
   - IPT e SSN restano visibili e modificabili, ma aggiornano solo il totale tasse/valori fiscali della riga.
2. Adeguare i totali della card:
   - `Totale Netto` invariato;
   - `Totale Tasse` continua a sommare IPT + SSN;
   - `Premio Lordo` non deve includere IPT/SSN per le righe RCA.
3. Adeguare il payload di salvataggio in `ImmissionePolizzaPage`:
   - `premio_lordo` e movimento iniziale non devono includere IPT/SSN quando derivano da righe RCA;
   - `tasse`, `imposta_provinciale` e `ssn` continuano a essere salvati correttamente nei campi dedicati.
4. Verificare in UI che, su QA — R.C. AUTO, modificare IPT o SSN lasci invariato il Premio Lordo mentre aggiorna solo il totale tasse.