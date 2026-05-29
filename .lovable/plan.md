Dalla verifica sulla polizza aperta `184667297` risulta che l'annullamento ha già lavorato: il titolo è in stato `annullato`, le righe collegate sono a zero, e il log `annullamento_polizza_cascade` indica che sono state eliminate 1 quietanza, 1 provvigione, 1 riga rimessa e 1 movimento polizza. Il problema è che il flusso è poco chiaro in UI e l'annullamento oggi è client-side, quindi non è abbastanza robusto/trasparente.

## Piano

1. **Spostare l'annullamento in una funzione DB transazionale**
   - Creare una RPC `annulla_polizza_cascade(titolo_id)` che esegue tutto in una sola transazione.
   - Raccolta ricorsiva delle quietanze discendenti.
   - Eliminazione di: righe pagamento provvigioni, provvigioni generate, righe rimessa, movimenti contabili, movimenti polizza, split commerciali, quietanze figlie.
   - Reset del titolo principale e stato finale `annullato`.
   - Scrittura di un solo log con i conteggi eliminati.

2. **Gestire anche le testate rimessa rimaste vuote**
   - Dopo aver cancellato `rimessa_dettaglio`, ricalcolare o annullare/eliminare le `rimessa_premi` rimaste senza righe.
   - Così la parte “rimesse a cassa” non resta sporca con testate vuote o totali incoerenti.

3. **Aggiornare `annullaPolizza.ts`**
   - Sostituire la catena di delete client-side con una chiamata unica alla RPC.
   - Restituire alla UI i conteggi effettivi cancellati.
   - Evitare stati parziali se un delete fallisce a metà.

4. **Migliorare la UI dopo conferma annullamento**
   - Disabilitare il bottone “Annullamento” quando il titolo è già `annullato`.
   - Dopo l’annullamento, aggiornare subito titolo, quietanze, provvigioni, rimesse e movimenti.
   - Mostrare un messaggio più esplicito: cosa è stato eliminato e cosa resta come log.

5. **Rendere visibile la parte “messa a cassa / rimesse”**
   - Integrare nel pannello “Dove sono salvati i dati” le righe mancanti per:
     - Messa a Cassa
     - Rimessa premi / righe rimessa
     - Annullamento polizza
   - Aggiungere, nel dettaglio polizza, un piccolo riepilogo dinamico dei collegamenti contabili presenti o eliminati, così non sembra che “non si vedano”.

6. **Verifica finale**
   - Controllare una polizza annullata: stato `annullato`, nessuna quietanza/provvigione/rimessa/movimento collegato, log presente.
   - Controllare una polizza non annullata: mostra correttamente eventuali righe rimessa/messa a cassa prima dell’annullamento.