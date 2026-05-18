## Problema

Nella dialog "Nuovo Rapporto" il pulsante **Salva Rapporto** resta disabilitato perché l'IBAN inserito (`IT38F5086642546323232233232`) non supera il controllo mod-97 in `validateIban`. Anche cliccando, il salvataggio sarebbe comunque bloccato dall'errore lanciato in `persistContoRapporto`.

L'utente vuole poter salvare il rapporto **anche con IBAN non valido o vuoto**, senza essere bloccato.

## Soluzione

In `src/components/compagnie/RapportiCompagniaDialog.tsx`:

1. **Pulsante Salva sempre abilitato** quando i campi obbligatori (Nome rapporto + Compagnia) sono compilati.
   - Rimuovere la condizione `(!!form.conto_iban.trim() && !validateIban(form.conto_iban).valid)` dal `disabled` del bottone.

2. **IBAN non valido → conto bancario non creato, ma rapporto salvato.**
   - In `saveMutation.mutationFn`: se l'IBAN è vuoto **oppure non valido**, saltare `persistContoRapporto` e salvare il rapporto con `conto_bancario_id: null`.
   - Mostrare un toast warning ("Rapporto salvato senza conto bancario: IBAN non valido o assente") quando l'IBAN era stato compilato ma rifiutato.

3. **Feedback inline invariato**: l'input IBAN continua a mostrare il bordo rosso + messaggio di errore sotto il campo, così l'utente sa che quel valore non verrà persistito come conto.

4. Nessuna modifica al DB, alle policy, o agli altri campi della form.

## Fuori scope

- Logica di validazione IBAN (`validateIban`): resta com'è.
- Conti bancari delle compagnie / sedi.
- Tab Provvigioni separato (sarà un task successivo).
