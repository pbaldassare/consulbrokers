

## Piano: Inserire polizza AXKY13OP per CONSULBROKERS S.P.A.

### Dati dallo screenshot

**Titolo (polizza)**:
- Numero: AXKY13OP
- Cliente: CONSULBROKERS S.P.A. (`48498444-...`)
- Compagnia: ZURICH INSURANCE (`c350524e-...`)
- Ramo: RCA MOTO (`c2c4d6b8-...`)
- Durata: 20/04/2022 → 20/04/2026
- Valuta: EUR
- Tipo rinnovo: Tacito rinnovo
- Stato: attivo
- Ufficio: Sede Napoli (`68506cb3-...`)

**4 Movimenti polizza** (da inserire dopo il titolo):

| Rg | App | Data Mov | Effetto | Scadenza | Rinnovo | Descrizione | Premio | Provvigioni | Tipo | Copertura | Incasso | Stato |
|----|-----|----------|---------|----------|---------|-------------|--------|-------------|------|-----------|---------|-------|
| 0 | - | 13/05/2025 | 20/04/2025 | 20/04/2026 | Tacito rinnovo | TG. DA62414 X MAX 250 - MAURIZIO | 243,00 | 20,00 | Polizza Quietanza | 13/05/2025 | 13/05/2025 | (icona rossa) |
| 0 | - | 23/04/2024 | 20/04/2024 | 20/04/2025 | Tacito rinnovo | TG. DA62414 X MAX 250 - MAURIZIO | 204,00 | 16,84 | Polizza Quietanza | 23/04/2024 | 23/04/2024 | Rinn |
| 0 | - | 21/04/2023 | 20/04/2023 | 20/04/2024 | Tacito rinnovo | TG. DA62414 X MAX 250 - MAURIZIO | 185,00 | 15,34 | Polizza Quietanza | 21/04/2023 | 21/04/2023 | Rinn |
| 0 | - | 20/04/2022 | 20/04/2022 | 20/04/2023 | Tacito rinnovo | TG. DA62414 X MAX 250 - MAURIZIO | 176,00 | 14,61 | Polizza Base | 20/04/2022 | 20/04/2022 | Rinn |

### Implementazione

1. **INSERT in `titoli`** con `cliente_anagrafica_id`, `compagnia_id`, `ramo_id`, `numero_titolo`, `durata_da`, `durata_a`, `tipo_rinnovo`, `valuta`, `stato`, `ufficio_id`, `targa_telaio`, `descrizione_polizza`

2. **INSERT 4 righe in `movimenti_polizza`** referenziando il `titolo_id` appena creato, con i dati di ogni annualità

Tutto via `supabase--insert` (dati, non schema).

### Note
- La targa è **DA62414** (moto XMAX 250)
- Il cliente corretto è **CONSULBROKERS S.P.A.** (Potenza), non la Società per Azioni (Milano)

