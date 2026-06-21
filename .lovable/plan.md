Nessuna modifica al codice — solo chiarimento.

## Dove sono finite le provvigioni

Dal reset compagnie del 16/05/2026 (memoria `compagnie-form-pulita`) la form "Modifica Agenzia" è stata ripulita e mostra solo 3 tab:
- **Identificativi** (tipo, codice univoco, ragione sociale, compagnia madre, stato)
- **Anagrafica**
- **RUI & Bancario**

Le provvigioni **non sono più dentro questa form per scelta progettuale**.

## Dove gestirle adesso

- Pagina dedicata: **`/provvigioni-compagnie-ramo`** (memoria `provvigioni-compagnie-ramo-page`)
- Modello: matrice **Rapporto compagnia × Ramo/Sottoramo**, filtrata sui rami abilitati nella tabella `compagnia_rapporto_rami` (memoria `compagnia-rapporto-rami-abilitati`)
- Per agenzie plurimandatarie/broker con più rapporti contemporanei: tabella `compagnia_rapporti` (memoria `compagnia-rapporti-multipli`)

## Non si fa nulla

L'utente ha scelto "Solo spiegazione, niente modifiche": non aggiungo pulsanti, link in sidebar né colonne nella lista Compagnie.

Se in futuro vuoi un accesso rapido dalla scheda agenzia, basta chiedere: si può aggiungere un pulsante "Provvigioni" nella form che apre `/provvigioni-compagnie-ramo` precompilato sull'agenzia corrente.
