## Eliminazione polizze/quietanze – Comune di Agnone

Cliente `f59cb208-126c-4e8e-a62d-6226d3707185` ("COMUNE DI AGNONE").

### Dati trovati nel DB

- **2 titoli** su `titoli`:
  - `280c308b…` – `errer`, stato `attivo`, premio 1.826,20 € (quietanza: `sostituisce_polizza = errer`)
  - `2d40a2f9…` – `errer`, stato `annullato`, premio 1.543,16 € (polizza madre)
- **22 righe** su `premi_garanzia_polizza`
- **1 riga** su `movimenti_polizza`
- **2 righe** su `provvigioni_generate` (entrambe `pagata = false`, non distinte)
- Nessuna riga su: `titoli_eventi_snapshot`, `veicoli_polizza`, `conducenti_polizza`, `appendici_polizza`, `sinistri`, `dettaglio_riparto`, `rimessa_dettaglio`, `note_restituzione_dettaglio`, `titoli_split_commerciali`, `titoli_sostituzioni`, `titoli_storni`, `titoli_regolazioni`
- `estratti_conto` non ha collegamenti per titolo/cliente (è ledger di ufficio); nessun impatto

### Migrazione (DELETE in ordine FK-safe)

```sql
WITH ids AS (
  SELECT id FROM titoli
  WHERE cliente_anagrafica_id = 'f59cb208-126c-4e8e-a62d-6226d3707185'
)
DELETE FROM provvigioni_generate WHERE titolo_id IN (SELECT id FROM ids);
DELETE FROM movimenti_polizza      WHERE titolo_id IN (SELECT id FROM ids);
DELETE FROM premi_garanzia_polizza WHERE titolo_id IN (SELECT id FROM ids);
DELETE FROM titoli_eventi_snapshot WHERE titolo_id IN (SELECT id FROM ids);
DELETE FROM titoli                 WHERE id IN (SELECT id FROM ids);
```

Eseguita via `supabase--migration` (DELETE richiede migrazione, non `psql`).

### Cosa NON viene toccato

- Anagrafica cliente "Comune di Agnone" e relativi indirizzi/referenti
- Eventuali documenti del cliente, chat, log attività precedenti
- Estratti conto di ufficio (nessun legame diretto)

### Verifica post-migrazione

`SELECT count(*) FROM titoli WHERE cliente_anagrafica_id = '…';` → 0
Ricaricare `/archivi/clienti/f59cb208…` tab Polizze → vuota; "totale premio" = 0.

Confermi l'eliminazione definitiva?
