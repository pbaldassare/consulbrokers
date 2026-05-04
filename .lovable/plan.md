# Rimozione del legacy `iban_dedicato` da `RapportiCompagniaDialog`

Il campo `iban_dedicato` è già stato sostituito a livello UI dal selettore master `ContoBancarioSelect` (che scrive su `conto_bancario_id`), ma il valore continua a vivere in:

- l'interfaccia TypeScript `RapportoForm` (riga 44)
- il valore iniziale `emptyForm` (riga 61)
- il payload inviato a `compagnia_rapporti` in INSERT/UPDATE (riga 120)
- il caricamento del form in `openEdit` (riga 186)

## Modifiche a `src/components/compagnie/RapportiCompagniaDialog.tsx`

1. Rimuovere il campo `iban_dedicato: string` dall'interfaccia `RapportoForm`.
2. Rimuovere `iban_dedicato: ""` da `emptyForm`.
3. Rimuovere `iban_dedicato: form.iban_dedicato || null` dal payload della mutation `saveMutation` (lasciando solo `conto_bancario_id`).
4. Rimuovere `iban_dedicato: r.iban_dedicato || ""` dalla funzione `openEdit`.

Nessun input visibile da rimuovere: il campo non era già più editabile da UI.

## Effetto

Da questo momento, salvando un rapporto:
- il campo legacy `compagnia_rapporti.iban_dedicato` non viene più sovrascritto (resta a NULL per i nuovi inserimenti, mantiene il valore esistente per quelli vecchi finché non vengono modificati)
- il valore esistente NON viene azzerato durante un update perché il campo è semplicemente omesso dal payload (Postgres lascia invariate le colonne non menzionate)
- l'unica fonte di verità per il conto del rapporto è `conto_bancario_id` → `conti_bancari`

## Fuori scope

Drop della colonna `compagnia_rapporti.iban_dedicato`: la lascio in DB per back-compat, come da piano IBAN approvato. La rimuoveremo con una migration separata dopo aver verificato che nessuna lettura residua la usa.
