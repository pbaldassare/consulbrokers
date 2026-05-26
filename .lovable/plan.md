## Obiettivo
Rimuovere il campo **Codice CIG** (e relativo checkbox "CIG temporaneo") dalla modale "Nuovo Cliente" quando si crea un Ente. Il CIG resta gestibile in seguito dal dettaglio cliente (e sui titoli/polizze).

## Modifiche
**`src/components/clienti/NuovoClienteDialog.tsx`**
- Rimuovere il blocco UI del campo "Codice CIG *" + checkbox "CIG temporaneo (formato libero)" + messaggio "Obbligatorio per gli Enti".
- Rimuovere stati locali `codiceCig`, `cigTemporaneo` e import correlati (`isValidCigWithFlag`, `normalizeCig`) se non più usati.
- Togliere dalla validazione submit la regola che blocca per CIG mancante/non valido quando `tipo === 'ente'`.
- Togliere `codice_cig` e `cig_temporaneo` dal payload di insert (la colonna a DB resta, semplicemente non valorizzata in creazione).

## Fuori scope
- Nessuna modifica a DB (colonne `codice_cig` e `cig_temporaneo` restano).
- Nessuna modifica a `ClienteDetail` né a `ImmissionePolizzaPage` (CIG su titoli invariato).
- Memoria `gruppi-finanziari-tipo-soggetto.md` da aggiornare: il CIG NON è più richiesto in creazione Ente (resta opzionale, compilabile dal dettaglio).
