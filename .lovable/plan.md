

## Piano: Rendere tutti i campi anagrafica modificabili + Autocomplete Google Maps per gli indirizzi

### Problema attuale
Nella tab "Anagrafica" del dettaglio cliente, diversi campi usano `FieldDisplay` (solo lettura anche in modalità modifica): Email, Telefono, PEC, Città/CAP residenza, Codice SDI, Forma Giuridica, Città sede. Questi campi devono diventare editabili come gli altri quando si clicca "Modifica".

### Cosa fare

**1. Convertire tutti i `FieldDisplay` in `FieldInput` o `FieldSelect`**

Campi da convertire nella sezione Dati Anagrafici:
- `email` → FieldInput
- `telefono` → FieldInput  
- `pec` → FieldInput
- `citta_residenza` → FieldInput (privato)
- `provincia_residenza` → FieldInput (privato)
- `cap_residenza` → FieldInput (privato)
- `codice_sdi` → FieldInput (azienda)
- `forma_giuridica` → FieldSelect con opzioni standard (azienda)
- `citta_sede` → FieldInput (azienda)
- `provincia_sede` → FieldInput (azienda)
- `cap_sede` → FieldInput (azienda)

**2. Integrare `AddressAutocomplete` per i campi indirizzo**

Il componente `AddressAutocomplete` esiste già nel progetto e usa la chiave Google Maps già configurata (`VITE_GOOGLE_MAPS_API_KEY`). Sostituire i normali `FieldInput` per i campi indirizzo con questo componente, che auto-compila indirizzo, CAP, città e provincia.

Campi da collegare:
- **Indirizzo Residenza** (privato) → auto-popola `cap_residenza`, `citta_residenza`, `provincia_residenza`
- **Sede** (azienda) → auto-popola `cap_sede`, `citta_sede`, `provincia_sede`
- **Indirizzo Alternativo** → auto-popola `cap_alternativo`, `citta_alternativa`, `provincia_alternativa`
- **Indirizzo Fiscale** → auto-popola `cap_fiscale`, `citta_fiscale`, `provincia_fiscale`

**3. Creare un componente helper `FieldAddress`**

Nuovo componente inline nel file che, in modalità modifica, mostra `AddressAutocomplete` e quando l'utente seleziona un indirizzo da Google, chiama `updateField` per tutti e 4 i campi correlati (indirizzo, CAP, città, provincia). In modalità readOnly mostra il testo come prima.

### File coinvolti
- **Modifica**: `src/pages/ClienteDetail.tsx` — convertire FieldDisplay → FieldInput, aggiungere FieldAddress con AddressAutocomplete, importare il componente

