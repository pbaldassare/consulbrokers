## Problema individuato

Nella pagina dettaglio cliente (`/archivi/clienti/:id`) ci sono due problemi concreti:

- La sezione **Codici Commerciali (Rete)** usa ancora ruoli/etichette e campi legacy: `account_executive`, `agente`, `produttore_sede`, `% Provvigione`, `Società/Brand`, `Mandato`, date mandato e `Altro Broker`.
- Il salvataggio dello **Specialist** non è coerente: una parte della pagina legge/scrive il ruolo `Backoffice`, mentre la sezione Codici Commerciali usa `backoffice`. Per questo alcuni dati sembrano non rimanere salvati o non ricompaiono dopo il refresh.

## Piano di intervento

1. **Rendere coerente la pagina anagrafica cliente con il flusso attuale di creazione cliente**
   - Tenere in alto le assegnazioni realmente usate oggi:
     - **Sede**
     - **Gruppo Finanziario**
     - **Specialist**
     - **Produttore / Consul**, se presente
   - Usare sempre la terminologia già decisa nel progetto: **Sede**, **Specialist**, **Consul**.

2. **Pulire la sezione “Codici Commerciali (Rete)”**
   - Rimuovere dalla UI i campi legacy non più utili:
     - `% Provvigione`
     - `Società/Brand`
     - `Mandato`
     - `Scadenza Mandato`
     - `Data Disdetta`
     - `Termine Proroga`
     - `Altro Broker`
     - `Nome Altro Broker`
     - `Agente`
     - `Produttore Sede` come dicitura legacy
   - Lasciare solo una sezione semplice di assegnazione rete coerente con il nuovo modello.

3. **Correggere la persistenza nel database**
   - Normalizzare il salvataggio dei ruoli commerciali usando gli stessi valori già presenti nei dati reali:
     - `Backoffice` per Specialist
     - `Produttore Sede` per il produttore/Consul esistente, ma mostrato in UI come **Consul**
     - `AE` per Account Executive, se mantenuto come assegnazione essenziale
   - Dopo ogni salvataggio invalidare e ricaricare le query corrette, così il dato salvato torna subito visibile senza refresh manuale.
   - Non serve una migrazione DB: le colonne esistono già e la tabella ha già il vincolo unico su `cliente_id, ruolo`.

4. **Allineare anche il dialog “Nuovo Cliente” condiviso**
   - Rimuovere i campi legacy dalla creazione cliente, così non ricompaiono in altri punti.
   - Salvare solo i profili commerciali realmente usati e persistenti.
   - Mantenere la Sede auto-compilata dallo Specialist ma sempre modificabile.

5. **Verifica finale**
   - Controllare che il cliente attuale mostri correttamente lo Specialist salvato.
   - Verificare che il salvataggio di Sede/Gruppo/Specialist/Consul persista dopo invalidazione query/refresh.
   - Verificare che non compaiano più i vecchi campi mandato/provvigione/brand nella pagina anagrafica cliente.