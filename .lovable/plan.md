

## Piano: Correggere i dati importati e il calcolo del totale lordo

### 1. Correggere i premi sbagliati (3 polizze)

I premi delle polizze importate erano stati inseriti con valori errati (probabilmente confusi con altro campo):

- `332437571`: da 2.917 → **337**
- `332437574`: da 4.200 → **300**
- `AXKY13OP`: da 2.190 → **243**

### 2. Importare le 2 polizze mancanti

- `RCM00010074404` — Lo Giudice Emilia Concetta, AmTrust, RC Professionale, Lordo 750, Fraz 3 (trimestrale), scadenza rata 19/04/2026
- `6131402092` — Regione Campania, HDI, RC Auto, Lordo 63.050,22, scadenza rata 30/04/2026

Per entrambe serve verificare/creare il cliente e associare la compagnia corretta.

### 3. Correggere il calcolo del "Totale premio lordo"

Attualmente somma solo i record della pagina corrente (max 25). Serve una **query separata** che faccia `SUM(premio_lordo)` su tutti i record del mese (senza paginazione), così la card mostra sempre il totale reale.

### 4. Aggiornare anche provvigioni attive/passive

I 3 record importati non avevano le provvigioni corrette dall'Excel. Aggiornare:
- `332437571`: Attive 65.60, Passive 26.24
- `332437574`: Attive 35.33, Passive 14.13
- `AXKY13OP`: Attive 20, Passive 0

### File coinvolti

| File | Azione |
|------|--------|
| Script DB (insert tool) | Correggere premi e provvigioni delle 3 polizze, inserire 2 mancanti |
| `src/pages/PortafoglioCaricoPage.tsx` | Query separata per totale lordo globale del mese |
| `src/pages/PortafoglioAttivePage.tsx` | Stessa correzione per il totale nella card |

