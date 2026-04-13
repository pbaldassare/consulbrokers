

## Piano: Aggiornare la polizza ITCGNC35122 con i dati dal sistema legacy

### Differenze trovate (DB → Screenshot legacy)

| Campo | Valore DB | Valore Legacy (corretto) |
|-------|-----------|-------------------------|
| `durata_a` | 2025-04-15 | **2026-04-15** (poliennale biennale) |
| `garanzia_da` | 2024-04-15 | **2025-04-15** (annualità corrente) |
| `provvigioni_quietanza` | 188.14 | **376.28** |
| `regolazione` | false | **true** (Si) |
| `giorni_presentazione` | null | **0** |
| `id_legacy` | 138722 | **143283** |
| `anni_durata` | 1 | 1 (OK, ma durata effettiva 2 anni) |

### Campi già corretti nel DB
- Compagnia: Chubb ✓
- Ramo: MOSTRE D'ARTE ✓
- Specialist: GUARRACINO GAETANO ✓
- AE: SEDE NAPOLI ✓
- Produttore: SCIORIO NICOLA ✓
- Premio lordo: 2000 ✓
- Provvigioni firma: 376.28 ✓
- Conto incasso: BCC COMP 3292 ✓
- Data competenza/incasso: 10/07/2025 ✓
- Descrizione: SPERTI ROMANO ✓

### Azione
Eseguire un UPDATE sulla tabella `titoli` per il record `50770f13-d2d6-403d-9d1f-0b3a17459dab` con i 6 campi da correggere.

### File coinvolti
| File | Azione |
|------|--------|
| DB (insert tool) | UPDATE dei 6 campi della polizza ITCGNC35122 |

