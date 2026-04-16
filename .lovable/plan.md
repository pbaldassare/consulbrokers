

## Piano: Fix query E/C Compagnia — usare `compagnia_id` diretto

### Problema
La query attuale filtra `.not("prodotto_id", "is", null)` e fa join su `prodotti` per ottenere `compagnia_id`. Ma **tutti i 723 titoli incassati hanno `prodotto_id = NULL`**, quindi la pagina mostra 0 righe. I titoli hanno però `compagnia_id` direttamente sulla tabella (533 su 723).

### Soluzione
Modificare la query per usare `titoli.compagnia_id` direttamente, eliminando il join attraverso `prodotti` e il filtro su `prodotto_id`.

### Modifiche in `src/pages/contabilita/ECCompagniaContabPage.tsx`

**Riga 61-65 — Query titoli**: Rimuovere il select di `prodotti!titoli_prodotto_id_fkey(compagnia_id)`, rimuovere `.not("prodotto_id", "is", null)`, aggiungere `.not("compagnia_id", "is", null)` e selezionare `compagnia_id` direttamente.

**Righe 90-101 — Aggregazione**: Usare `t.compagnia_id` direttamente invece di `(t.prodotti as any)?.compagnia_id`.

Un solo file modificato, fix minimale.

