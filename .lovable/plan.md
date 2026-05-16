# Riconfigurazione sezione "Contratto" — Immissione Polizza

Allineiamo la sezione **Contratto** in `src/pages/ImmissionePolizzaPage.tsx` (e a cascata `TitoloDetail`) al nuovo modello `compagnie` + `compagnia_rapporti` introdotto con la form pulita del 16/05/2026.

## Modello di riferimento

Tre campi nella card Contratto, in quest'ordine:

1. **Compagnia Assicurativa** → `gruppi_compagnia` (la compagnia madre, es. NOBIS, AIG). Sempre obbligatoria.
2. **Agenzia di Riferimento** → record di `compagnie` (tipo `agenzia` · `direzione` · `broker` · `plurimandataria`). Sempre obbligatoria.
3. **Rapporto Agenzia** → record di `compagnia_rapporti`. Mostrato **solo** se l'agenzia è `broker` o `plurimandataria`. In quel caso obbligatorio.

### Regola condizionale (driver: `compagnie.tipo`)

| Tipo agenzia | Rapporto |
|---|---|
| `agenzia` | Nascosto. Il legame con la compagnia madre è già univoco via `compagnie.gruppo_compagnia_id`. |
| `direzione` | Nascosto. Idem. |
| `broker` | Visibile, obbligatorio. Lista da `compagnia_rapporti` filtrata per `compagnia_id` = agenzia scelta **AND** `gruppo_compagnia_id` = compagnia scelta. |
| `plurimandataria` | Idem broker. |

## Filtro lista Agenzie

Quando la Compagnia Assicurativa è scelta, il dropdown "Agenzia di Riferimento" mostra:

- **agenzie / direzioni** con `gruppo_compagnia_id` = compagnia scelta;
- **broker / plurimandatarie** che hanno almeno un record in `compagnia_rapporti` con `gruppo_compagnia_id` = compagnia scelta e `attivo = true`.

Se la Compagnia non è ancora scelta, l'Agenzia è disabilitata (placeholder "Seleziona prima la Compagnia"). Quando si cambia la Compagnia, l'Agenzia e il Rapporto vengono resettati se non più coerenti.

Quando si sceglie un'Agenzia di tipo `agenzia`/`direzione`, viene fatto **auto-sync** della Compagnia (come oggi) leggendo `compagnie.gruppo_compagnia_id`.

## Persistenza su `titoli`

Al submit vengono valorizzati:

- `gruppo_compagnia_id` ← Compagnia Assicurativa
- `compagnia_id` ← Agenzia di Riferimento
- `compagnia_rapporto_id` ← Rapporto (NULL per `agenzia`/`direzione`)
- `codice_rapporto` ← `compagnia_rapporti.codice_rapporto` (NULL per `agenzia`/`direzione`)

Validazione blocking prima del salvataggio:
- Compagnia mancante → errore.
- Agenzia mancante → errore.
- Agenzia broker/plurimandataria senza rapporto scelto → errore "Selezionare il rapporto agenzia".

## Pulizie da fare

- Rimuovere il filtro corrente "se ci sono 0 rapporti mostra niente" per agenzie/direzioni — già implicito perché non hanno rapporti.
- Rimuovere il vecchio comportamento "auto-seleziona se 1 rapporto" per agenzie/direzioni (per loro il selettore non appare proprio); resta valido per broker/plurimandatarie con 1 solo rapporto coerente (lo si mostra in sola lettura come oggi).
- La query `compagnieList` deve includere `tipo` (e `gruppo_compagnia_id` come oggi).
- La query `rapportiAgenzia` aggiunge il filtro `.eq("gruppo_compagnia_id", selectedGruppoCompagniaId)`.

## Dettagli tecnici

File toccati:
- `src/pages/ImmissionePolizzaPage.tsx`
  - `compagnieList` SELECT aggiunge `tipo`.
  - `rapportiAgenzia` SELECT aggiunge `gruppo_compagnia_id` + filtro per gruppo.
  - Nuovo derivato `agenzieFiltrate` che applica le regole sopra (usando una query ausiliaria `rapportiPerGruppo` che ritorna `distinct compagnia_id` da `compagnia_rapporti` per la compagnia scelta, così posso includere broker/plurimand. anche se non hanno `gruppo_compagnia_id` sulla `compagnie`).
  - UI: i due `SearchableSelect` Compagnia + Agenzia restano nella stessa griglia; il blocco "Rapporto Agenzia" appare condizionato a `tipoAgenzia in (broker, plurimandataria)`.
  - `handleSave` aggiorna i campi su `titoli` e blocca con `toast.error` se manca un required.
- `src/pages/TitoloDetail.tsx` (sezione `PolizzaSection` riusata): stessa logica, edit mode legge `tipo` dell'agenzia e mostra/nasconde il rapporto coerentemente.
- Nessuna migration DB: i campi su `titoli` (`gruppo_compagnia_id`, `compagnia_id`, `compagnia_rapporto_id`, `codice_rapporto`) esistono già.

## Esempio concreto

1. Compagnia = **NOBIS**.
2. Lista Agenzia mostra:
   - `RE233 - Agenzia Torino Moncalieri` (tipo `agenzia`, gruppo Nobis)
   - `Etisicura` (tipo `broker`, ha rapporto attivo con Nobis)
3. Scelgo `RE233` → rapporto nascosto, salvo con `compagnia_rapporto_id = NULL`.
4. Scelgo `Etisicura` → appare select Rapporto con i suoi rapporti Nobis (es. "Nobis – Torino centro", "Nobis – Milano"). Devo sceglierne uno per salvare.
