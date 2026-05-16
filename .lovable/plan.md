## Obiettivo

Nella form **Nuova/Modifica Agenzia** (tab *RUI & Bancario*) il blocco "Coordinate bancarie" oggi mostra una `ContoBancarioSelect` che pesca dai conti Consulbrokers (Valsabbina, BCC Roma, Intesa…). Non ha senso: qui si deve **creare il conto dell'agenzia stessa**, non sceglierne uno esistente.

Sostituiamo la select con un mini-form inline che, al salvataggio dell'agenzia, crea (o aggiorna) un record in `conti_bancari` legato alla compagnia.

## Cosa cambia (UI – `src/pages/CompagnieList.tsx`)

Tab **RUI & Bancario**, sezione "Coordinate bancarie":

Rimosso:
- `ContoBancarioSelect` + helper text "Gestisci i conti in Anagrafiche → Conti Bancari"
- Campi sciolti legacy `iban` / `intestato_a` (duplicati rispetto al record `conti_bancari`)

Aggiunto un blocco unico con i campi del conto agenzia:

```text
Coordinate bancarie
┌─────────────────────────────────────────────────┐
│ Etichetta conto        [es. Conto principale]   │
│ Banca                  [es. Intesa Sanpaolo]    │
│ IBAN                   [IT.. 27 chars]          │
│ Intestato a            [Ragione sociale]        │
│ BIC (opz.)  ABI (opz.) CAB (opz.)               │
│ ☐ Predefinito per rimesse premi                 │
│ Note (opz.)                                     │
└─────────────────────────────────────────────────┘
```

Comportamento:
- **Nuova agenzia**: i campi sono vuoti; alla `onSave` dell'agenzia, se IBAN è valorizzato, viene creato un record `conti_bancari` con `tipo='agenzia'`, `compagnia_id = <id appena creato>`, `is_default = true` (primo conto), e l'id viene scritto in `compagnie.conto_bancario_id`.
- **Modifica agenzia**: al mount carico l'eventuale conto agenzia esistente (`conti_bancari` filtrato per `compagnia_id = agenzia.id` AND `tipo='agenzia'`, ordinato `is_default desc, created_at asc`, prendo il primo). I campi vengono precompilati; al salvataggio faccio `update` su quel record. Se non esiste e l'utente compila l'IBAN, viene creato.
- Validazione IBAN già esistente (uppercase, 27 char IT) riutilizzata da `ContiBancariPage`.
- Se l'utente lascia tutti i campi vuoti, nessun conto viene creato/cancellato (no-op).

Per gestire **più conti** dell'agenzia (caso broker/plurimandatari con conti diversi per rapporto) rimane disponibile la pagina **Anagrafiche → Conti Bancari**: nella form Agenzia mostriamo, sotto il mini-form, un link `Gestisci tutti i conti di questa agenzia →` che apre `/anagrafiche/conti-bancari` filtrato per la compagnia (target da implementare via query param `?compagnia_id=`). Per ora il form gestisce solo il **conto principale**.

## Cosa cambia (codice)

1. `src/pages/CompagnieList.tsx`
   - Estendere `CompagniaForm` con i campi del conto: `conto_etichetta`, `conto_banca`, `conto_iban`, `conto_intestato_a`, `conto_bic`, `conto_abi`, `conto_cab`, `conto_note`, `conto_is_default` (oltre a `conto_bancario_id` già presente, usato come ref del record esistente).
   - In edit mode, query aggiuntiva per caricare il conto agenzia e popolare quei campi.
   - Sostituire il blocco JSX 628-646 con il mini-form descritto sopra.
   - In `handleSave` (creazione/aggiornamento agenzia): dopo l'upsert su `compagnie`, eseguire upsert su `conti_bancari` con i campi raccolti (insert se `conto_bancario_id` nullo e IBAN valorizzato; update se id presente; skip se IBAN vuoto). Aggiornare `compagnie.conto_bancario_id` con l'id risultante.

2. `src/pages/anagrafiche/ContiBancariPage.tsx`
   - Leggere query param `compagnia_id` e, se presente, forzare il filtro tab su "Agenzie" + filtro per quella compagnia (così il link "Gestisci tutti i conti" funziona). Modifica minima, non blocking per il task.

3. Nessuna modifica di schema DB: `conti_bancari.compagnia_id`, `tipo='agenzia'` esistono già dopo la migrazione precedente.

## Note

- I 3 conti "seed" Valsabbina/BCC Roma/Intesa Sanpaolo (IBAN finti) restano nel DB: non li tocchiamo in questo task — li valutiamo separatamente quando vorrai pulire i conti Consulbrokers di esempio.
- Il vecchio campo `compagnie.iban` / `compagnie.intestato_a` resta in DB ma non viene più mostrato/scritto dalla form (la verità diventa il record `conti_bancari`). Possiamo deprecarlo in un task successivo.
