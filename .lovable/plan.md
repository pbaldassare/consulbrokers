## Stato attuale

Il pulsante **Salva Rapporto** in `RapportiCompagniaDialog.tsx` è già configurato per essere abilitato quando sono compilati solo i due campi obbligatori:

- Nome rapporto
- Compagnia Assicurativa (`gruppo_compagnia_id`)

L'IBAN non blocca più il salvataggio: se vuoto o non valido, il rapporto viene salvato con `conto_bancario_id = null` e mostra un toast di warning.

## Cosa fare ora

1. **Scrollare in alto nella dialog** e verificare che siano compilati:
   - Nome rapporto (es. "Nobis – Verona")
   - Compagnia Assicurativa (dropdown gruppo)
2. Cliccare **Salva Rapporto** — dovrebbe funzionare immediatamente.

## Se il pulsante è ancora disabilitato

Apro un'indagine mirata con i console logs / network requests per capire quale campo manca, poi rimuovo eventuali validazioni residue.

## Se compare un errore al salvataggio

Catturo il messaggio di errore (toast + console) e correggo il payload o il vincolo DB corrispondente (es. colonne obbligatorie, foreign key, RLS).

## Fuori scope

- Tab Provvigioni (già spostato in pagina dedicata `/provvigioni-compagnie-ramo`).
- Modifiche alla validazione IBAN.
