

## Piano: Aggiungere aliquote tasse a tabella `rami` e popolare dati reali dall'Excel

### Modifiche al database

**1. Migrazione — aggiungere colonne alla tabella `rami`:**
- `aliquota_tasse_ramo` (numeric, default 0) — percentuale tasse sul ramo
- `aliquota_tasse_ard` (numeric, default 0) — percentuale tasse ARD

**2. Operazioni dati (via insert tool):**
- `UPDATE titoli SET ramo_id = NULL` — rimuovere FK verso rami fake
- `DELETE FROM rami` — svuotare rami fake
- `DELETE FROM gruppi_ramo` — svuotare gruppi fake
- Inserire i **13 gruppi_ramo** reali dall'Excel (ZL, ZT, ZD, ZY, ZP, ZN, ZC, DI, ZM, ZQ, ZS, ZV)
- Inserire i **182 rami** reali dall'Excel con codice, descrizione, gruppo_ramo_id, aliquota_tasse_ramo, aliquota_tasse_ard

### Dettagli tecnici
- I dati vengono estratti dal file `codici_ramo_sottogruppo.xlsx` caricato in precedenza
- I titoli esistenti perderanno temporaneamente il `ramo_id` — andrà riassegnato manualmente dopo
- Nessuna modifica frontend necessaria per questa fase

