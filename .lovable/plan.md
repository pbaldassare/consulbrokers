## Autocomplete indirizzo completo (CAP/Città/Provincia) e propagazione Sede → Anagrafica Cliente

### Problema osservato
1. Nel dialog **Modifica Sede** (`SediManager.tsx`) e in **NuovoClienteDialog** sezione Sede Aziendale, l'autocomplete Google riempie via+civico ma a volte non popola CAP/Città/Provincia in modo affidabile (dipende da quali `address_components` Google restituisce — es. mancanza `administrative_area_level_2` per alcune città).
2. Quando in anagrafica cliente si seleziona una **Sede (ufficio)** dal SearchableSelect, i campi indirizzo della sede selezionata non vengono propagati / ricalcolati nei campi indirizzo del cliente.

### Modifiche

**1. `src/components/AddressAutocomplete.tsx` — fallback parsing più robusto**
- In `extractAddressComponents`, aggiungere fallback:
  - Provincia: se `administrative_area_level_2` manca, usare `administrative_area_level_2` long_name oppure derivarla dalla mappa CAP→Provincia tramite `comuniItaliani.ts` (già presente in progetto).
  - Città: aggiungere fallback su `administrative_area_level_3` short_name e `postal_town`.
  - CAP: se manca, lasciare vuoto ma loggare warning (Google a volte non lo restituisce per indirizzi parziali).
- Forzare `provincia` sempre uppercase a 2 lettere prima di chiamare `onSelect`.

**2. `src/components/anagrafiche/SediManager.tsx` (riga 264-273)**
- Già funziona, ma rimuovere la logica `c.cap || formData.cap` che mantiene il vecchio valore: quando l'utente seleziona un nuovo indirizzo deve **sempre** sovrascrivere CAP/Città/Provincia con i valori freschi (altrimenti restano quelli del precedente indirizzo).

**3. `src/components/clienti/NuovoClienteDialog.tsx` — propagazione Sede selezionata**
- Trovare il `SearchableSelect` della Sede (ufficio_id) nella sezione anagrafica cliente e aggiungere `onChange` handler che:
  - Fa fetch della sede selezionata da `uffici` (indirizzo, cap, citta, provincia).
  - Popola automaticamente `indirizzoSede`, `capSede`, `cittaSede`, `provinciaSede` se vuoti (oppure chiede conferma con un piccolo banner "Usa indirizzo della sede" cliccabile per evitare sovrascritture indesiderate).
- Approccio scelto: **banner non bloccante** "Compila con indirizzo della Sede selezionata" sotto al select sede, per rispettare la preferenza UX di non sovrascrivere senza conferma.

**4. `public/version.json`** → bump versione.

### Note tecniche
- La funzione `composeIndirizzoFull` in SediManager resta invariata.
- Nessuna modifica DB.
- Memoria di riferimento: `mem://ui/searchable-select-component`.

### Domanda di chiarimento
Confermi questi due punti?
- (a) Il banner "Compila con indirizzo Sede" nel NuovoClienteDialog (vs. autocompilazione automatica silenziosa).
- (b) L'estensione del comportamento anche a `ClienteDetail.tsx` (modifica cliente esistente), non solo al dialog di creazione.