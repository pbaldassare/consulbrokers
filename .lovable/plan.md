

## Piano: Completare dati polizze 332437571 e 332437574 (COMUNE DI SANTA MARINA SALINA)

### Record coinvolti
1. **332437571** — `d046ffeb-2ed1-43cc-ba03-a07cfb838804` (NC - INFORTUNI CUMULATIVA)
2. **332437574** — `66c6cf18-5fc9-4a29-b593-133f2eabe70d` (PC - R.C.T./R.C.O)

### Dati dallo screenshot legacy (quietanzamento Sedi Sicilia)

| Campo | Polizza 332437571 | Polizza 332437574 |
|-------|-------------------|-------------------|
| Cliente | COMUNE DI SANTA MARINA SALINA | idem |
| Codice cliente legacy | 006975 | 006975 |
| Descrizione | CIG: B6554C6288 | CIG: B6554C6288 |
| Scadenza | 04/04/2026 ✓ | 04/04/2026 ✓ |
| Mora | 15 ✓ | 15 ✓ |
| Lordo | 337,00 ✓ | 300,00 ✓ |
| Provv firma | 65,60 ✓ | 35,33 ✓ |
| Incasso titolo prec | 05/05/2025 | 05/05/2025 |
| Fraz (rate) | 1 ✓ | 1 ✓ |
| Tipo rinnovo | Tacito rinnovo ✓ | Tacito rinnovo ✓ |
| A/E | CT (SEDE CATANIA) ✓ | CT ✓ |
| Filiale | SS (Sedi Sicilia) ✓ | SS ✓ |
| Compagnia | ASSISUD ✓ | ASSISUD ✓ |

### Campi da aggiornare (comuni a entrambe)

| Campo | Valore attuale | Valore corretto |
|-------|---------------|-----------------|
| `cliente_id` | null | **827e49d7-e80e-4d8d-9e38-9494ac502497** |
| `descrizione_polizza` | null | **CIG: B6554C6288** |
| `data_incasso` | null | **2025-05-05** |
| `durata_da` | null | **2025-04-04** (annuale, scadenza 04/04/2026) |
| `durata_a` | null | **2026-04-04** |
| `garanzia_da` | null | **2025-04-04** |
| `gruppo_ramo` | null | **INFORTUNI** (per 571) / **R.C.T.** (per 574) |
| `tipo_scadenza` | null | **no scadenza** |
| `giorni_presentazione` | null | **0** |
| `produttore_nome` | INTERFIDI SRL | verificare se corretto o da svuotare |

### Azione
UPDATE via insert tool sulle 2 righe con i campi mancanti.

### File coinvolti
Nessun file di codice — solo operazioni dati sul DB.

