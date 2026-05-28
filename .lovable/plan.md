## Obiettivo
Per le polizze RCA Auto: i campi veicolo (Targa, Tipo Veicolo, Uso, Tipologia Guida, Alimentazione, ecc.) devono (a) essere estratti dall'IA quando possibile, (b) salvarsi correttamente in `veicoli_polizza`, (c) essere riproposti in `TitoloDetail` con la STESSA grafica/layout di `ImmissionePolizzaPage`. Inoltre rimuovere l'opzione "Esclusiva" da Tipologia Guida e renderla obbligatoria per RCA.

## Modifiche

### 1. ImmissionePolizzaPage.tsx
- Rimuovere `"Esclusiva"` dalle opzioni `Tipologia Guida` → restano `Libera`, `Esperta` (riga 2537).
- Aggiungere validazione: se ramo = RCA Auto e `vTipologiaGuida` vuoto → blocco salvataggio con toast "Tipologia Guida obbligatoria per RCA Auto".
- Marcare label `Tipologia Guida *`, `Targa *`, `Tipo Veicolo *`, `Uso *` (asterisco rosso) quando RCA.
- Estendere validazione blocco salvataggio anche su `vTarga`, `vTipoVeicolo`, `vUso` quando RCA.

### 2. parse-polizza-completa (edge function)
- Già estrae `targa`, `tipo_veicolo`, `uso_descrizione`, `tipologia_guida`. Rafforzare prompt: cercare la targa anche nell'header polizza ("Polizza n. XXX – Targa AB123CD") e includere SEMPRE il blocco veicolo per RCA Auto. Normalizzare `tipologia_guida` mappando "Esclusiva"/"Conducente unico" → `Esperta` (l'opzione Esclusiva non esiste più). Mappare `uso_descrizione` → id `rca_usi` lato client (già fa lookup).
- (Solo prompt/normalizzazione, no breaking change.)

### 3. TitoloDetail.tsx
- Rimuovere `"ESCLUSIVA"` da `TIPOLOGIA_GUIDA_OPTS` (riga 1086).
- Allineare il rendering della sezione Veicolo al layout di `ImmissionePolizzaPage` (stesse sezioni "Caratteristiche Tecniche", "Coperture e Massimali", "Clausole", "Dati Conducente", stessi label e ordine campi) così che dopo il salvataggio il dettaglio mostri esattamente la stessa UI dell'immissione (sola differenza: read-only fuori dalla modalità edit).
- Garantire che tutti i campi (`targa`, `telaio`, `marca`, `modello`, `versione`, `tipo_veicolo`, `uso`, `tipologia_guida`, `tipo_alimentazione`, CV/KW/CC/posti, pesi, massimali, franchigia, clausole, dati conducente) siano letti da `veicoli_polizza` + `conducenti_polizza` e mostrati.

### 4. DB — veicoli_polizza
- Lo schema esistente copre già tutti i campi. Verificare presenza colonne `targa`, `telaio`, `marca`, `modello`, `versione`, `tipo_veicolo`, `uso` (uuid FK rca_usi), `tipologia_guida`, `tipo_alimentazione`, `cv`, `kw`, `cc`, `posti`, `peso_motrice`, `peso_rimorchio`, `peso_totale`, `massimale_1/2/3`, `franchigia`, flag clausole. Nessuna migrazione prevista salvo eventuali colonne mancanti rilevate in fase di build.

## Note
- Nessuna modifica ai dati esistenti. Le polizze legacy con `tipologia_guida = "Esclusiva"` resteranno leggibili (verrà mostrato il valore raw); in edit verrà richiesto di scegliere fra Libera/Esperta.
- L'estrazione AI della targa è già attiva: viene anche copiata in `titoli.targa_telaio` (campo legacy) per compatibilità lista polizze.
