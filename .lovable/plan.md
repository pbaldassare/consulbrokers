## Piano

1. **Correggere la duplicazione delle voci garanzia RCA**
   - Sistemare il mirroring Firma → Quietanza per copiare tutte le colonne della voce, non solo importi/calcoli.
   - Includere anche i campi storici della tabella `premi_garanzia_polizza`: `capitale`, `tasso`, `rata`, `annuo`, oltre a `garanzia`, `codice_garanzia`, `ordine`, tasse/IPT/SSN e lordo.
   - Rendere la sincronizzazione più robusta contro duplicati già presenti: per ogni voce Firma deve esistere una sola voce Quietanza collegata tramite `voce_origine_id`.

2. **Pulire il caso già visibile nella polizza corrente**
   - Aggiungere nella migration una bonifica sicura delle Quietanze duplicate/non personalizzate create senza `voce_origine_id`, così non restano righe doppie tipo “Spese recupero unibox”.
   - Rieseguire la funzione di sync per riallineare le voci esistenti.

3. **Aggiornare il fallback frontend di “Risincronizza”**
   - In `VociRcaCard`, quando l’RPC fallisce e parte il fallback client-side, copiare anche `capitale`, `tasso`, `rata`, `annuo` e tutti i metadati disponibili.
   - Evitare che il fallback lasci righe quietanza personalizzate duplicate con lo stesso `codice_garanzia`.

4. **Arricchire l’intestazione del dettaglio polizza**
   - Sotto “Polizza {numero}” aggiungere una riga ordinata con:
     - **Agenzia di riferimento** (`uffici.nome_ufficio`)
     - **Importo alla firma** (`premio_lordo`, formattato in euro)
     - **Cliente** (`cliente_anagrafica`, con ragione sociale o cognome/nome)
   - Mantenere compagnia/prodotto come informazione secondaria e layout responsive senza appesantire l’header.

## File coinvolti

- `supabase/migrations/...sql` nuova migration per sync/bonifica DB.
- `src/components/polizze/VociRcaCard.tsx` per fallback “Risincronizza”.
- `src/pages/TitoloDetail.tsx` per header polizza.

## Verifica

- Controllare in lettura la polizza `076a48d8-f31f-4911-8faf-0f680ff02672`: Firma e Quietanza devono avere le stesse voci, senza duplicati indesiderati.
- Verificare nel preview che l’header mostri chiaramente agenzia, importo alla firma e cliente.