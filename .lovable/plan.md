## Obiettivo
Ridurre gli errori di inserimento di **Partita IVA** e **Codice Fiscale** introducendo validazione robusta (formato + checksum) riusabile in tutti i form dove vengono inseriti.

## 1. Nuovi helper di validazione (`src/lib/`)

### `src/lib/validatePIVA.ts`
- Funzione `validatePIVA(input)` → `{ valid, error?, normalized? }`.
- Regole:
  - 11 cifre numeriche.
  - Checksum **algoritmo Luhn italiano** (somma cifre dispari + cifre pari ×2 con riporto, modulo 10 = 0).
- Errori distinti: vuoto, lunghezza, caratteri non numerici, checksum errato.

### `src/lib/validateCF.ts`
- Funzione `validateCF(input, opts?)` → `{ valid, error?, normalized?, isPIVAFormat? }`.
- Regole:
  - Persona fisica: 16 caratteri, regex `^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$` + **carattere di controllo** (tabella ufficiale dispari/pari).
  - Azienda: ammette anche 11 cifre (stesse regole della P.IVA via `validatePIVA`) → flag `isPIVAFormat=true`.
- Coerenza con data/sesso opzionale (riusa `parseCF` esistente) solo come warning, non blocca.

### Test (`src/lib/__tests__/validateFiscal.test.ts`)
- Casi validi/non validi noti per CF persona, CF azienda 11 cifre, P.IVA con/senza checksum corretto.

## 2. Componente input riusabile

### `src/components/ui/FiscalCodeInput.tsx` (sottile wrapper su `<Input>`)
- Props: `value`, `onChange`, `kind: "cf16" | "piva" | "cf-azienda"`, `required?`, `onValidChange?(valid)`.
- Comportamento:
  - `onChange` → uppercase + strip spazi, `maxLength` adeguato (16 / 11).
  - `onBlur` → esegue validatore, mostra messaggio inline rosso sotto il campo.
  - Bordo: `border-destructive` se invalido a blur, `border-amber-400` se vuoto required.
  - Tooltip `title` con regola sintetica.
- Espone l'errore via callback per consentire ai form di bloccare il submit.

## 3. Integrazione nei form (solo UI/presentation)

Sostituire gli `<Input>` "raw" + uppercase manuali con `FiscalCodeInput` e bloccare il submit se invalido nei seguenti file:

- `src/components/clienti/NuovoClienteDialog.tsx` — P.IVA, CF, CF azienda.
- `src/pages/ClienteDetail.tsx` — sostituire `isCFValid`/`isPIVAValid` regex-only con i nuovi helper; aggiornare `FieldInput` per CF/P.IVA.
- `src/pages/cliente/ClienteAnagrafica.tsx` — campi readonly: solo badge "valido/non valido".
- `src/pages/ProspectList.tsx` e `src/pages/ProspectDetail.tsx` — P.IVA + CF.
- `src/pages/AnagraficheInternePage.tsx` (Specialist/Produttori interni) — P.IVA + CF.
- `src/pages/AnagraficheCompagniePage.tsx` — P.IVA + CF compagnia.
- `src/components/polizze/ImportNuovaPolizzaAIDialog.tsx` — campi cliente nuovo.

In ciascun form:
- Mantenere l'auto-fill esistente CF11 ↔ P.IVA.
- Submit bloccato + toast con elenco campi invalidi se P.IVA/CF non superano il checksum (avviso, non solo formato).

## 4. Fuori scope
- Nessuna modifica a DB / RLS / edge function.
- Nessun cambio sui flussi business o sui campi obbligatori per tipo soggetto (già definiti in altra memoria).
- Pagine read-only di sola visualizzazione (PDF, liste contabili) restano invariate.

## Dettagli tecnici
- Algoritmo P.IVA: cifre indice 1,3,5,7,9 sommate; indici 2,4,6,8,10 ×2, se >9 sottratto 9; somma totale + 11ª cifra ≡ 0 mod 10.
- Algoritmo CF (carattere controllo): tabelle pari/dispari standard ministeriali; ultima lettera deve coincidere con `mod 26` della somma.
- Tutti gli helper ritornano `normalized` upper/trim per essere salvati senza spazi.
