## Obiettivo

La sezione "Dati Veicolo" oggi è **sempre visibile** in fondo al dettaglio di ogni polizza, anche quando il ramo non c'entra nulla con gli autoveicoli. Inoltre i ~30 campi sono mostrati in un'unica griglia disordinata. Va trasformata in una sezione **condizionale** (compare solo per rami auto) e **strutturata in sotto-blocchi logici**.

Tutti i campi necessari sono già nella tabella `veicoli_polizza` — non servono migrazioni DB. Lavoro solo di UI in `src/pages/TitoloDetail.tsx`.

## Quando si attiva la sezione

La sezione "Dati Veicolo / RCA Auto" sarà visibile se il ramo della polizza appartiene alla famiglia auto. Codici ramo coinvolti (già in DB):

- **PI** R. C. AUTOVEICOLI · **QA** R. C. AUTO · **QAC** RCA & ARD · **QC** R. C. AUTOCARRI · **QF/QG/QR/QU** RC interni Flotte auto · **DAB** Assistenza RCA · **PJ** Franchigie RCA
- Tutti i rami **RV01–RV16** (statistici "VEICOLO – ...")

Logica: `isRamoAuto = codice ∈ lista oppure codice inizia con "RV" oppure descrizione contiene "AUTO"/"VEICOL"`. Se `isRamoAuto` è false → la sezione non viene renderizzata.

Caso limite: se la polizza **non** è di ramo auto ma esiste già un record `veicoli_polizza` collegato (dato legacy), mostriamo comunque la sezione con un piccolo badge "Dati legacy" per non perdere l'informazione.

## Riorganizzazione campi in 4 sotto-blocchi

La sezione resta un unico `SectionCollapsible` "Dati Veicolo (RCA Auto)" con icona Car, ma internamente è suddivisa in 4 gruppi con titoletto, sia in lettura che in modifica:

**1. Identificazione veicolo**
Settore · Tipo Veicolo · Uso · Targa · Marca · Modello · Versione · Descrizione · Telaio (VIN) · Immatricolazione · Anno Acquisto · Provincia Circolazione

**2. Dati tecnici**
CV · KW · CC · Posti · Peso Motrice · Peso Rimorchio · Peso Totale · Alimentazione · Tipologia Guida

**3. Garanzie e massimali**
Massimale 1 · Massimale 2 · Massimale 3 · Franchigia · Peius · Temporanea · Carico/Scarico · Rimorchio · Competizione

**4. Bonus / Malus**
Classe B/M (CU)
*(Lasciamo il blocco predisposto: la tabella `veicoli_polizza` ha solo `classe_bm`. Se in futuro vuoi gestire anche CI, attestato di rischio e numero sinistri ultimi 5 anni dovremo aggiungere colonne — non lo facciamo ora come da tua indicazione di "ordinare ciò che già c'è".)*

## Comportamento UX

- Pulsante "Modifica/Aggiungi" resta in alto come ora
- In modalità lettura: griglia 4 colonne sotto ogni titoletto, valori vuoti mostrati come "—"
- In modalità modifica: stessa suddivisione in 4 blocchi con i Form input già esistenti, in griglia 3-4 colonne
- Nessuna modifica al salvataggio: la mutation esistente `saveVeicoloMutation` continua a inviare l'intero `veicoloForm` a `veicoli_polizza`

## File toccati

- `src/pages/TitoloDetail.tsx` — riga 2410-2496: sostituisco la sezione esistente con la versione condizionale + raggruppata. Aggiungo helper `isRamoAuto(t.ramo)` in cima al file.

## Cosa NON viene toccato

- Schema DB (nessuna migration)
- Tabella `veicoli_polizza` e relativa mutation di salvataggio
- Campo `targa_telaio` legacy in sezione "CONTRATTO" (resta dov'è, è separato)
- Le altre sezioni della pagina (Contratto, Periodo, Premi, Movimenti, ecc.)

Confermi e procedo?
