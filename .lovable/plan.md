# Migliorare estrazione dati veicolo (PDF Cattolica & simili)

## Problema
Sul PDF Cattolica `184667297` i dati veicolo ci sono ma con etichette non standard:
- **Targa** solo nell'header `Polizza n. ... Targa / Telaio n. HD076XZ` (non in una sezione "veicolo")
- **Marca + Modello** in **una sola colonna** `VOLKSWAGEN CRAFTER 35 2.0 BITDI 177CV 4M…`
- Sinonimi non riconosciuti: `CAVALLI FISCALI`→cv, `POTENZA IN KW`→kw, `CLASSE DI MERITO UNIVERSALE`→classe_bm, `TIPO DI GUIDA`→tipologia_guida, `TIPOLOGIA`→tipo_veicolo, `USO`→uso_descrizione, `DATA PRIMA IMMATRICOLAZIONE`→data_immatricolazione

Risultato: l'AI lascia i campi vuoti perché non trova le esatte chiavi che cercavamo.

## Modifiche

### `supabase/functions/parse-polizza-completa/index.ts`
Estendere SOLO il prompt del blocco `shouldExtractVeicolo` (no nuove tabelle, no nuovi campi). Aggiungere una **mappa di sinonimi italiani** che l'AI deve riconoscere quando legge il PDF:

```
SINONIMI PER IL BLOCCO 'veicolo' (riconosci queste etichette nel PDF):
- "Targa", "Targa veicolo", "Targa / Telaio n.", header "Polizza n. ... Targa/Telaio n. XXXX" → targa
- "Telaio", "VIN", "N. telaio" → telaio
- "Tipologia", "Tipo veicolo", "Categoria" → tipo_veicolo
- "Uso", "Uso del veicolo", "Destinazione" → uso_descrizione
- "Marca/Modello", "Marca e modello", "Modello" (colonna unica):
    * il PRIMO TOKEN è la marca (es. "VOLKSWAGEN"),
    * tutto il resto è modello+versione (es. "CRAFTER 35 2.0 BITDI 177CV 4M…")
    * copia inoltre la stringa completa in 'descrizione'.
- "Data prima immatricolazione", "Immatricolazione", "Data immatricolazione" → data_immatricolazione (YYYY-MM-DD)
- "Alimentazione", "Carburante" → alimentazione
- "Cavalli fiscali", "CV fiscali", "CV" → cv (numero intero)
- "Potenza in KW", "KW", "Potenza kW" → kw (numero intero)
- "Cilindrata", "CC", "Cilindrata cm³" → cc
- "Posti", "N. posti", "Posti a sedere" → posti
- "Classe di merito universale", "CU", "Classe CU" → classe_bm (1-18)
- "Tipo di guida", "Tipologia guida", "Guida" → tipologia_guida (es. "Conducente qualsiasi", "Esperta", "Esclusiva")
- "Provincia di circolazione", "Provincia immatricolazione" → provincia_circolazione (2 lettere)
- "Valore assicurato veicolo", "Valore veicolo" → NON c'è campo dedicato, ometti.

REGOLA TASSATIVA (già presente, da ribadire): NON inventare nulla.
Se un'etichetta non compare nel PDF, OMETTI il campo. Numeri puliti
senza unità di misura (es. "130", non "130 KW"). Date YYYY-MM-DD.
```

Inoltre:
- Forzare l'AI a cercare la targa **anche nell'header di pagina** quando manca dalla sezione "Veicolo".
- Aggiungere esempio: `"Targa / Telaio n. HD076XZ" → targa: "HD076XZ"`.

### Bump `public/version.json`.

## Fuori scope
- Nessuna modifica al frontend: i campi sono già tutti gestiti in `handleAIImportApply`.
- Nessuna nuova colonna DB.
- Nessun OCR aggiuntivo: il PDF è già testuale.

## Verifica
Re-test sul PDF `COMUNE DI AGNONE HD076XZ`: ci si aspetta:
- targa = `HD076XZ`
- tipo_veicolo = `AUTOVETTURA`
- uso_descrizione = `Privato`
- marca = `VOLKSWAGEN`
- modello = `CRAFTER 35 2.0 BITDI 177CV 4M. PM-TA KOMBI CON RAMPA MANUALE`
- descrizione = stringa completa
- data_immatricolazione = `2026-05-18`
- alimentazione = `Diesel`
- cv = `20`, kw = `130`, classe_bm = `14`
- tipologia_guida = `Conducente qualsiasi`
- telaio, cc, posti = omessi (non presenti)
