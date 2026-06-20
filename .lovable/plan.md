# Fix tabella Carico

## Cosa non funziona oggi

Osservando i dati reali (RCM00010074404):

1. **Click sulla riga/badge quietanza apre la polizza**
   - La cella `Tipo` (badge "Quietanza N/9") non ha `stopPropagation`, quindi il click attiva la `navigate(rowHref(p))` della riga.
   - `rowHref` per le quietanze legacy va a `/polizze/:polizza_id` perché `sostituisce_polizza` è `NULL` (vedi punto 2).

2. **`isQuietanzaRow` basato solo su `sostituisce_polizza`**
   - `src/lib/polizzeDisplay.ts` considera quietanza solo le righe con `sostituisce_polizza` valorizzato.
   - Nei dati legacy (es. RCM00010074404) le quietanze hanno `sostituisce_polizza = NULL` ma `numero_rata = 2..9`. Risultato: la riga viene trattata come polizza madre → indentazione/stile sbagliato, link "Polizza madre" non compare, e il click non sa che è una quietanza.

3. **Colonna "Polizza madre" mostra lo stesso numero della prima colonna**
   - `src/pages/PortafoglioCaricoPage.tsx` riga 713 usa `p.numero_titolo` come label del bottone "Polizza madre" → coincide con la colonna N° Polizza. Il numero della polizza madre vero è `p.numero_polizza_snapshot` (oppure `polizze.numero_polizza` via `polizza_id`).

4. **Agenzia e Targa vuoti**
   - La view `v_portafoglio_quietanze` legge `compagnia_nome` e `targa_telaio` SOLO da `polizze`. Per le polizze legacy `polizze.compagnia_id` e `polizze.targa_telaio` sono `NULL`, ma i dati esistono sul `titoli` collegato (in altri casi). La view va resa robusta facendo fallback su `titoli`.

## Interventi

### A. UI — `src/pages/PortafoglioCaricoPage.tsx`

- **Helper locale** `isQ = isQuietanzaRow(p) || (Number(p.numero_rata) > 1)` (oppure `!!p.quietanza_id && Number(p.numero_rata) > 1`). Usato per stile riga, indentazione, "Polizza madre", e per disabilitare il click.
- **Disabilito il click sulle quietanze**:
  - `onClick={isQ ? undefined : () => navigate(rowHref(p))}`
  - `className`: rimuovo `cursor-pointer` quando `isQ` (cursor `default`).
- **Cella `Tipo`**: aggiungo `onClick={(e) => e.stopPropagation()}` così il badge non propaga mai.
- **Colonna "Polizza madre"**:
  - Mostro `p.numero_polizza_snapshot || p.numero_titolo` come label del bottone link (resta `navigate('/polizze/' + p.polizza_id)`).
  - Visibile per tutte le quietanze (nuova logica `isQ`).
- **Prima colonna (N° polizza)**: per le quietanze (nuova `isQ`) mostro un identificativo rata coerente (es. `Rata N/T` o `numero_titolo · N/T`) invece di ripetere il numero polizza, così la "Polizza madre" ha senso. Lascio comunque `numero_titolo` come fallback.

### B. View DB — nuova migration `…_v_portafoglio_quietanze_fallback.sql`

Ricreo `public.v_portafoglio_quietanze` con fallback a `titoli` quando il dato è nullo su `polizze`:

```sql
COALESCE(comp.nome,  comp_t.nome)               AS compagnia_nome,
COALESCE(p.compagnia_id, t.compagnia_id)        AS compagnia_id,
COALESCE(p.targa_telaio, t.targa_telaio)        AS targa_telaio,
COALESCE(p.ramo_id, t.ramo_id)                  AS ramo_id,
COALESCE(r.descrizione, r_t.descrizione)        AS ramo_nome,
COALESCE(r.codice, r_t.codice)                  AS ramo_codice,
```

con due join extra `LEFT JOIN compagnie comp_t ON comp_t.id = t.compagnia_id` e `LEFT JOIN rami r_t ON r_t.id = t.ramo_id`. Nessun cambio di colonne, solo valori più completi.

### C. Nessuna modifica ai dati legacy

Non tocco le polizze duplicate `RCM00010074404`, `204366651`, `6131402092` (vincolo memoria: necessarie per riconciliazione Apr 2026).

## File toccati

- `src/pages/PortafoglioCaricoPage.tsx` (UI carico)
- `supabase/migrations/<timestamp>_v_portafoglio_quietanze_fallback.sql` (ricreazione view con `CREATE OR REPLACE VIEW`)

## Cosa non cambia

- Filtri, paginazione, ricerca, riepiloghi, comportamento "Messa a cassa".
- Route `/quietanze/:id` e `/polizze/:id`.
- Tipi generati Supabase (la view mantiene le stesse colonne).
