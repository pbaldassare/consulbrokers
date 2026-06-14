
## Obiettivo

Risolvere il caso "REVO direzione non appare nella tendina Agenzia di Riferimento": nel DB esistono due gruppi compagnia REVO praticamente identici, e l'agenzia/direzione `ELBA — REVO Insurance S.p.A. direzione` è agganciata a uno solo dei due. Quando in Immissione si sceglie l'altro, la direzione non compare.

## Dati attuali

- `gruppi_compagnia` con descrizione REVO:
  - **GC104 — "REVO"** → id `9dd883b6-348f-4a2c-9744-51c54a17863a` (a questo è legata l'agenzia ELBA)
  - **GC108 — "Revo Insurance S.p.a."** → id `3f25c0d6-cc39-4de0-bf7d-db4031ef1885` (duplicato, nessuna agenzia)
- Riferimenti a GC108:
  - `compagnie.gruppo_compagnia_id` = 0
  - `compagnia_rapporti.gruppo_compagnia_id` = 0
  - Nessun'altra tabella public referenzia `gruppi_compagnia` su GC108.

Quindi GC108 è orfano e può essere rimosso senza spostare nulla.

## Azione

Una sola operazione dati (no migrazione di schema, no modifiche di codice):

```sql
DELETE FROM gruppi_compagnia
WHERE id = '3f25c0d6-cc39-4de0-bf7d-db4031ef1885'; -- GC108 duplicato
```

L'agenzia/direzione `ELBA — REVO Insurance S.p.A. direzione` resta intatta, legata al gruppo GC104 "REVO", e tornerà visibile in `Immissione → Agenzia di Riferimento` non appena si seleziona REVO come Compagnia Assicurativa.

## Verifica

1. Aprire `/compagnie` → cliccare REVO → modale "Agenzie collegate a REVO" deve mostrare ancora la riga `ELBA — REVO Insurance S.p.A. direzione`.
2. Aprire `/portafoglio/immissione`, selezionare Compagnia Assicurativa = REVO → nella tendina **Agenzia di Riferimento** deve comparire `ELBA - REVO Insurance S.p.A. direzione`.
3. Nessun altro REVO duplicato deve apparire nelle liste compagnie.

## Note

- Non viene toccato nessun titolo, rapporto, provvigione o codice frontend.
- Se in futuro spuntassero altri gruppi duplicati, applicheremo lo stesso pattern (verifica riferimenti → delete) caso per caso.
