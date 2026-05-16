## Quota di Brokeraggio in Polizza

### Mappatura
- **Sorgente %**: `anagrafiche_professionali.percentuale_consulenza` (oggi etichettato "% Provv. Consulenza" sul produttore)
- **Logica analoga** a `provvigioni_firma` / `provvigioni_quietanza` ma calcolata con la `percentuale_consulenza` del Produttore selezionato in polizza

### 1. Database — nuova migration
Aggiungo su `public.titoli` due colonne `numeric` (mirror del pattern esistente per le provvigioni):
- `brokeraggio_firma numeric` — importo € sulla rata di firma
- `brokeraggio_quietanza numeric` — importo € sulla quietanza
- `percentuale_brokeraggio numeric` — % usata per il calcolo (snapshot, editabile)

Nessun trigger né vincolo: campi liberi come le provvigioni.

### 2. ImmissionePolizzaPage
- Aggiungo state `percentualeBrokeraggio` + `percentualeBrokeraggioAuto`
- Nello stesso `useEffect` che oggi auto-popola `percentuale_commerciale` dal Produttore (`percentuale_base`), aggiungo lookup di `percentuale_consulenza` → setta default %
- Calcolo `brokFirma = premio_netto × % / 100` e `brokQuietanza = premio_netto_quietanza × % / 100`
- Nuovo input `% Brokeraggio` accanto a `% Commerciale` nella card provvigioni
- Persisto i 3 nuovi campi nel `payload` di `finalizzaPolizza`

### 3. TitoloDetail
- Aggiungo `brokeraggio_firma` / `brokeraggio_quietanza` al form `importiForm` e alla `select(...)` della query titolo
- Due nuovi `EditableEuroField` analoghi a quelli delle provvigioni: uno nella card Firma, uno nella card Quietanza, entrambi `readOnly` quando polizza/rata è messa a cassa o stornata (rispetta `isLocked`)
- Mostra `% brokeraggio` come campo % editabile accanto a `% commerciale`

### 4. UI/etichetta
- Label utente: **"Brokeraggio"** (importo) e **"% Brokeraggio"** (percentuale)
- Tooltip: "Quota di brokeraggio del Produttore — default da % Provv. Consulenza"

### 5. Cosa NON cambia
- Provvigioni firma/quietanza esistenti restano identiche
- Split commerciali (`titoli_split_commerciali`), riparto e logica messa a cassa invariati
- Nessun impatto su rendiconti/E-C già esistenti (la nuova quota non entra automaticamente nei report finché non lo chiedi esplicitamente)

### Domande aperte (rispondi in chat, non blocca il piano)
- Va replicato anche nei rendiconti E/C agenzia e nelle provvigioni Sede? Per ora **no**, solo polizza.
- Tipologia calcolo: `premio_netto × %` (default scelto), confermi?

Confermi così?