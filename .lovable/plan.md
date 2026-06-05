# Documenti condivisi su polizza madre + tutte le quietanze

## Obiettivo
Quando l'utente carica un documento su una polizza (madre o una quietanza), il file deve comparire nella tab **Documenti** di **tutti** i titoli della stessa catena (stesso `numero_titolo`, legati via `sostituisce_polizza`).

## Approccio
Nessuna modifica a DB né duplicazione di record: i documenti restano collegati a un singolo `entita_id`, ma la tab Documenti del titolo lavora sull'**intera catena**.

## Modifiche

### 1. `src/components/DocumentiTab.tsx`
- Aggiungere prop opzionale `entitaIds?: string[]` (lista di id appartenenti alla stessa catena, inclusa la madre).
- Quando `entitaTipo === "titolo"` e `entitaIds` è valorizzato:
  - **Query**: usare `.in("entita_id", entitaIds)` invece di `.eq(...)`.
  - **Upload**: salvare il documento con `entita_id = entitaIds[0]` (id della **madre** della catena), così la titolarità è univoca e stabile (le quietanze nuove generate in futuro lo vedranno comunque).
  - **Cache key**: includere la lista ordinata di id per evitare stale data.
- Comportamento invariato per gli altri `entitaTipo`.

### 2. `src/pages/TitoloDetail.tsx`
- Recuperare la catena del titolo corrente (la query catena/`groupTitoliByPolizza` è già usata per il pannello "Quietanze di questa polizza" — riutilizzare quel dato).
- Calcolare `chainIds = [madre.id, ...rate.map(r => r.id)]` (madre per prima).
- Passare `entitaIds={chainIds}` a `<DocumentiTab entitaTipo="titolo" entitaId={titolo.id} ... />`.

### 3. Nessuna migrazione DB
Le RLS esistenti su `documenti` continuano a valere: chi ha accesso a un titolo della catena ha accesso anche agli altri (stesso cliente / sede), quindi la visibilità incrociata è coerente.

## Note tecniche
- L'upload viene sempre associato alla **madre** per evitare che, cancellando una quietanza, sparisca il documento (le rate sono volatili: vengono cancellate in sospensione/storno; la madre resta come "ancora" anche se annullata).
- Il delete resta consentito da qualunque punto della catena (chi può vedere può rimuovere, come oggi).
- La sezione "Documenti" del **portale cliente** (`ClienteDocumenti`, `ProspectDocumenti`) non è toccata: continua a leggere per singolo `entita_id` con filtro `visibile_al_cliente`. Va però verificato (in build) che il portale legga la madre — se sì, ok; se filtra solo per `id` della rata corrente, valuteremo se estendere anche lì in un secondo step (fuori scope di questa richiesta).

## File toccati
- `src/components/DocumentiTab.tsx` — nuova prop + query/upload condivisi.
- `src/pages/TitoloDetail.tsx` — passa la lista `chainIds`.
