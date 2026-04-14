

## Piano: Aggiornare polizza 2013/03/2163641 (COMUNE DI POMIGLIANO D'ARCO)

### Differenze DB → Screenshot Legacy

| Campo | Valore DB | Valore Legacy (corretto) |
|-------|-----------|-------------------------|
| `durata_a` | 2025-04-22 | **2026-04-22** (biennale) |
| `garanzia_da` | 2024-04-22 | **2025-04-22** (annualità corrente) |
| `premio_netto` | 445.80 | **405.27** |
| `addizionali` | 0 | **40.53** |
| `provvigioni_quietanza` | 14.84 | **35.66** |
| `comp_assicurativa` | 2025-04-22 | **2025-04-29** |
| `id_legacy` | 138677 | **142635** |
| `giorni_presentazione` | null | **0** |

### Campi già corretti
- Numero: 2013/03/2163641 ✓
- Compagnia: REA114 / Reale Mutua ✓
- Ramo: R.C.T./R.C.O. ✓ | Gruppo: R.C.T. ✓
- AE: SEDE NAPOLI ✓ | Specialist: GUARRACINO GAETANO ✓
- Premio lordo: 545 ✓ | Tasse: 99.20 ✓
- Provvigioni firma: 35.66 ✓
- Data incasso/competenza: 09/06/2025 ✓
- Conto incasso: CRED. VS CB CONSULTING (I7591) ✓
- Descrizione: MODULI AERONAUTICI SPARTITRAFFICO ZONA PONTE (CIG: B15E982E61) ✓
- Mora: 15gg ✓ | Rate: 1 ✓ | Periodicità: annuale ✓

### Azione
Migrazione SQL per UPDATE degli 8 campi sulla riga `f4dd11ef-c7df-4b88-946d-80690ff54f3f`.

### File coinvolti
| File | Azione |
|------|--------|
| `supabase/migrations/` | Nuovo file SQL con UPDATE dei campi |

