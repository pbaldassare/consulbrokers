

## Piano: Aggiornare polizza 9479008. (COMUNE DI AFRAGOLA - VITA COLLETTIVA)

Record ID: `074979de-381b-4775-9549-de3fbef5cf6b`

### Differenze DB → Screenshot Legacy

| Campo | Valore DB | Valore Legacy (corretto) |
|-------|-----------|-------------------------|
| `durata_a` | 2025-04-30 | **2026-04-30** (biennale) |
| `garanzia_da` | 2024-04-30 | **2025-04-30** |
| `premio_netto` | -62.50 | **15960.50** |
| `tasse` | 0 | **62.00** |
| `no_calcolo_tasse` | false | **true** |
| `provvigioni_quietanza` | 1276.84 | **2553.68** |
| `premio_netto_quietanza` | null | **15960.50** |
| `tasse_quietanza` | null | **62.00** |
| `data_competenza` | 2025-04-29 | **2025-05-15** |
| `comp_assicurativa` | 2025-04-30 | **2025-04-29** |
| `tipo_rinnovo` | A | **S** (Riformare alla scadenza) |
| `tipo_scadenza` | null | **no scadenza** |
| `giorni_presentazione` | null | **0** |
| `id_legacy` | 139158 | **142789** |

### Campi gia corretti
- Numero: 9479008. ✓ | Riga: 0 ✓
- Compagnia: UNISCI / SCIACCA ASSICURAZIONI ✓
- Gruppo: ZV / VITA ✓
- AE: SEDE NAPOLI ✓ | Specialist: GUARRACINO GAETANO ✓
- Premio lordo: 16022.50 ✓ | Provvigioni firma: 2553.68 ✓
- Addizionali: 0 ✓
- Durata da: 30/04/2024 ✓ | Garanzia a: 30/04/2026 ✓
- Data incasso: 29/04/2025 ✓
- Conto incasso: CRED. VS CB CONSULTING (V1753) ✓
- Mora: 15gg ✓ | Rate: 1 ✓
- Descrizione: TCM VIGILI URBANI ✓

### Azione
Migrazione SQL per UPDATE dei 14 campi sulla riga `074979de-381b-4775-9549-de3fbef5cf6b`.

### File coinvolti
| File | Azione |
|------|--------|
| `supabase/migrations/` | Nuovo file SQL con UPDATE dei 14 campi |

