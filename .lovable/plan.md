## Obiettivo

Quando si seleziona una **Sede** (es. "Ufficio di Napoli") nella pagina `/portafoglio/doc-precontrattuale`, devono essere ripresi automaticamente dal DB tutti i dati della sede (indirizzo, CAP, città, provincia, **email** e **telefono**) e questi dati devono comparire nel PDF della precontrattuale insieme agli altri.

## Stato attuale

- La query `ufficiList` in `src/pages/DocPrecontrattualePage.tsx` (riga 144) seleziona solo `id, nome_ufficio, indirizzo, cap, citta, provincia` → **mancano `email` e `telefono`**.
- `applySede` popola Indirizzo/CAP/Città/Prov ma **non** popola E-mail e Tel della sezione RUI.
- Il PDF (`src/lib/precontrattuale-pdf.ts`) mostra `specialistIndirizzo` come singola stringa concatenata: la sede non è valorizzata in modo distinto.
- Sede "Ufficio di Napoli" sul DB ha `email = segreteria@consulbrokers`, telefono nullo. Sede "San Donà" ha telefono `0421 307800`.

## Modifiche

### 1. `src/pages/DocPrecontrattualePage.tsx`

- Estendere la `select` di `ufficiList` aggiungendo `email, telefono`.
- In `applySede`:
  - popolare `indirizzoRui / capRui / cittaRui / provinciaRui` dai campi strutturati della sede (già fatto), con fallback al parser legacy.
  - **Sovrascrivere sempre** `emailRui` e `telRui` con quelli della sede selezionata se presenti (la sede è la fonte ufficiale per il documento precontrattuale). Se la sede non li ha, mantenere quelli attuali.
- In `composeIndirizzoSede`: già ok, viene riusato.
- Passare al PDF tre nuovi campi dedicati alla **Sede Operativa**: `sedeNome`, `sedeIndirizzo` (già composto), `sedeEmail`, `sedeTelefono`.

### 2. `src/lib/precontrattuale-pdf.ts`

- Aggiungere a `PrecontrattualeData` i campi opzionali:
  ```ts
  sedeNome?: string;
  sedeIndirizzoCompleto?: string;
  sedeEmail?: string;
  sedeTelefono?: string;
  ```
- Nel blocco MUP "INTERMEDIARIO CHE ENTRA IN CONTATTO CON IL CLIENTE" (intorno a riga 377), dopo la riga `Indirizzo: …`, aggiungere un blocco "Sede Operativa":
  ```
  Sede Operativa: {sedeNome}
  Indirizzo: {sedeIndirizzoCompleto}
  Telefono: {sedeTelefono}   e-mail: {sedeEmail}
  ```
  mostrato solo se `sedeNome` è presente.

### 3. `public/version.json`

Bump versione per forzare reload.

## Risultato atteso

- Selezionando "Ufficio di Napoli" → CAP `80122`, Città `Napoli`, Prov `NA`, Indirizzo `Via Mergellina, 2`, E-mail `segreteria@consulbrokers` (già visibile nello screenshot per Indirizzo/CAP/Città/Prov; ora anche e-mail/telefono).
- Nel PDF precontrattuale generato comparirà un blocco "Sede Operativa" con nome sede, indirizzo completo, telefono e e-mail, oltre ai dati già presenti dello Specialist e di Consulbrokers.

## File modificati

- `src/pages/DocPrecontrattualePage.tsx`
- `src/lib/precontrattuale-pdf.ts`
- `public/version.json`