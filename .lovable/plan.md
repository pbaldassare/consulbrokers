

## Piano: Correggere tutti i dati delle polizze di aprile per allinearli all'Excel

### Problemi trovati

#### 1. DUPLICATO da eliminare
- **`6131402092`** ha **2 record** nel DB. Uno corretto (GUARRACINO/INTERFIDI/R.AS.) e uno sbagliato (Ferrante/HDI, senza provvigioni). Va eliminato il duplicato sbagliato.

#### 2. Polizze con dati completamente sbagliati (importate con default "Ferrante/La Barbera")

| Campo | `332437571` DB → Excel | `332437574` DB → Excel |
|-------|----------------------|----------------------|
| Specialist | La Barbera → **GUARRACINO GAETANO** | La Barbera → **GUARRACINO GAETANO** |
| AE | Ferrante → **SEDE CATANIA** | Ferrante → **SEDE CATANIA** |
| Produttore | Ferrante → **INTERFIDI SRL** | Ferrante → **INTERFIDI SRL** |
| Ramo | INCENDIO CIVILE → **INFORTUNI CUMULATIVA** | RCTO + RC PATRIMONIALE → **R.C.T./R.C.O** |
| Compagnia | GENERALI ITALIA → **ASSISUD** | GENERALI ITALIA → **ASSISUD** |
| Data scadenza | 30/04 → **04/04** | 30/04 → **04/04** |
| Filiale | null → **SS** | null → **SS** |

| Campo | `RCM00010074404` DB → Excel | `AXKY13OP` DB → Excel |
|-------|---------------------------|---------------------|
| Specialist | null → **Gestione Milano** | null → **GUARRACINO GAETANO** |
| AE | Ferrante → **SEDE NAPOLI** | Ferrante → **SEDE NAPOLI** |
| Produttore | Ferrante → **Consulbrokers Digital Srl** | Ferrante → **(vuoto)** |
| Ramo | OK (RC PROFESSIONALE) | D&O → **R. C. MOTO** |
| Data scadenza | OK (19/04) | 27/04 → **20/04** |
| Filiale | null → **NA** | null → **NA** |
| Provv. firma | 75 → **110.43** | OK (20) |
| Provv. quietanza | 30 → **110.43** | OK (0) |

#### 3. Produttore mancante (null nel DB, presente in Excel)

| Polizza | Produttore corretto |
|---------|-------------------|
| 332434490 | INTERFIDI SRL |
| 182209800 | INTERFIDI SRL |
| 39526Q | INTERFIDI SRL |

#### 4. Provvigioni sbagliate

| Polizza | Firma DB → Excel | Quietanza DB → Excel |
|---------|-----------------|---------------------|
| 332434490 | 57.48 → **0** | 23.78 → **23.78** (OK) |
| 182209800 | 11.58 → **12.16** | 4.86 (OK) |
| 9479008. | 2988.12 → **2553.68** | 0 → **1276.84** |

### Azioni

1. **Eliminare il duplicato** di `6131402092` (quello con ae_nome='Ferrante')
2. **Aggiornare ramo e compagnia** per `332437571`, `332437574`, `AXKY13OP` — servono gli UUID corretti dal DB per ramo e compagnia; se non esistono, crearli
3. **Aggiornare specialist, ae_nome, produttore_nome, filiale, data_scadenza** per le 4 polizze "Ferrante"
4. **Aggiornare produttore_nome** per le 3 polizze con valore null
5. **Aggiornare provvigioni** per `332434490`, `182209800`, `9479008.`, `RCM00010074404`

### File coinvolti

| File | Azione |
|------|--------|
| Script DB (insert tool) | DELETE duplicato, UPDATE campi per ~8 polizze |
| Lookup rami/compagnie | Verificare/creare i record mancanti (ASSISUD, INFORTUNI CUMULATIVA, R.C. MOTO, ecc.) |

