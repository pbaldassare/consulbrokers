Corretto: il problema non è solo estrarre la voce (“Ricorso terzi…”), ma collegarla al sottoramo DB e alla sua aliquota tasse.

Piano di intervento:

1. In `ImmissionePolizzaPage.tsx`, estendere il caricamento `ramiList` includendo `aliquota_tasse_ramo`, oggi non selezionata.
2. Nel mapping `handleAIImportApply` delle `d.garanzie`, quando una voce AI viene collegata a un sottoramo (`match`):
   - usare `match.aliquota_tasse_ramo` come `aliquotaTasse` della riga;
   - se il PDF non ha imposto esplicito (`premio_imposte` mancante), calcolare `tasse = netto * aliquota / 100`;
   - se il PDF ha già un importo imposte, mantenerlo ma mostrare comunque l’aliquota DB corretta;
   - mantenere SSN separato solo dove `ssn_attivo` è vero.
3. Aggiornare il fallback della riga unica, quando non ci sono `garanzie[]`, per non inventare aliquote: resta manuale.
4. Aggiornare `public/version.json`.

Fuori scope: non cambio lo schema DB e non aggiungo nuovi campi; uso le aliquote già presenti sui sottorami `rami.aliquota_tasse_ramo`.