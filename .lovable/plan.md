

## Piano: Rimuovere dati demo da Pagamenti Provvigioni

### Dati da eliminare

| Tabella | Record | Note |
|---------|--------|------|
| `pagamenti_provvigioni` | 16 | Tutti con riferimento `PAG-DEMO-0001` |
| `pagamenti_provvigioni_righe` | 0 | Già vuota |

### Migrazione SQL
```sql
DELETE FROM public.pagamenti_provvigioni;
```

### Risultato
La pagina Pagamenti Provvigioni mostrerà "Nessun dato" con i contatori a zero, pronta per dati reali.

### File coinvolti
- Nessuna modifica al codice — solo eliminazione dati via migrazione

