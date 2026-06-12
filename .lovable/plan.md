Risolverò il problema nella pagina `/sinistri/apertura` intervenendo solo sul wizard di apertura sinistro.

Piano:
1. Rendere il pulsante del `SearchableSelect` sicuro dentro i form impostando il trigger come `type="button"`, così il click non tenta di inviare/validare il form e il menu può aprirsi correttamente.
2. Nel wizard sinistri, rendere la polizza realmente facoltativa:
   - schema `titolo_id` opzionale;
   - step 1 non blocca più l'avanzamento se non viene selezionata una polizza;
   - insert del sinistro salva `titolo_id: null` quando non c'è selezione.
3. Collegare la select anche alle polizze CGA del cliente preselezionato, oltre ai `titoli`, mappandole nella stessa lista visuale usata dal selettore.
4. Evitare che una bozza locale vecchia sovrascriva il `cliente_id` in URL quando si arriva da una scheda cliente, così la lista mostra le polizze del cliente corretto.
5. Aggiornare testi/placeholder dello step 1 per indicare che il collegamento polizza è opzionale.