## Obiettivo
Far funzionare l'import IA degli allegati provvigionali: il file deve arrivare alla funzione, mostrare una vera anteprima delle righe estratte e permettere il salvataggio solo dei dati validi.

## Diagnosi
- La chiamata frontend parte, ma la Edge Function `parse-tariffario-rami` risulta **non deployata**: il test diretto restituisce `404 Requested function was not found`.
- Per questo il browser mostra `Failed to fetch`, non arrivano log della funzione e la modale resta senza anteprima / con `Salva 0`.

## Piano di intervento
1. **Deploy della Edge Function**
   - Deployare `parse-tariffario-rami` su Supabase/Lovable Cloud.
   - Verificare subito con una chiamata diretta che non risponda più 404.

2. **Verifica runtime Lovable AI**
   - Testare la funzione con un PDF minimo e controllare i log.
   - Se manca `LOVABLE_API_KEY`, abilitarla/crearla tramite Lovable AI Gateway invece di chiedere chiavi all'utente.

3. **Anteprima robusta in modale**
   - Mostrare sempre uno stato leggibile: caricamento, analisi, errore, warning o righe estratte.
   - Se l'IA estrae righe ma non riesce a matchare Ramo/Sottoramo, visualizzare comunque le righe grezze con campi correggibili.
   - Disabilitare `Salva` quando non ci sono righe valide e mostrare perché.

4. **Fallback per documenti difficili**
   - Se il PDF non produce righe strutturate, mantenere il warning visibile in modale e suggerire upload immagine/JPG.
   - Conservare i log dettagliati lato funzione per capire se il problema è credito, rate limit, gateway o leggibilità documento.

## Validazione
- Riprovare l'upload dallo stesso dialog su `/compagnie`.
- Confermare che la rete non mostra più 404/Failed to fetch.
- Confermare che la modale mostra righe di anteprima oppure un errore/warning chiaro, non una schermata vuota.