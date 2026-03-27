

## Piano: Caricare polizza RCA reale di RENT AND EVENTS SRL con storico movimenti

### Dati dagli screenshot

**Polizza**: 332434490 — R.C. AUTOVEICOLI
- Cliente: RENT AND EVENTS SRL (già presente, ID: `2451d38a-...`)
- Compagnia: **ASSISA** — ASSISUD DI GREGORIO ANGELO & C. SAS (NON esiste nel DB, va creata)
- Ramo: RCA AUTO (ID: `fbd5eab1-...`)
- Gruppo: ZQ / R.C.A.
- Specialist: GG — GUARRACINO GAETANO (ID: `cf2372e6-...`)
- Ufficio: Agenzia Napoli (ID: `68506cb3-...`)
- Descrizione: PASSAT TG. FA637ZA - NICOLA PIROVANO

**Periodo (Polizza Base / anno 1)**:
- Durata: 17/04/2024 → 17/04/2026 (2 anni)
- Garanzia: 17/04/2024 → 17/04/2025
- Rate: 1, Tipo rinnovo: Tacito rinnovo, Mora: 15gg, Disdetta: 2mm

**Importi Firma (anno 1)**:
- Netto: 417,34 — Add: 196,64 — Tasse: 136,02 — Totale: 750,00 — Provv: 57,48

**Importi Quietanza (anno 2)**:
- Netto: 447,36 — Add: 196,64 — Tasse: 140,00 — Totale: 784,00 — Provv: 59,44

**2 Movimenti**:
1. **Polizza Base** — Data 17/04/2024, Eff 17/04/2024, Scad 17/04/2025, Premio 750,00, Provv 57,48, Stato: Rinn (rinnovato)
2. **Polizza Quietanza** — Data 23/04/2025, Eff 17/04/2025, Scad 17/04/2026, Premio 784,00, Provv 59,44, Stato: da incassare

**Dati Veicolo**:
- Settore: Autovetture, Tipo: AUTOVETTURA, Uso: PRIVATO
- Marca: Volkswagen, Modello: Passat V
- Targa: FA637ZA, Descrizione: PASSAT TG. FA637ZA - NICOLA PIROVANO
- Provincia: Potenza, Classe B/M: 11
- CV: 20, KW: 110, CC: 0, Posti: 5

**Premi per Garanzia**:
| Garanzia | Capitale | Tasso | Firma | Rata | Annuo |
|---|---|---|---|---|---|
| RC | — | — | 447,36 | 447,36 | 0 |
| Furto/Incendio/Eventi | 13000 | 0 | 163,91 | 163,91 | 0 |
| Tutela Legale | 0 | 0 | 0 | 0 | 0 |
| ARD (varie) | 0 | 0 | 0 | 0 | 0 |
| Kasko/Cristalli | 0 | 0 | 0 | 0 | 0 |
| Ass. Stradale | 0 | 0 | 32,73 | 32,73 | 0 |
| Infortuni | 0 | 0 | 0 | 0 | 0 |

### Cosa fare

**1. Creare compagnia ASSISA**
- Insert in `compagnie`: codice `ASSISA`, nome `ASSISUD DI GREGORIO ANGELO & C. SAS`

**2. Inserire il titolo (polizza)**
- Numero: 332434490, Riga: 0, Appendice: 000
- Con tutti i dati contratto, periodo, regolazione, importi (firma + quietanza)
- Cliente: RENT AND EVENTS SRL, Ramo: RCA AUTO, Compagnia: ASSISA
- Specialist: GUARRACINO GAETANO

**3. Inserire 2 movimenti in `movimenti_polizza`**
- Movimento 1: Polizza Base (anno 1) — premio 750, provvigioni 57,48
- Movimento 2: Polizza Quietanza (anno 2) — premio 784, provvigioni 59,44

**4. Inserire dati veicolo in `veicoli_polizza`**
- Volkswagen Passat V, targa FA637ZA, classe B/M 11, ecc.

**5. Inserire premi garanzia in `premi_garanzia_polizza`**
- 7 righe (RC, Furto/Incendio, Tutela Legale, ARD, Kasko, Ass. Stradale, Infortuni)

### Approccio tecnico
- Tutto via **migrazione SQL** con un unico file
- Uso di variabili SQL per gli UUID generati (compagnia, titolo)
- Nessuna modifica UI necessaria — le sezioni Movimenti, Veicolo e Premi Garanzia sono già implementate in TitoloDetail

### File da creare
- **1 migrazione SQL** — crea compagnia ASSISA + inserisce titolo + 2 movimenti + veicolo + premi garanzia

