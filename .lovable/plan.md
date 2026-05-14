## Stato attuale

Sulla polizza messa a cassa **122** (Interfidi, Sede Napoli, premio 138,47 €, prov. quietanza 11,00 €) la `calcola-provvigioni` ha effettivamente scritto in `provvigioni_generate`:

- riga **commerciale 40%** = 4,40 €  → produttore Interfidi
- riga **admin 60%** = 6,60 €  → quota Consul/Sede

Quindi i numeri ci sono. Ma:

### Problema 1 — E/C Produttori mostra 0,00

`src/pages/contabilita/ECProduttoriContabPage.tsx` (riga 76) raggruppa per `user_id`:

```ts
if (p.user_id && grouped[p.user_id]) { ... }
```

I produttori-anagrafica (Interfidi) **non hanno `user_id`**: il loro identificativo è `anagrafica_commerciale_id`, che però **non viene salvato** nella tabella `provvigioni_generate` (lo schema ha solo `titolo_id, user_id, percentuale, importo_provvigione, tipo_destinatario, solo_statistico, pagata`).

Risultato: la riga 4,40 € rimane "orfana" e il totale resta 0.

### Problema 2 — E/C Sede

Non esiste oggi una pagina E/C Sede. La quota Sede coincide oggi con la riga `admin/Consul` (residuo) ed è già scritta come 6,60 €, ma non è esposta in alcuna UI dedicata.

## Fix proposto

### A. Attribuzione produttore (anagrafica)

1. **Migration**: aggiungere colonna `anagrafica_commerciale_id uuid NULL REFERENCES anagrafiche_professionali(id) ON DELETE SET NULL` su `provvigioni_generate` + indice.
2. **Edge `calcola-provvigioni`**: nelle righe `commerciale` salvare anche `anagrafica_commerciale_id: s.anagrafica_commerciale_id`. Backfill della polizza 122 (e di eventuali altre già messe a cassa con stessa pattern) tramite UPDATE collegato a `titoli_split_commerciali` o, se mancanti split, `titoli.anagrafica_commerciale_id`.
3. **`ECProduttoriContabPage`**: cambiare la query per selezionare anche `anagrafica_commerciale_id` e raggruppare prima su `anagrafica_commerciale_id`, poi fallback su `user_id`. Aggiornare anche lo storico (`ECProduttoriStoricoPage`) se segue la stessa logica.

### B. Sede (out of scope adesso)

Confermo che la quota Sede oggi è la riga `admin` (6,60 €). Se ti serve un E/C Sede dedicato (totali per `ufficio_id` derivati da `titoli`), lo aggiungo in un secondo step — fammi sapere.

## Verifica

- Apertura `/contabilita/ec-produttori` filtrato su INTERFIDI SRL → totale provvigioni `4,40 €`, lordo `138,47 €`.
- Provvigione su pol. 122 in `provvigioni_generate` con `anagrafica_commerciale_id = cbe0e599-...`.
