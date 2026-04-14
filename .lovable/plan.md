

## Piano: Ripristinare polizza 204366651 come record separato

### Situazione attuale
- Il record `a6f960c1` è stato aggiornato da `204366651` (ASSISUD, €1.340,06) a `G02.013.0000051933` (ETISICURA, €1.096,48, scadenza 2027-04-10)
- Il carico aprile 2026 mostra 15 polizze per €88.611,44 — mancano €1.340,06 rispetto all'Excel (€89.951,50)

### Azione
Inserire un **nuovo record** in `titoli` con i dati originali della polizza 204366651:

| Campo | Valore |
|-------|--------|
| numero_titolo | 204366651 |
| compagnia_id | 4d21f189 (ASSISUD) |
| cliente_anagrafica_id | a17c3f40 (RENT AND EVENTS SRL) |
| ramo_id | 8bb44856 (R. C. AUTOVEICOLI) |
| id_legacy | 142490 |
| data_scadenza | 2026-04-09 |
| durata_da | 2025-04-09 |
| durata_a | 2026-04-09 |
| garanzia_da | 2025-04-09 |
| garanzia_a | 2026-04-09 |
| data_competenza | 2025-04-16 |
| comp_assicurativa | 2025-04-09 |
| premio_netto | 1107.84 |
| addizionali | 0 |
| tasse | 232.22 |
| premio_lordo | 1340.06 |
| provvigioni_firma | 117.12 |
| provvigioni_quietanza | 46.85 |
| stato | attivo |
| Campi ereditati | ae_nome, specialist, periodicita, mora, disdetta, tipo_rinnovo, descrizione_polizza, ecc. dal record originale |

### Risultato atteso
- Carico aprile 2026: **16 polizze**, totale lordo **€89.951,50** (allineato con Excel)
- La polizza G02.013.0000051933 resta invariata (scadenza 2027)

### File coinvolti
Nessun file di codice — solo INSERT dati via insert tool.

