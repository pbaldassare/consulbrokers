

## Piano: Rimuovere tutti i dati demo dalla contabilità

### Dati da eliminare

| Tabella | Record | Tipo |
|---------|--------|------|
| `incroci_bancari` | 80 | Tutti collegati a estratti/movimenti demo |
| `estratti_conto` | 140 | Tutti con `[DEMO]` nella descrizione |
| `movimenti_contabili` | 960 | Tutti con `[DEMO]` nella descrizione |

### Ordine di eliminazione (per rispettare le FK)
1. `DELETE FROM incroci_bancari` — dipende da estratti_conto e movimenti_contabili
2. `DELETE FROM estratti_conto` — tutti demo
3. `DELETE FROM movimenti_contabili` — tutti demo

### Risultato
Le pagine Contabilità Ufficio (cruscotto, distinta giornaliera, quadratura premi, chiusura contabile) mostreranno "Nessun dato" finché non verranno inseriti movimenti reali. La distinta giornaliera esistente (1 record reale del 14/04/2026) resta intatta.

### File coinvolti
- Nessuna modifica al codice — solo eliminazione dati via tool di inserimento/update

