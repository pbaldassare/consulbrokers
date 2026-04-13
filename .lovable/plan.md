

## Piano: Popolare dati RCA Auto per polizza 332434490

### 1. Aggiornare testata `titoli`
UPDATE per il record `d97f56e6-4ad1-4e6d-aa85-d756b1416501`:
- `durata_a` → `2027-04-17` (polizza triennale)
- `garanzia_da` → `2026-04-17` (annualità corrente)
- `anni_durata` → `3`

### 2. Inserire dati veicolo in `veicoli_polizza`
INSERT con:
- settore: Autovetture, tipo_veicolo: AUTOVETTURA, uso: PRIVATO
- marca: Volkswagen, modello: Passat I, targa: FA637ZA
- veicolo_descrizione: PASSAT TG. FA637ZA - NICOLA PIROVANO
- provincia_circolazione: Potenza, classe_bm: 11
- cv: 20, kw: 110, cc: 0, posti: 5
- franchigia: 0, peius: false, temporanea: false
- carico_scarico: false, competizione: false, rimorchio: false

### 3. Inserire dettaglio premi in `premi_garanzia_polizza`
INSERT di 3 righe:

| # | Garanzia | Capitale | Firma | Rata | Annuo |
|---|----------|----------|-------|------|-------|
| 1 | RC | 0 | 447.36 | 447.36 | 0 |
| 2 | Furto/Incendio/Eventi | 13000 | 163.91 | 163.91 | 0 |
| 3 | Ass. Stradale | 0 | 32.73 | 32.73 | 0 |

### Dettagli tecnici
- Tutte le operazioni via tool INSERT/UPDATE (non migrazioni schema)
- Titolo ID: `d97f56e6-4ad1-4e6d-aa85-d756b1416501`

