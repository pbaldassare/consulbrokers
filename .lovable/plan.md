

## Piano: Espansione Schema Polizze + Armonizzazione UI + Dati Demo

### Panoramica

Basandomi sugli screenshot del legacy (CONTRATTO, PERIODO, REGOLAZIONE, IMPORTI, SOSTITUZIONI/STORNI, DETTAGLIO RIPARTO), la tabella `titoli` ha solo 12 campi utili. Devo aggiungerne ~30 per coprire tutte le sezioni, poi popolare le polizze esistenti con dati realistici e armonizzare la UI di dettaglio e immissione.

### 1. Nuove colonne su `titoli` (migration SQL)

**Sezione CONTRATTO:**
- `compagnia_id` (uuid FK compagnie) — ereditata dal prodotto ma sovrascrivibile
- `ramo_id` (uuid FK rami) — ramo assicurativo
- `gruppo_ramo` (text), `specialist` (text), `tipo_portafoglio` (text)
- `cig_rif` (text), `vincolo` (text), `descrizione_polizza` (text)
- `appendice` (text), `riga` (integer DEFAULT 0)
- `targa_telaio` (text)

**Sezione PERIODO:**
- `durata_da` (date), `durata_a` (date), `anni_durata` (integer)
- `garanzia_da` (date), `garanzia_a` (date)
- `data_competenza` (date), `limite_mora` (date), `mora_giorni` (integer DEFAULT 15)
- `rate` (integer DEFAULT 1), `tipo_rinnovo` (text — tacito_rinnovo/scadenza_naturale/etc)
- `disdetta_mesi` (integer)

**Sezione REGOLAZIONE:**
- `regolazione` (boolean DEFAULT false), `tipo_lettera_regolazione` (text)
- `tipo_scadenza` (text), `giorni_presentazione` (integer)
- `periodicita` (text — annuale/semestrale/trimestrale/mensile)
- `libro_matricola` (text — no/auto/altro)

**Sezione IMPORTI:**
- `rimborso` (boolean DEFAULT false), `valuta` (text DEFAULT 'EUR'), `cambio` (numeric DEFAULT 1)
- `indicizzata` (boolean DEFAULT false), `no_calcolo_tasse` (boolean DEFAULT false)
- `premio_netto` (numeric), `addizionali` (numeric), `tasse` (numeric)
- `provvigioni_firma` (numeric), `provvigioni_quietanza` (numeric)
- `premio_netto_quietanza` (numeric), `addizionali_quietanza` (numeric), `tasse_quietanza` (numeric)
- `pag_diretto_compagnia` (boolean DEFAULT false), `emissione_fee` (boolean DEFAULT false)
- `formato_elettronico` (boolean DEFAULT false)

**Sezione SOSTITUZIONI/STORNI:**
- `sostituisce_polizza` (text), `sostituisce_riga` (integer), `sostituisce_appendice` (text)
- `storno_polizza` (text), `storno_riga` (integer), `storno_appendice` (text)

### 2. Tabella `dettaglio_riparto` (nuova)

Per il dettaglio riparto compagnia (screenshot 2):
- `id`, `titolo_id` (FK), `compagnia_id` (FK)
- `quota_percentuale` (numeric), `perc_provv_netto` (numeric), `perc_provv_addizionali` (numeric)
- `netto` (numeric), `addizionali` (numeric), `tasse` (numeric), `totale` (numeric)
- `provv_netto` (numeric), `provv_addizionali` (numeric)
- `tipo_pagamento` (text — C/D), `data_copertura` (date)
- `emissione_compagnia` (text), `perc_gestione` (numeric)

### 3. Ereditarietà automatica

Quando si seleziona un cliente nella polizza:
- Pre-compilare l'AE dal `codici_commerciali_cliente` (ruolo = account_executive)
- Pre-compilare il Gruppo Finanziario

Quando si seleziona un prodotto:
- Pre-compilare `compagnia_id` dal prodotto
- Pre-compilare `ramo_id` se disponibile

### 4. Popolare polizze esistenti (migration SQL)

UPDATE sulle ~230 polizze esistenti per riempire i nuovi campi:
- `compagnia_id` derivato da `prodotti.compagnia_id`
- `durata_da` = `created_at::date`, `durata_a` = `durata_da + interval '1 year'`
- `premio_netto` = `premio_lordo * 0.78`, `tasse` = `premio_lordo * 0.22`, `addizionali` = random
- `rata` = 1, `tipo_rinnovo` = 'tacito_rinnovo', `periodicita` = 'annuale'
- `provvigioni_firma` = `premio_netto * 0.07..0.12` (random)
- `ramo_id` collegato casualmente ai rami esistenti
- `data_competenza` = `durata_da`, `mora_giorni` = 15

### 5. Aggiornamento UI

**TitoloDetail.tsx**: Ristrutturare con Accordion/fieldset per sezioni:
- CONTRATTO (con link al cliente, AE ereditato, compagnia, ramo)
- PERIODO (date, durata, rinnovo)
- REGOLAZIONE
- IMPORTI (griglia Firma/Quietanza con Netto, Addizionali, Tasse, Totale, Provvigioni)
- SOSTITUZIONI/STORNI
- DETTAGLIO RIPARTO (tabella)
- Tab esistenti (Provvigioni, Documenti, Chat, Timeline)

**ImmissionePolizzaPage.tsx**: Espandere con tutte le sezioni del legacy (fieldset stile attuale). Auto-fetch AE e compagnia dal cliente/prodotto selezionato.

### Modifiche per file

| File | Modifica |
|------|----------|
| **Migration SQL** | ALTER TABLE titoli (~30 colonne). CREATE TABLE dettaglio_riparto. UPDATE titoli con dati demo |
| **types.ts** | Aggiornamento tipi |
| **TitoloDetail.tsx** | Ristrutturazione completa con sezioni Contratto/Periodo/Regolazione/Importi/Storni/Riparto |
| **ImmissionePolizzaPage.tsx** | Aggiungere tutte le sezioni con auto-ereditarietà da cliente e prodotto |

