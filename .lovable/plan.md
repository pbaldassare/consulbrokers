

## Piano: Aggiornare polizza a6f960c1 con dati legacy (RENT AND EVENTS SRL - RCA)

Record ID: `a6f960c1-32b6-4983-9f2c-6d8ffd2e1211`

### Dati legacy (screenshot)
- **id_legacy**: 168419
- **Numero**: G02.013.0000051933, Riga 0
- **Compagnia**: ETI000 - ETISICURA SRL (`90a1b149-c19b-4175-ad2d-9875133ebb34`)
- **Cliente**: 017587 RENT AND EVENTS SRL
- **Ramo**: R. C. AUTOVEICOLI (PI) — già corretto
- **Gruppo**: R.C.A. — già corretto
- **Descrizione**: AUDI A1 GIALLA TAG. FT914NM — già corretto

### Campi da aggiornare sulla tabella `titoli`

| Campo | Valore DB attuale | Valore Legacy (corretto) |
|-------|-------------------|-------------------------|
| `numero_titolo` | 204366651 | **G02.013.0000051933** |
| `compagnia_id` | 4d21f189 (ASSISUD) | **90a1b149 (ETISICURA SRL)** |
| `id_legacy` | 142490 | **168419** |
| `durata_da` | 2025-04-09 | **2026-04-10** |
| `durata_a` | 2026-04-09 | **2027-04-10** |
| `garanzia_da` | 2025-04-09 | **2026-04-10** |
| `garanzia_a` | 2026-04-09 | **2027-04-10** |
| `data_scadenza` | 2026-04-09 | **2027-04-10** |
| `data_competenza` | 2025-04-16 | **2026-04-13** |
| `comp_assicurativa` | 2025-04-09 | **2026-04-13** |
| `premio_netto` | 1107.84 | **660.16** |
| `addizionali` | 0 | **231.00** |
| `tasse` | 232.22 | **205.32** |
| `premio_lordo` | 1340.06 | **1096.48** |
| `provvigioni_firma` | 117.12 | **57.03** |
| `premio_netto_quietanza` | null | **660.16** |
| `addizionali_quietanza` | 0 | **231.00** |
| `tasse_quietanza` | null | **205.84** |
| `provvigioni_quietanza` | 46.85 | **57.03** |
| `no_calcolo_tasse` | false | **true** |
| `tipo_scadenza` | null | **no scadenza** |
| `giorni_presentazione` | null | **0** |
| `targa_telaio` | null | **FT914NM** |

### Dati veicolo (nuova riga in `veicoli_polizza`)

| Campo | Valore |
|-------|--------|
| Settore | Autovetture |
| Tipo | AUTOVETTURA |
| Uso | PRIVATO |
| Provincia | Napoli |
| Classe B/M | 06 |
| Targa | FT914NM |
| Veicolo | AUDI A1 GIALLA |
| CV | 16 | KW | 85 | Posti | 5 |
| Franchigia | 0.00 |

### Dati premi garanzia (nuove righe in `premi_garanzia_polizza`)

| Garanzia | Capitale | Tasso | Firma | Rata | Annuo |
|----------|----------|-------|-------|------|-------|
| RC | — | — | 660.16 | 660.16 | 660.16 |
| Furto/Incendio/Eventi | 13100.00 | 0.00 | 200.00 | 200.00 | 200.00 |
| Tutela Legale | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| ARD (varie) | 0.00 | 0.00 | 31.00 | 31.00 | 31.00 |

### Campi già corretti
- A/E: SEDE NAPOLI ✓ | Specialist: GUARRACINO GAETANO ✓
- Anni: 1 ✓ | Rate: 1 ✓ | Periodicità: annuale ✓ | Mora: 15 ✓
- Tipo rinnovo: R (tacito) ✓ | Disdetta: 2 ✓
- Ramo: R. C. AUTOVEICOLI ✓ | Gruppo: R.C.A. ✓
- Descrizione: AUDI A1 GIALLA TAG. FT914NM ✓

### Azioni
1. UPDATE dei ~22 campi sulla riga `titoli` tramite insert tool
2. INSERT veicolo in `veicoli_polizza`
3. INSERT 4 righe garanzia in `premi_garanzia_polizza`

### File coinvolti
Nessun file di codice — solo operazioni dati sul DB.

