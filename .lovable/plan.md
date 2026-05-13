## Obiettivo
1. Risolvere il bug per cui il search del cliente in `/portafoglio/immissione` non restituisce risultati.
2. Uniformare graficamente la sezione "Cliente" allo standard usato negli altri punti di creazione (es. `TrattativeList`): un solo campo di ricerca unificato.

## Analisi bug
Nella query `clienti-search-immissione` (riga 280) la `or(...)` su `ragione_sociale,cognome,nome,codice_fiscale,partita_iva` con pattern `%term%` fallisce silenziosamente in alcuni casi tipici:
- Spazi nel termine (`baldassare paolo`) generano un `or` che PostgREST interpreta letteralmente, e l'errore viene ingoiato (`const { data } = await q;` senza gestire `error`).
- Mancato debounce: ogni keystroke spara una query e i risultati si sovrappongono.
- Nessuna `or` su `codice_ricerca` (presente nella tabella e usato nel lookup rapido).

## Fix

### 1. `src/pages/ImmissionePolizzaPage.tsx`

**a) Hardening della query (riga ~280)**
- Aggiungere debounce 350ms su `clienteSearch` (regola di progetto).
- Sanitizzare il termine: `term.replace(/[%,()]/g, " ").trim()`; se contiene spazi, splittare in token e applicare `.ilike("codice_ricerca", ...)` + `.or(...)` per il primo token, poi filtrare lato client per gli altri token su `ragione_sociale | cognome+nome`.
- Estendere `or` a `codice_ricerca.ilike.${term}`.
- Esporre `error` e loggarlo; restituire `[]` in caso di errore.
- Mantenere `limit(50)`.

**b) Layout sezione Cliente unificato (righe 697–829)**
Riorganizzare in:
```
[ PolizzaSection "Cliente & Sede" ]
  Riga 1 (grid 1fr auto):
    - Label "Cliente *"
    - SearchableSelect server-side (placeholder "Cerca per nome, CF, P.IVA o codice…")
      con icona lente nell'input (via prop searchPlaceholder già presente)
    - Bottone "Nuovo Cliente" (invariato)
  Riga 2 (visibile solo se cliente selezionato): badge Gruppo Finanziario (invariato)
  Riga 3 (grid 3 col): Sede * | Produttore | Specialist (invariati)
```
- **Rimuovere** completamente il blocco "Lookup rapido (Codice / CF / P.IVA)" (righe 771–785) e lo stato `codiceCliente` + relative query/effetti se non più usati altrove.
- Verificare che `codiceCliente` non sia referenziato in altri effetti (es. eredità ufficio o autopopolazione AI); in tal caso reindirizzare gli usi al `selectedClienteId` già impostato dal SearchableSelect.

**c) UX**
- Quando l'utente seleziona un cliente, popolare automaticamente `clienteSearch` con la label (già fatto in `onCreated`); applicare lo stesso comportamento in `onValueChange` per coerenza visiva del campo.

### 2. Nessuna modifica al componente `SearchableSelect` (già supporta `searchValue` / `onSearchChange` / `searchPlaceholder` dal fix precedente).

### 3. Nessuna modifica DB / RLS.

## Fuori scope
- Sede / Produttore / Specialist: layout invariato (3 colonne come oggi).
- Sezioni Contratto, Tecnico, Provvigioni: invariate.
- Altri flussi (Rinnovo, Sospensione, Storno): invariati.

## QA
- Digitare "baldassare" → comparirà "baldassare paolo".
- Digitare "BLDPLA74R21I449G" (CF) → match diretto.
- Digitare "01890920703" (P.IVA) → match.
- Digitare 1 carattere → "Digita almeno 2 caratteri".
- Selezione cliente → badge gruppo finanziario + autoload Sede.
