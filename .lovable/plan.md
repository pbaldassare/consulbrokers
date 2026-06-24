## Ho capito — riassunto richiesta

Il cliente in pagina è **Cliente Ente** (`5bf442ef-f109-4457-9c2c-127e986ca145`) con 2 polizze + 2 quietanze:

| N° Polizza | Madre (id) | Quietanza (id) | Premio | Messa a cassa | Provvigioni | Mov. contab. | Rimesse | Sinistri |
|---|---|---|---|---|---|---|---|---|
| 43443343434 (AVIAZIONE CORPI) | `2ecfc47f…` | `6e811b02…` | 2100,00 | **no** | 0 | 0 | 0 | 0 |
| 0332440496 (R.C.T./R.C.O) | `a308c4d2…` | `062a76d3…` | 800,00 | **no** | 0 | 0 | 0 | 0 |

Effetti collaterali presenti: solo **2 righe** in `movimenti_polizza` (snapshot tecnici, nessun incasso/E.C. reale). Nessun effetto su E/C clienti, E/C compagnie, provvigioni, rimesse, sinistri.

Vuoi **azzerare completamente** — niente "annullato come ancora di log", proprio sparire: il cliente deve risultare come se non avesse mai avuto polizze. Cancellazione fisica (HARD DELETE) di titoli + tutto ciò che vi pende.

## Cosa farò (un'unica migration transazionale)

Per **ognuno dei 4 titoli** sopra, in quest'ordine FK-safe e dentro una sola transazione:

1. `DELETE FROM pagamenti_provvigioni_righe` per provvigioni del titolo
2. `DELETE FROM provvigioni_generate WHERE titolo_id IN (...)`
3. `DELETE FROM rimessa_dettaglio WHERE titolo_id IN (...)`
4. `DELETE FROM movimenti_contabili WHERE riferimento_tipo='titolo' AND riferimento_id IN (...)`
5. `DELETE FROM movimenti_polizza WHERE titolo_id IN (...)`  ← gli unici 2 record collaterali esistenti
6. `DELETE FROM titoli_split_commerciali WHERE titolo_id IN (...)`
7. `DELETE FROM titoli_compensazioni WHERE titolo_id IN (...)` (se presenti)
8. `DELETE FROM titoli_eventi_snapshot WHERE titolo_id IN (...)`
9. `DELETE FROM titoli_numeri_storici WHERE titolo_id IN (...)`
10. `DELETE FROM appendici_polizza WHERE titolo_id IN (...)`
11. `DELETE FROM premi_garanzia_polizza WHERE titolo_id IN (...)`
12. `DELETE FROM polizza_cga / polizza_cga_premio_garanzia / polizza_garanzie_personali` se presenti
13. `DELETE FROM veicoli_polizza / conducenti_polizza` per gli RCA (anche se non sembra il caso)
14. `DELETE FROM titoli WHERE id IN (4 ids)` — prima quietanze (`sostituisce_polizza NOT NULL`), poi madri
15. `DELETE FROM rimessa_premi` testate rimaste senza righe (cleanup)
16. Riepilogo conteggi via `RAISE NOTICE`

**Differenza chiave rispetto a `annulla_polizza_cascade`:** non lascio il titolo in stato `annullato` — lo elimino del tutto. Niente traccia, niente log_attivita di annullamento, niente riga "ancora".

## Cosa NON tocco

- Anagrafica `clienti` (resta), i suoi referenti, documenti, chat, sinistri non legati a queste polizze.
- Altri clienti / altri titoli del database.
- Trigger DB esistenti (`prevent_double_messa_cassa` ecc.) — non serve bypass perché nessuno dei 4 titoli è in stato `incassato`.

## Conferma richiesta

L'operazione è **irreversibile**. Procedo solo dopo tua approvazione esplicita di questo piano. Vuoi davvero che cancelli fisicamente i 4 titoli del Cliente Ente?
