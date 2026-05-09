## Obiettivo
Semplificare e migliorare il dialog "Apri nuovo sinistro" del portale cliente:
1. **Un solo step** (no wizard 1/3, 2/3, 3/3).
2. **Indirizzo con Google Maps Autocomplete** riusando `AddressAutocomplete` già esistente nel progetto.
3. **Menu a tendina per i tipi di sinistro più ricorrenti** (campo `tipo_sinistro` già presente in DB).

## Modifiche

### `src/components/cliente/NuovaDenunciaSinistroDialog.tsx` (riscrittura)

Rimuovere `step`, `setStep` e i tre branch condizionali. Mantenere un unico form scrollabile con sezioni separate da titoli leggeri:

**1. Polizza & Tipo**
- `Select` Polizza coinvolta (come oggi).
- `Select` **Tipo di sinistro** (nuovo) con opzioni comuni:
  - `rca_collisione` — RCA: collisione/tamponamento
  - `rca_urto` — RCA: urto contro ostacolo
  - `furto_veicolo` — Furto/incendio veicolo
  - `cristalli` — Rottura cristalli
  - `incendio_immobile` — Incendio immobile
  - `furto_immobile` — Furto/scippo
  - `danni_acqua` — Danni da acqua
  - `eventi_atmosferici` — Eventi atmosferici
  - `rc_terzi` — Responsabilità verso terzi
  - `infortunio` — Infortunio
  - `malattia` — Malattia
  - `altro` — Altro (mostra campo testo libero opzionale)

**2. Data e luogo**
- `Input type="date"` Data evento (obbligatorio).
- `AddressAutocomplete` (componente esistente) per **Indirizzo**: al `onSelect` popola automaticamente stati locali `indirizzo`, `cap`, `citta`, `provincia`. L'utente può sempre modificare manualmente i 4 campi sotto.
- Campi mostrati read-friendly sotto l'autocomplete: Città, CAP, Provincia (compilati ma editabili).

**3. Dinamica**
- `Textarea` (min 5 char) — invariato.

**4. Dati opzionali (mostrati solo se rilevanti)**
- Controparte (sempre visibile, opzionale).
- Targa veicolo (visibile solo se `tipo_sinistro` inizia con `rca_` o è `furto_veicolo` o `cristalli`).

**5. Allegati**
- `Input type="file" multiple` con lista rimovibile (come oggi).

**Footer**: due bottoni — `Annulla` e `Invia denuncia` (no più Avanti/Indietro).

### Insert su `sinistri`
Aggiornare il payload includendo:
- `tipo_sinistro` (valore selezionato)
- `indirizzo_sinistro` (da autocomplete)
- `cap_sinistro`, `provincia_sinistro`
- `citta_sinistro` (già presente, ora popolato dall'autocomplete)
- `luogo_sinistro` mantenuto come fallback compatibilità (= `indirizzo` formattato completo)

### Validazione submit
Bottone "Invia denuncia" abilitato quando:
- `titoloId` && `tipoSinistro` && `dataEvento` && `dinamica.length > 5`

## Out of scope
- Modifiche allo schema DB (tutti i campi esistono già).
- Validazione lato server / nuove RLS.
- Integrazione mappa visuale (solo autocomplete testuale).

## File toccati
- `src/components/cliente/NuovaDenunciaSinistroDialog.tsx` (riscrittura completa, ~150 righe).
