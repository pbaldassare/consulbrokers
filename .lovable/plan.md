## Problemi rilevati

### 1. Account Executive "Tallina Iole" non trovata
A DB esiste correttamente (`tipo='account_executive'`, `attivo=true`), ma ha `ragione_sociale='232323'`. L'hook `useAccountExecutivesLookup` (e `useProduttoriLookup`) costruisce la label dando **priorità a `ragione_sociale`** se valorizzata, quindi mostra "232323" invece di "Tallina Iole" → la ricerca per "tallina" non matcha.

### 2. CIG senza validazione + nessun flag "temporaneo"
Il campo CIG/Rif. (su polizza, `titoli.cig_rif`) e Codice CIG (su cliente, `clienti.codice_cig`) accettano qualsiasi testo. Va imposto: **10 caratteri alfanumerici**. Inoltre serve un flag "CIG temporaneo" (default OFF) salvato in DB per filtri futuri.

---

## Piano

### A. Fix label AE/Produttore (priorità a nome persona)
In `src/hooks/useAccountExecutivesLookup.ts` e `src/hooks/useProduttoriLookup.ts` invertire la logica:
```
label = (cognome+nome).trim() || ragione_sociale.trim() || sigla || codice || "—"
```
Così Tallina Iole appare sempre con nome/cognome, anche se qualcuno ha riempito ragione_sociale per errore.

### B. Validazione CIG (10 alfanumerici)
Nuovo helper `src/lib/validateCig.ts`:
- `isValidCig(value: string): boolean` → regex `/^[A-Z0-9]{10}$/` (auto-uppercase, no spazi).
- Esportato per riuso.

Applicato in:
- **`ImmissionePolizzaPage.tsx`** (campo CIG/Rif.): auto-uppercase on change, errore inline "CIG: 10 caratteri alfanumerici" se non valido **e** flag temporaneo è OFF. Blocco submit quando obbligatorio (Ente) e non valido.
- **`NuovoClienteDialog.tsx`** (Codice CIG per Ente): stesso pattern.
- **`ClienteDetail.tsx`** (tab anagrafica, campo `codice_cig`): stesso pattern.

Se `cig_temporaneo = true`, la validazione di formato viene **rilassata** (solo non vuoto), perché i CIG temporanei/SmartCIG possono avere formato diverso in fase di assegnazione.

### C. Flag "CIG temporaneo" persistito
Migration DB:
- `ALTER TABLE clienti ADD COLUMN cig_temporaneo boolean NOT NULL DEFAULT false;`
- `ALTER TABLE titoli ADD COLUMN cig_temporaneo boolean NOT NULL DEFAULT false;`
- Indici parziali leggeri per i filtri:
  - `CREATE INDEX idx_clienti_cig_temp ON clienti(cig_temporaneo) WHERE cig_temporaneo = true;`
  - `CREATE INDEX idx_titoli_cig_temp ON titoli(cig_temporaneo) WHERE cig_temporaneo = true;`

UI:
- Checkbox **"CIG temporaneo"** accanto al campo CIG in:
  - `ImmissionePolizzaPage` (salva su `titoli.cig_temporaneo`)
  - `NuovoClienteDialog` (salva su `clienti.cig_temporaneo`)
  - `ClienteDetail` tab anagrafica (salva su `clienti.cig_temporaneo`)
- Default deflaggato. Quando flaggato, mostra hint "Validazione formato disattivata".

### D. Memory
Aggiornare `mem://insurance/gruppi-finanziari-tipo-soggetto.md` con la regola CIG (10 alfanumerici + flag temporaneo) e creare `mem://insurance/cig-validation-and-temp-flag.md` con la regola di validazione e il flag.

---

## File toccati
- `src/hooks/useAccountExecutivesLookup.ts`
- `src/hooks/useProduttoriLookup.ts`
- `src/lib/validateCig.ts` (nuovo)
- `src/components/clienti/NuovoClienteDialog.tsx`
- `src/pages/ClienteDetail.tsx`
- `src/pages/ImmissionePolizzaPage.tsx`
- Migration Supabase per le due colonne `cig_temporaneo`
- Memory files

## Note / Out of scope
- Non rinomino "232323" su Tallina: è dato esistente; resta visibile solo se vuoi pulirlo nelle anagrafiche professionali.
- I filtri reali su `cig_temporaneo` (es. in liste polizze/clienti) sono fuori scope: aggiungo solo persistenza + indice.