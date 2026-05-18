## Obiettivo
Allineare la dialog "Rapporti con Compagnia" (`/compagnie` → Rapporti) agli standard usati nel resto dell'app per IBAN e indirizzo.

## 1. IBAN con validazione mod-97 + lunghezza paese
File: `src/components/compagnie/RapportiCompagniaDialog.tsx`

- Sostituire il check artigianale (solo `startsWith("IT") && length !== 27`) con `validateIban` da `src/lib/validateIban.ts` (già usato altrove, gestisce IT=27, mod-97, lunghezze per ogni paese).
- Validazione live: bordo rosso + messaggio sotto il campo quando l'utente ha digitato qualcosa di non valido.
- Blocco del bottone "Salva Rapporto" se IBAN compilato ma non valido.
- IBAN resta opzionale (vuoto = fallback IBAN compagnia, come oggi).
- Mantenere normalizzazione (uppercase, no spazi) già presente.

## 2. Sede del rapporto con Google Maps autocomplete
File: `src/components/compagnie/RapportiCompagniaDialog.tsx`

- Sostituire il campo libero "Indirizzo" con il componente `AddressAutocomplete` (`src/components/AddressAutocomplete.tsx`) già usato in clienti/sedi.
- Quando l'utente seleziona un suggerimento, popolare automaticamente:
  - `sede_indirizzo` (via + civico)
  - `sede_cap`
  - `sede_citta`
  - `sede_provincia` (sigla 2 lettere)
- I campi CAP / Città / Prov. restano comunque editabili manualmente per correzioni.

## Fuori scope
- Nessuna modifica a DB, RPC, RLS o tipi.
- Nessuna modifica a `ProvvigioniRapportiTab` o ad altre pagine provvigioni.
- Nessun ridisegno della dialog: solo i due campi indicati.
