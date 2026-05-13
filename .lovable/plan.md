## Piano

1. **Correggere la finestra “Nuovo Cliente” usata in `/archivi/clienti`**
   - Rimuovere dalla sezione “Rete Commerciale” tutti i campi legacy ancora presenti: `% Provvigione`, `Società/Brand`, `Mandato`, date mandato/disdetta/proroga, `Altro Broker`.
   - Rimuovere completamente il blocco `Agente`, perché non serve nel nuovo modello.
   - Rinominare il blocco `Produttore Sede` in `Consul`.
   - Lasciare solo le assegnazioni coerenti: `Account Executive`, `Specialist`, `Sede`, `Consul`, ciascuna con il solo selettore profilo/sede quando previsto.

2. **Allineare il salvataggio del vecchio dialog integrato in `ClientiList.tsx`**
   - Salvare in `codici_commerciali_cliente` solo `AE`, `Backoffice` e `Produttore Sede`.
   - Non inviare più colonne legacy commerciali (`percentuale`, `societa_brand`, `mandato`, date, `altro_broker`) da quel flusso.

3. **Pulizia tecnica mirata**
   - Semplificare il tipo `CommercialRole` e lo stato del form in `ClientiList.tsx` per contenere solo `profilo_id`.
   - Eliminare helper/UI inutilizzati legati ai campi legacy.
   - Verificare con una ricerca finale che nel modulo clienti non restino label visibili legacy come `% Provvigione`, `Società/Brand`, `Mandato`, `Agente`, `Produttore Sede`.