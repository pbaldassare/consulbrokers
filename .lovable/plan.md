Annullamento totale della polizza 184667297 (cliente non assegnato — record di test).

Record trovati in DB:
- Titolo madre `654a1a9e-9a5b-4f1a-80a6-5e794c233ac9`: rata Annuale 20/05/2026-2027, premio 1925,20€, stato `incassato`, messa a cassa 28/05/2026.
- Quietanza successiva auto-generata `f5f55cb7-0a6d-4f7c-9b57-81e92b392001`: rata 20/05/2027-2028, stato `attivo`, `sostituisce_polizza=184667297`.

Effetti collegati (solo per i due titoli sopra):
- `movimenti_polizza`: 1 riga
- `premi_garanzia_polizza`: 56 righe
- `veicoli_polizza`: 1 riga
- Nessuna provvigione generata, nessuna distinta rimessa, nessun pagamento, nessuna appendice, nessuno storno, nessun sinistro.

Azione:
1. Cancello le righe collegate (`movimenti_polizza`, `premi_garanzia_polizza`, `veicoli_polizza`) per i due titoli.
2. Cancello i due record `titoli`. Questo rimuove la rata incassata e la quietanza futura → spariscono da Polizze Attive, Carico del Mese, Storico, Messa a Cassa e da qualunque vista derivata.
3. Verifica finale: query di conta su tutte le tabelle figlie e su `titoli` per `numero_titolo='184667297'` → deve tornare zero ovunque.

Nota: nessun effetto cassa/banca esterno da invertire perché non esistono `provvigioni_generate`, `rimessa_dettaglio`, `dettaglio_riparto` né distinte associate.