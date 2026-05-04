# Cancellazione totale polizze (titoli)

## Obiettivo
Rimuovere tutti i 212 `titoli` rimasti in DB e i loro record dipendenti. I 12 clienti keeper restano in piedi, pronti a ricevere nuove polizze fornite manualmente in seguito.

## Ambito dei dati eliminati

| Tabella | Righe attuali | Modalità |
|---|---:|---|
| `titoli` | 212 | DELETE diretto |
| `movimenti_polizza` | 1.802 | CASCADE da titoli |
| `provvigioni_generate` | 424 | CASCADE da titoli |
| `premi_garanzia_polizza` | 15 | CASCADE da titoli |
| `veicoli_polizza` | 4 | CASCADE da titoli |
| `appendici_polizza` | 2 | CASCADE da titoli |
| `conducenti_polizza` | 2 | CASCADE da titoli |
| `sinistri` | 0 | nessuna azione necessaria |
| `rimessa_dettaglio` | 0 | nessuna azione necessaria |
| `note_restituzione_dettaglio` | 0 | nessuna azione necessaria |
| `dettaglio_riparto` | 0 | CASCADE |
| `portafoglio_incassi` | 0 | nessuna azione |

Nessun riferimento `titolo_id` su `documenti`, `chat_canali`, `movimenti_contabili`: non serve toccarle.

## Esecuzione (un'unica migration in transazione)

1. `SET session_replication_role = 'replica'` per bypassare i trigger di lock (`lock_premi_storici`, `prevent_double_messa_cassa`, audit, ecc.).
2. `DELETE FROM titoli;` — il CASCADE elimina automaticamente movimenti, provvigioni, garanzie, appendici, veicoli, conducenti, dettaglio_riparto.
3. Ripristino `session_replication_role = 'origin'`.
4. Verifica finale: `SELECT COUNT(*) FROM titoli` deve essere 0.

## Cosa NON viene toccato
- I 12 clienti keeper (anagrafiche, sedi, referenti, codici commerciali, privacy).
- Compagnie, rami, prodotti, gruppi finanziari, uffici, profili utente.
- Storico contabile non collegato a titoli, template, impostazioni, log generali.

## Note
Operazione **irreversibile**. Conferma per procedere con la migration.
