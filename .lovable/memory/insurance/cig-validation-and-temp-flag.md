---
name: CIG validation and temporary flag
description: Codice CIG validato come 10 caratteri alfanumerici (regex `/^[A-Z0-9]{10}$/`) tramite helper `src/lib/validateCig.ts`. Flag `cig_temporaneo` (boolean, default false) presente su `clienti` e `titoli`: se attivo rilassa la validazione di formato (basta non vuoto). Applicato in `ImmissionePolizzaPage` (titoli.cig_rif + titoli.cig_temporaneo) e `NuovoClienteDialog` (clienti.codice_cig + clienti.cig_temporaneo). ClienteDetail mostra ancora solo l'input legacy (follow-up).
type: feature
---

## Schema
- `clienti.cig_temporaneo boolean NOT NULL DEFAULT false`
- `titoli.cig_temporaneo boolean NOT NULL DEFAULT false`
- Indici parziali: `idx_clienti_cig_temp`, `idx_titoli_cig_temp` (WHERE = true)

## Helper
`src/lib/validateCig.ts`:
- `normalizeCig(v)` → uppercase + strip spazi
- `isValidCig(v)` → `/^[A-Z0-9]{10}$/`
- `isValidCigWithFlag(v, temporaneo)` → se temporaneo: solo non vuoto; altrimenti regex

## UI
- Input CIG con `font-mono`, auto-uppercase, maxLength 10 (40 se temporaneo).
- Checkbox "CIG temporaneo (formato libero)" sotto il campo.
- Errore inline "CIG: 10 caratteri alfanumerici" quando non valido e flag OFF.
- Submit bloccato se CIG presente ma non valido (con flag OFF), oppure se obbligatorio (Ente) e vuoto.
