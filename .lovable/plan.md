Problema individuato: il click su “Applica” arriva correttamente e prova a inserire le righe dei sottorami, ma Supabase risponde 400 perché la tabella `provvigioni_compagnia_ramo` ha ancora `categoria_id` obbligatorio e il payload attuale non lo valorizza. Quindi i sottorami non si aggiornano.

Piano di intervento:
1. Aggiornare `ProvvigioniRapportiTab.tsx` per caricare anche la mappatura `categorie_prodotto` ↔ `gruppi_ramo`.
2. Quando si salva una provvigione per default ramo o sottoramo, includere sempre `categoria_id` coerente con il `gruppo_ramo_id`, così l’insert rispetta il vincolo DB esistente.
3. Aggiungere una protezione chiara: se per un ramo manca la categoria collegata, mostrare un errore leggibile invece del messaggio tecnico “categoria_id null”.
4. Verificare dal network che “Applica %” generi POST/PATCH riuscite e che i sottorami passino da `0% (nessuna regola)` alla percentuale impostata.