

## Piano: Aggiornare polizza 2013/07/2035147 (COMUNE DI POMIGLIANO D'ARCO - INCENDIO)

### Differenze DB → Screenshot Legacy

| Campo | Valore DB | Valore Legacy (corretto) |
|-------|-----------|-------------------------|
| `durata_a` | 2025-04-22 | **2026-04-22** (biennale) |
| `garanzia_da` | 2024-04-22 | **2025-04-22** |
| `premio_netto` | 642.12 | **583.74** |
| `addizionali` | 0 | **58.38** |
| `provvigioni_quietanza` | 20.55 | **51.37** |
| `comp_assicurativa` | 2025-04-22 | **2025-04-29** |
| `id_legacy` | 138676 | **142636** |
| `giorni_presentazione` | null | **0** |
| `tipo_scadenza` | null | **no scadenza** |

### Campi già corretti
- Numero: 2013/07/2035147 ✓ | Riga: 0 ✓
- Compagnia: REA114 / Reale Mutua ✓
- Ramo: INCENDIO ✓ | Gruppo: INCENDIO FURTO RISCHI TECNOLOGICI ✓
- AE: SEDE NAPOLI ✓ | Specialist: GUARRACINO GAETANO ✓
- Premio lordo: 785 ✓ | Tasse: 142.88 ✓
- Provvigioni firma: 51.37 ✓
- Data incasso/competenza: 09/06/2025 ✓
- Conto incasso: CRED. VS CB CONSULTING (I7591) ✓
- Mora: 15gg ✓ | Rate: 1 ✓ | Periodicità: annuale ✓
- Tipo rinnovo: Tacito rinnovo ✓
- Descrizione: MODULI AERONAUTICI SPARTITRAFFICO ZONA PONTE (CIG: B15E982E61) ✓

### Azione
Migrazione SQL per UPDATE dei 9 campi sulla riga `eef00590-01db-48b0-9f6c-847c445ec52a`.

### File coinvolti
| File | Azione |
|------|--------|
| `supabase/migrations/` | Nuovo file SQL con UPDATE dei 9 campi |

