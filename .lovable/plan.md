

## Piano: Aggiornare polizza 39526Q (ASSOCIAZIONE ASIS CB AIUTO IMMEDIATO - ASSISTENZA)

Record ID: `3ce97739-5576-42b5-987b-1d9e0386e934`

### Differenze DB → Screenshot Legacy

| Campo | Valore DB | Valore Legacy (corretto) |
|-------|-----------|-------------------------|
| `durata_a` | 2022-04-30 | **2026-04-30** |
| `garanzia_da` | 2021-04-30 | **2025-04-30** |
| `data_competenza` | 2025-05-22 | **2025-04-30** |
| `comp_assicurativa` | 2025-04-30 | **2025-05-22** |
| `provvigioni_quietanza` | 81.82 | **204.54** |
| `premio_netto_quietanza` | null | **1363.63** |
| `tasse_quietanza` | null | **136.37** |
| `tipo_rinnovo` | R | **A** (Tacito rinnovo) |
| `tipo_scadenza` | null | **no scadenza** |
| `giorni_presentazione` | null | **0** |
| `id_legacy` | 116383 | **142633** |

### Campi già corretti
- Numero: 39526Q ✓ | Riga: 0 ✓
- Compagnia: EUR000 / EUROP ASSISTANCE ITALIA SPA ✓
- Ramo: ASSISTENZA ✓ | Gruppo: ASSISTENZA ✓
- AE: SEDE NAPOLI ✓ | Specialist: GUARRACINO GAETANO ✓
- Premio lordo: 1500 ✓ | Netto: 1363.63 ✓ | Tasse: 136.37 ✓ | Addizionali: 0 ✓
- Provvigioni firma: 204.54 ✓
- Durata da: 30/04/2021 ✓ | Garanzia a: 30/04/2026 ✓
- Periodicità: annuale ✓ | Anni: 1 ✓ | Rate: 1 ✓ | Mora: 15gg ✓
- Stato: attivo ✓

### Azione
Migrazione SQL per UPDATE degli 11 campi sulla riga `3ce97739-5576-42b5-987b-1d9e0386e934`.

### File coinvolti
| File | Azione |
|------|--------|
| `supabase/migrations/` | Nuovo file SQL con UPDATE degli 11 campi |

