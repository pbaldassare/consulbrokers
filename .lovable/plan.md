

## Piano: Aggiornare polizza 01.51130/03 (CONSULBROKERS - CAUZIONI DEFINITIVE)

Record ID: `7938cab5-45f5-4a38-895e-0aa785967f76`

### Differenze DB → Screenshot Legacy

| Campo | Valore DB | Valore Legacy (corretto) |
|-------|-----------|-------------------------|
| `anni_durata` | 1 | **3** |
| `premio_netto` | 88.89 | **74.08** |
| `addizionali` | 0 | **14.81** |
| `provvigioni_quietanza` | 0 | **17.78** |
| `premio_netto_quietanza` | null | **74.08** |
| `addizionali_quietanza` | 0 | **14.81** |
| `tasse_quietanza` | null | **11.11** |
| `tipo_scadenza` | null | **no scadenza** |
| `giorni_presentazione` | null | **0** |

### Campi già corretti
- Numero: 01.51130/03 ✓ | Riga: 0 ✓
- Compagnia: S2C001 / S2C SPA ✓
- Ramo: CAUZIONI DEFINITIVE ✓ | Gruppo: CREDITO CAUZIONI ✓
- AE: SEDE NAPOLI ✓ | Specialist: GUARRACINO GAETANO ✓
- Premio lordo: 100 ✓ | Tasse: 11.11 ✓
- Provvigioni firma: 17.78 ✓
- Durata: 30/10/2025 - 30/04/2026 ✓
- Garanzia: 30/10/2025 - 30/04/2026 ✓
- Data incasso/competenza: 19/11/2025 ✓
- Conto incasso: CASSA NAPOLI ✓
- Mora: 15gg ✓ | Rate: 1 ✓ | Periodicità: annuale ✓
- Tipo rinnovo: Tacito rinnovo ✓
- Descrizione: AZ. SANITARIA PROV. DI PALERMO 8PROROGA... ✓
- id_legacy: 158708 ✓

### Azione
Migrazione SQL per UPDATE dei 9 campi sulla riga `7938cab5-45f5-4a38-895e-0aa785967f76`.

### File coinvolti
| File | Azione |
|------|--------|
| `supabase/migrations/` | Nuovo file SQL con UPDATE dei 9 campi |

