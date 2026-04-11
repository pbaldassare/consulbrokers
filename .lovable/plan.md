

## Piano: Fix vincolo CHECK sugli stati trattativa

### Problema trovato
L'errore **non è RLS** ma un **CHECK constraint** sul database. La colonna `stato` della tabella `trattative` ha un vincolo che accetta solo 4 valori:

```text
aperta, in_negoziazione, chiusa_vinta, chiusa_persa
```

Ma la nuova pipeline usa 8 stati (`contatto`, `preventivo`, `proposta_inviata`, `sospesa` sono rifiutati). Ogni tentativo di cambiare stato verso uno dei nuovi valori viene bloccato dal database.

### Soluzione

**Migrazione SQL** — una sola operazione:
1. Eliminare il vincolo `trattative_stato_check` esistente
2. Ricrearlo con tutti gli 8 stati: `aperta`, `contatto`, `preventivo`, `in_negoziazione`, `proposta_inviata`, `chiusa_vinta`, `chiusa_persa`, `sospesa`

Nessuna modifica frontend necessaria — il codice è già corretto, è solo il database che rifiuta i nuovi valori.

### File coinvolti

| File | Modifica |
|------|----------|
| Nuova migrazione SQL | DROP + CREATE constraint con 8 stati |

