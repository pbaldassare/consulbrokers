# Filtro Account Executive per Sede del cliente

## Problema
Nella tendina **Account Executive** (cliente / immissione polizza / titolo) compaiono tutti gli AE attivi senza alcuna relazione con la Sede del cliente. L'utente si aspetta di vedere prima gli AE della Sede del cliente (es. Campobasso).

Verifica DB: in `anagrafiche_professionali` (tipo `account_executive`) il campo `ufficio_id` è oggi sempre `NULL` per tutti gli AE → nessun AE è collegato a una Sede.

## Soluzione

### 1. Hook `useAccountExecutivesLookup`
Aggiungere parametro opzionale `ufficioId?: string`:
- Se passato, eseguire una prima query filtrata `eq('ufficio_id', ufficioId)`.
- Se la query restituisce ≥1 risultato → ritorna quegli AE.
- Se restituisce 0 risultati (fallback) → seconda query senza filtro su `ufficio_id` (lista globale di tutti gli AE attivi).
- Restituire anche un flag `isFallback` in modo che la UI possa mostrare un hint "Nessun AE per la Sede: mostro tutti".
- Cache key separata per `ufficioId` (`["lookup-ae-anagrafiche", ufficioId ?? "all"]`).

### 2. Punti di utilizzo
- **`src/pages/ImmissionePolizzaPage.tsx`** → passare l'`ufficio_id` del cliente selezionato.
- **`src/pages/TitoloDetail.tsx`** → passare l'`ufficio_id` del titolo/cliente.
- **`src/components/clienti/NuovoClienteDialog.tsx`** e la sezione "Assegnazioni Gestionali" del dettaglio cliente (`ClienteDetail` / `AssegnazioniGestionaliSection`) → passare l'`ufficio_id` selezionato nel campo Sede; al cambio Sede invalidare la query AE.

### 3. UI
Sotto la tendina AE, quando `isFallback === true`, mostrare un piccolo testo informativo:
> "Nessun Account Executive collegato alla Sede selezionata. Mostro tutti gli AE attivi."

### 4. Nessuna migrazione DB
La colonna `ufficio_id` esiste già su `anagrafiche_professionali`. Per popolarla servirà che l'utente, in seguito, assegni la Sede agli AE dall'anagrafica professionale — non parte di questo task.

## Verifica
- Aprire un cliente con Sede Campobasso: oggi (nessun AE collegato) la tendina mostra tutti gli AE con messaggio di fallback.
- Quando in futuro almeno un AE verrà collegato a Ufficio Campobasso, la tendina mostrerà solo quelli.
- Cambio Sede sul cliente → la lista AE si aggiorna senza reload.
