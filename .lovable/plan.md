

## Piano: Reinserire le 2 polizze mancanti nel carico di aprile 2026

### Problema
Eliminando i "duplicati" di `6131402092` e `RCM00010074404`, ho rimosso i record con scadenza aprile 2026. Le versioni rimaste hanno scadenze nel 2027. Il carico mostra quindi 14 polizze (€26.151,28) invece di 16 (€89.951,50).

### Soluzione
Creare una migrazione SQL che inserisca 2 nuovi record nella tabella `titoli` per aprile 2026, copiando i dati corretti dalle versioni 2027 ma con `data_scadenza` di aprile 2026:

| Polizza | Scadenza | Premio | Compagnia | Ramo | Specialist | Provv. Firma | Provv. Quietanza |
|---------|----------|--------|-----------|------|------------|-------------|-----------------|
| 6131402092 | 30/04/2026 | 63.050,22 | R.AS. (stessa) | stesso ramo | GUARRACINO | 2.609,86 | 1.043,94 |
| RCM00010074404 | 19/04/2026 | 750,00 | stessa | RC PROFESSIONALE | Gestione Milano | 110,43 | 110,43 |

I dati (cliente, compagnia, ramo, produttore, AE, specialist, provvigioni) verranno copiati dai record 2027 già verificati come corretti.

### Risultato atteso
- 16 polizze nel carico di aprile
- Totale lordo: €89.951,50

### File coinvolti
| File | Azione |
|------|--------|
| Migrazione SQL | INSERT di 2 record titoli con scadenza aprile 2026 |

