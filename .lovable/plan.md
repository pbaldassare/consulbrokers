

## Piano: Aggiornare polizza 6131402092 (REGIONE CAMPANIA - R.C. AUTO)

Record ID: `19ccbe09-c0fa-400a-a2ce-8b9cf0cde0a5`

### Differenze DB → Screenshot Legacy

| Campo | Valore DB | Valore Legacy (corretto) |
|-------|-----------|-------------------------|
| `durata_a` | 2026-04-30 | **2027-04-30** (biennale) |
| `anni_durata` | 1 | **2** |
| `premio_netto` | 55615.34 | **24235.34** |
| `addizionali` | 0 | **31380.00** |
| `provvigioni_quietanza` | 1043.94 | **2609.86** |
| `premio_netto_quietanza` | null | **24235.34** |
| `addizionali_quietanza` | 0 | **31380.00** |
| `tasse_quietanza` | null | **7434.88** |
| `tipo_rinnovo` | R | **A** (Tacito rinnovo) |
| `tipo_scadenza` | null | **no scadenza** |
| `giorni_presentazione` | null | **0** |
| `data_competenza` | 2025-05-10 | **2025-04-30** |

### Campi già corretti
- Numero: 6131402092 ✓ | Riga: 0 ✓
- Compagnia: AMISNA / R.AS. RISCHI ASSICURATIVI SRL HDI ASS.NI ✓
- Ramo: R.C. AUTO ✓ | Gruppo: R.C.A. ✓
- AE: SEDE NAPOLI ✓ | Specialist: GUARRACINO GAETANO ✓
- Premio lordo: 63050.22 ✓ | Tasse: 7434.88 ✓
- Provvigioni firma: 2609.86 ✓
- Durata da: 30/04/2025 ✓ | Garanzia: 30/04/2025 - 30/04/2026 ✓
- Data incasso: 10/05/2025 ✓
- Mora: 15gg ✓ | Rate: 1 ✓ | Periodicità: annuale ✓
- Descrizione: RCA LIBRO MATRICOLA + INFORTUNI CONDUCENTE ✓
- id_legacy: 142628 ✓

### Azione
Migrazione SQL per UPDATE dei 12 campi sulla riga `19ccbe09-c0fa-400a-a2ce-8b9cf0cde0a5`.

### File coinvolti
| File | Azione |
|------|--------|
| `supabase/migrations/` | Nuovo file SQL con UPDATE dei 12 campi |

