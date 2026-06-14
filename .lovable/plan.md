## Causa
Il prefill di Compagnia/Agenzia in `src/pages/ImmissionePolizzaPage.tsx` (riga ~745) interroga `titoli` filtrando su `cliente_id`, ma in fase di salvataggio (riga 1390) il cliente viene scritto su `cliente_anagrafica_id` (la colonna effettivamente usata in tutto il modulo Immissione). Risultato: per ogni cliente la query restituisce 0 righe e i campi restano vuoti anche dopo aver salvato una o più polizze.

Verifica DB: l'unico titolo salvato per RENT AND EVENTS SRL ha `cliente_anagrafica_id` valorizzato e `cliente_id = NULL`.

## Modifica
File: `src/pages/ImmissionePolizzaPage.tsx`, effetto "Prefill Compagnia/Agenzia dall'ultima polizza del cliente" (righe 730‑773).

- Sostituire `.eq("cliente_id", selectedClienteId)` con `.eq("cliente_anagrafica_id", selectedClienteId)` nella query su `titoli`.
- Nessun'altra logica viene toccata (ordine `created_at desc`, guardia `selectedCompagnia || selectedRapportoId`, hint teal, lookup `gruppo_compagnia_id` per agenzia/direzione restano invariati).

## Effetto atteso
Dalla seconda polizza salvata per lo stesso cliente, i campi **Compagnia Assicurativa** e **Agenzia di Riferimento** vengono precompilati con i valori dell'ultima polizza salvata. L'utente può modificarli; la nuova scelta diventa la preferenza per la prossima polizza dello stesso cliente.