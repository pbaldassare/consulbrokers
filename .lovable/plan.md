

## Piano: Aggiornare polizza 182209800 (CANTIERE NAVALE BASILIO POSTIGLIONE SRL - R.C. NATANTI)

Record ID: `1db21814-5df2-47b3-9135-e6995fe70177`

### Differenze DB → Screenshot Legacy (tabella titoli)

| Campo | Valore DB | Valore Legacy (corretto) |
|-------|-----------|-------------------------|
| `durata_a` | 2025-04-22 | **2026-04-22** (biennale) |
| `anni_durata` | 1 | **2** |
| `garanzia_da` | 2024-04-22 | **2025-04-22** |
| `tasse` | 34.97 | **19.00** |
| `addizionali` | 0 | **15.97** (SSN) |
| `premio_netto_quietanza` | null | **152.03** |
| `tasse_quietanza` | null | **19.00** |
| `addizionali_quietanza` | 0 | **15.97** |
| `tipo_rinnovo` | R | **A** (Tacito rinnovo) |
| `tipo_scadenza` | null | **no scadenza** |
| `giorni_presentazione` | null | **0** |

### Dati mancanti — INSERT nuovi record

**veicoli_polizza** (nessun record esistente):
- Settore: Macchine Operatici e Carrelli, Tipo: NATANTE, Uso: CONTO PROPRIO
- Provincia: Napoli, Cl B/M: 14, Massimali: 3000/2500/1500, Franchigia: 0
- CV: 95, KW: 70, CC: 0, Posti: 0
- Targa: SN1C6926, Veicolo: SN1C692639 - GOMMONE DI ALFREDO

**premi_garanzia_polizza** (nessun record esistente):
- RC: firma 152.03, rata 152.03, annuo 0

**conducenti_polizza** (nessun record esistente):
- Nome: CANTIERE NAVALE BASILIO, Cognome: POSTIGLIONE SRL
- Indirizzo: VIA LUCULLO, 4 — 80070 BACOLI (NA)

### Campi già corretti
- Numero: 182209800 ✓ | Riga: 0 ✓
- Compagnia: CAT110 / DL ASSISERVICE ✓
- Ramo: R.C. NATANTI (QN) ✓ | Gruppo: R.C.A. ✓
- AE: SEDE NAPOLI ✓ | Premio lordo: 187 ✓ | Netto: 152.03 ✓
- Durata da: 22/04/2024 ✓ | Garanzia a: 22/04/2026 ✓
- Data incasso: 22/04/2025 ✓ | Rate: 1 ✓ | Periodicità: annuale ✓
- Mora: 15gg ✓ | id_legacy: 138665 ✓

### Azione
Migrazione SQL con:
1. UPDATE dei 11 campi sulla riga titoli
2. INSERT veicoli_polizza
3. INSERT premi_garanzia_polizza (1 riga RC)
4. INSERT conducenti_polizza

### File coinvolti
| File | Azione |
|------|--------|
| `supabase/migrations/` | Nuovo file SQL con UPDATE + 3 INSERT |

