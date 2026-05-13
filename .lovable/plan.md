# Immissione Polizza — 3 correzioni

## Ho capito così:

### 1. Sezione "Tipo" in alto
Oggi è in fondo (dopo Provvigioni). La sposto **subito sotto "Cliente / Compagnia"**, prima di tutto il resto, perché Polizza/Emittenda/CP/Polizza Auto cambiano i campi richiesti — vanno scelti per primi.

### 2. Provvigioni Produttore automatiche (come fa l'IA)
Oggi nella sezione "Provvigioni" hai solo `% Provvigione Agenzia` + `Ripartizione Commerciale`. Nessun calcolo automatico per il produttore.

Replico la logica già presente nello scanner IA + memoria `produttore-provvigioni-per-ramo`:
- Quando selezioni **Produttore** + **Ramo**, faccio lookup su `produttori_provvigioni_ramo` (chiave `anagrafica_id + ramo_codice`) → prendo `percentuale_provvigione`. Fallback a `anagrafiche_professionali.percentuale_base`.
- Calcolo automatico mostrato a video (read-only, ricalcolo su ogni cambio):
  - **Provv. Produttore** = `provvigioni_quietanza * % produttore / 100`
  - **Differenza Consulbrokers SPA** = `provvigioni_quietanza − Provv. Produttore`
- Resta editabile: badge "auto" + possibilità di override manuale della %.
- I valori finiscono in `titoli.percentuale_commerciale` (già esistente) + Edge Function `calcola-provvigioni` farà il resto allo stato `incassato` (già implementata, vedi memoria `policy-commission-split`).

### 3. Niente Messa a Cassa in fase creazione
Tolgo dal form i campi: **Fax Incasso, Data Incasso, N° Incasso, Copertura Da, Copertura N°** (sezione "Incasso" della card Quietanza/Premi).

Il titolo viene creato in stato `creato` → poi diventa `attivo` → l'utente usa il **flusso standard "Messa a Cassa"** già presente in `TitoloDetail` (bottoni verde "Incassa" / arancio "Garantito") esattamente come per le altre polizze. Niente duplicazione di logica, conforme alla memoria `cash-posting-management`.

Payload `insert` aggiornato: rimossi `data_incasso`, `numero_incasso`, `fax_incasso`, `copertura_da`, `copertura_numero` dalla insert iniziale (verranno valorizzati dal flusso Messa a Cassa).

## File toccati
- `src/pages/ImmissionePolizzaPage.tsx` — riordino sezioni, rimozione campi incasso, hook lookup `produttori_provvigioni_ramo`, calcolo split produttore/Consulbrokers.

## Fuori scope
- Nessuna modifica al DB.
- Nessuna modifica a `TitoloDetail` / Messa a Cassa (già funzionanti).
- Nessuna modifica a `calcola-provvigioni`.

Confermi e procedo?
