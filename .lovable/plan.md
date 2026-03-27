

## Piano: Svuotare tutte le polizze fake (titoli e dati collegati)

### Situazione attuale
- **13.127 titoli** fake nel DB
- 9 tabelle dipendenti con FK verso `titoli`:

| Tabella | Record |
|---------|--------|
| provvigioni_generate | 809 |
| rimessa_dettaglio | 520 |
| sinistri | 420 |
| note_restituzione_dettaglio | 15 |
| dettaglio_riparto | 15 |
| movimenti_polizza | 6 |
| premi_garanzia_polizza | 7 |
| veicoli_polizza | 1 |
| conducenti_polizza | 0 |

### Procedura (ordine di eliminazione per rispettare le FK)

**Step 1 — Eliminare dati dipendenti** (in ordine sicuro):
1. `conducenti_polizza` — DELETE all
2. `veicoli_polizza` — DELETE all
3. `premi_garanzia_polizza` — DELETE all
4. `movimenti_polizza` — DELETE all
5. `dettaglio_riparto` — DELETE all
6. `note_restituzione_dettaglio` — DELETE all
7. `provvigioni_generate` — DELETE all
8. `rimessa_dettaglio` — DELETE all
9. `sinistri` — nullificare `titolo_id` o eliminare i sinistri fake

**Step 2 — Eliminare i titoli**:
- DELETE FROM `titoli`

**Step 3 — Verificare** che tutte le tabelle siano vuote e che l'UI non mostri errori.

### Note
- Tutti questi dati sono fake/seed — nessun dato reale da preservare
- I sinistri (420) sono anch'essi fake, quindi verranno eliminati insieme
- Esecuzione via `supabase insert tool` (DELETE statements)
- Nessuna migrazione DB necessaria

