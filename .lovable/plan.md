## Obiettivo
Sulla tab "Sinistri" del dettaglio cliente, mostrare un contatore dei sinistri non chiusi/liquidati (analogo a "Polizze (3) · Quietanze (3)").

## Modifiche

### 1. `src/pages/ClienteDetail.tsx`
- Aggiungere una query (o riusare quella già presente in `relatedIds`) per recuperare `stato` dei sinistri del cliente.
- Calcolare `sinistriApertiCount` = numero di sinistri con stato diverso da `chiuso` e `respinto` (gli stati attualmente in DB sono `aperto`, `in_lavorazione`, `in_attesa_documenti`, `chiuso`; il filtro esclude anche `respinto` per coerenza con `SinistriClienteTab`).
- Aggiornare il `TabsTrigger value="sinistri"` (riga 2070) per mostrare il badge con il conteggio se > 0, es: `Sinistri` + Badge rosso/arancione con il numero. Se 0 → nessun badge (o badge neutro con 0, come per "Aziende (0)").

### 2. `src/components/SinistriClienteTab.tsx`
- Rinominare la card "Aperti" in "Aperti / In Lavorazione" per chiarezza (il calcolo `aperti` già esclude `chiuso` e `respinto`, quindi include anche `in_lavorazione` e `in_attesa_documenti`).
- Nessuna modifica logica al conteggio.

## Risultato atteso
- Tab "Sinistri 1" (con badge) quando ci sono sinistri aperti/in lavorazione.
- Tab "Sinistri" senza badge quando tutti i sinistri sono chiusi/respinti.
- La card riassuntiva nella tab mostra etichetta più precisa.
