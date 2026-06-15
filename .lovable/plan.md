## Verifica + sostituzione "COMODO EGIDIO" → "Comodo Egidio Carmelo"

### Stato attuale (verificato in DB)

3 record `anagrafiche_professionali`:

| id | tipo | denominazione | attivo | % | riferimenti |
|---|---|---|---|---|---|
| `1e61cdf2…` | corrispondente | **Comodo Egidio Carmelo** (email `aroberti@consulbrokers.it`) | ✅ | 40 / 0 / 11,5 | **5 titoli** già collegati |
| `eb6261c4…` | corrispondente | COMODO EGIDIO (vuoto) | ❌ disattivato | 0 / 0 / 0 | **0** |
| `c691fc2e…` | responsabile_sede | COMODO EGIDIO (vuoto) | ✅ | 0 / 0 / 0 | **0** |

Controllati i FK su: `titoli.anagrafica_commerciale_id`, `titoli.ae_anagrafica_id`, `codici_commerciali_cliente.anagrafica_id`, `produttori_provvigioni_ramo`, `provvigioni_generate`, `titoli_split_commerciali`. Nessun riferimento ai due record duplicati.

**Esito verifica disattivazione**: ✅ funziona. Il record `eb6261c4` è già `attivo=false` e nessuna polizza/provvigione lo usa. Non serve riassegnare nulla — tutte le 5 polizze di Comodo Egidio puntano già al record buono.

### Cosa fare (solo dati, nessuna modifica codice)

1. **Eliminare i 2 duplicati vuoti** (nessuna FK, operazione sicura):
   - `DELETE` su `eb6261c4-…` (Produttori, vuoto, inattivo)
   - `DELETE` su `c691fc2e-…` (Resp. Sede, vuoto, attivo)

2. **Allineare il testo legacy** `titoli.produttore_nome` sui 5 titoli del produttore:
   - `UPDATE titoli SET produttore_nome='Comodo Egidio Carmelo' WHERE anagrafica_commerciale_id='1e61cdf2-…'`
   - Serve solo per coerenza visiva su E/C, stampe e report che leggono il testo legacy.

### Conteggi attesi dopo l'operazione

- Tab **Produttori** → ricerca "comodo": **1 risultato** (solo Comodo Egidio Carmelo, 40% / 0% / 11,5%).
- Tab **Resp. Sede** → ricerca "comodo": **0 risultati**.
- Polizze del produttore: **5** (invariate, già collegate al record corretto).
- Provvigioni / E/C produttore: invariati (nessun ricalcolo necessario, le polizze non cambiano titolare commerciale).

### Note

- Non esistono utenti auth (`profiles`) collegati ai duplicati: l'unico account email (`aroberti@consulbrokers.it`) è già sul record corretto. Nessuno "switch account" da fare.
- Operazione reversibile solo via ripristino da backup — i 2 record cancellati sono però vuoti, quindi la perdita di dati è nulla.
