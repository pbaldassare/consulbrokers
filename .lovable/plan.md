## Obiettivo
Generare un documento Markdown scaricabile che mostra, per ciascuna operazione su polizza (Sospensione, Riattivazione, Sostituzione, Estinzione, Appendici, Storno, Regolazione), gli effetti su: **rata target**, **quietanze future**, **quietanze già a cassa**, **contabili / movimenti**, **pagamenti & provvigioni**, **vista cliente**, **documenti** e **log**.

Nessuna modifica al codice dell'app. Solo file artifact in `/mnt/documents/operazioni-polizza-effetti.md`, scaricabile dall'utente.

## Contenuto del documento

1. Premessa modello dati (catena `titoli` con stesso `numero_titolo`, madre + N quietanze).
2. Una sezione per operazione con tabella effetti:
   - **Sospensione** — cancella future non incassate, stato `sospeso`, badge in Attive, movimento `SO`.
   - **Riattivazione** — ricrea quietanze, opzionale titolo "Oneri", movimento `RA`.
   - **Sostituzione** — cambia oggetto, conguaglio opzionale, snapshot `titoli_sostituzioni`, movimento `SO`.
   - **Estinzione** — chiude polizza, cancella future, rimborso opzionale negativo, movimento `ES`.
   - **Appendici** — documentale + eventuale titolo extra.
   - **Storno** — annullo, cancella future, se era a cassa crea speculare negativo da incassare in remittance, movimento `ST`.
   - **Regolazione** — nuovo titolo `RG`, importi manuali, snapshot `titoli_regolazioni`, movimento `RG`.
3. **Schema riassuntivo** tabellare di tutti gli effetti.
4. **Note trasversali**: trigger anti-doppio incasso, auto-generazione quietanza successiva, logging, bucket documenti, regola "importi sempre manuali".

## Output
- File: `/mnt/documents/operazioni-polizza-effetti.md`
- Scaricabile via `<presentation-artifact path="operazioni-polizza-effetti.md" mime_type="text/markdown">`

## Cosa NON tocco
Nessun file di progetto, nessuno schema DB, nessuna logica.
