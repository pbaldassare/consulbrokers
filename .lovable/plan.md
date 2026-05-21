Implementerò il riuso della logica IA già presente, adattandola alla nuova matrice Ramo/Sottoramo e al popup “Import IA tariffario provvigioni”.

## Piano

1. Aggiornare il popup Import IA
- Permettere caricamento di PDF e immagini come ora.
- Mostrare nome file, stato analisi, righe estratte e conteggio salvabile.
- Rendere il salvataggio utilizzabile anche quando l’IA estrae solo il ramo senza sottoramo.

2. Migliorare il matching Ramo/Sottoramo
- Usare normalizzazione più robusta: maiuscole, accenti, punteggiatura, spazi, alias comuni.
- Confrontare sia `codice` sia `descrizione` di `gruppi_ramo` e `rami`.
- Quando l’IA trova solo “Infortuni” con una %, collegarlo correttamente al Ramo INFORTUNI come default ramo.
- Quando trova sottorami, salvare le righe puntuali sui sottorami.

3. Riutilizzare la logica di salvataggio esistente
- Far passare l’import IA dallo stesso `upsertMutation` già usato da inserimento manuale, CSV e bulk apply.
- Inserire/aggiornare `provvigioni_compagnia_ramo` con `compagnia_rapporto_id`, `gruppo_ramo_id`, `ramo_id` e `percentuale_provvigione`.
- Evitare l’import vecchio basato su `categorie_prodotto`, che non è più coerente con la matrice Ramo/Sottoramo.

4. Migliorare errori e fallback
- Evidenziare le righe “no match” senza bloccare quelle valide.
- Mostrare un messaggio leggibile se l’IA non estrae righe o se il file non è supportato.
- Se necessario, aggiornare il prompt della Edge Function `parse-tariffario-rami` per estrarre più precisamente ramo, sottoramo e percentuale.

5. Verifica finale
- Controllare che il popup non resti con “Salva 0” dopo un allegato valido.
- Verificare che una % su “Infortuni” venga salvata come default del ramo e che eventuali sottorami estratti vengano salvati come righe specifiche.
- Verificare che la matrice si aggiorni dopo il salvataggio.