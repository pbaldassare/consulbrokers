## Piano di intervento

1. **Rendere il dettaglio una vera continuazione della creazione**
   - Nella sezione **Importi** di `TitoloDetail`, mantenere solo le card Firma/Quietanza utili finché la polizza non è messa a cassa.
   - Rimuovere dalle card del dettaglio i campi extra non presenti in creazione: **Capitale**, **Tasso ‰**, **Rata**, **Annuo**.
   - Lasciare i campi coerenti con `PremiGaranziaCardShell` usato in `ImmissionePolizzaPage`: **Voce**, **Premio Netto**, **Aliquota %**, **Tasse**, **Premio Lordo**, azione rimozione, **Addizionali**, totali e provvigioni.

2. **Allineare grafica e contenuti delle card**
   - Sistemare `VociRcaCard` per usare larghezze colonne stabili e coerenti con la card di creazione.
   - Evitare che la colonna **Voce** venga tagliata: campo più largo, testo leggibile, input/select con `min-width` corretti e overflow orizzontale ordinato.
   - Uniformare padding, header, righe zebra, totali e footer provvigioni per non avere spacing “schiacciato” o disordinato.

3. **Mantenere la logica di modifica finché non è messa a cassa**
   - Lasciare editabili le righe premio quando la polizza non è bloccata.
   - Non modificare le operazioni esistenti: messa a cassa, annulla messa a cassa, incasso, rinnovo, storno, sospensione/riattivazione.
   - Non toccare database o migrazioni.

4. **Verifica finale**
   - Controllare che su `/titoli/7f2880c0-f486-4e34-b309-b12b8fbf1cfe` le card non mostrino più campi inutili e che le voci non risultino tagliate nella viewport attuale.