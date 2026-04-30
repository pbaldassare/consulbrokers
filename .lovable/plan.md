## Obiettivo

Aggiungere un pulsante **"Genera Precontrattuale"** nell'header della scheda cliente, accanto al pulsante **Modifica/Anagrafica**, che apre la pagina `/doc-precontrattuale` con tutti i campi disponibili pre-compilati dal database (cliente + Specialist assegnato + Sede), lasciando vuota la parte polizza.

## Mappatura dati (sostituzione campi statici → DB)

**Sezione "Contratto Intermediato"** — dal cliente (`clienti` row corrente):
- Cliente (codice) → `codice_fiscale` o `partita_iva`
- Indirizzo / CAP / Città / Provincia → `indirizzo_residenza` / `cap_residenza` / `citta_residenza` / `provincia_residenza` (se privato) oppure `indirizzo_sede` / `cap_sede` / `citta_sede` / `provincia_sede` (se azienda/ente)
- Codice Fiscale, Partita IVA → omonimi
- Polizza / Appendice / Riferimento / Compagnia / Gruppo / Ramo → **vuoti** (come richiesto)

**Sezione "Intermediario Iscritto al RUI"** — combinazione **Specialist + Sede**:
- *Dallo Specialist* (`profiles` via `clienti_assegnazioni.profilo_id` con `ruolo='backoffice'`):
  - Nome e Cognome RUI → `nome` + `cognome`
  - Sezione / Numero / Data iscrizione RUI → `sezione_rui` / `numero_rui` / `iscrizione_rui` (campi presenti in `profiles`; verifico in implementazione e fallback su `anagrafiche_professionali` se mancano)
  - Email / Telefono → personali dello Specialist
- *Dalla Sede* (`uffici` via `cliente.ufficio_id`):
  - Indirizzo / CAP / Città / Provincia → `indirizzo` parsato (la tabella `uffici` ha solo `indirizzo` testuale → split su virgole) oppure i campi separati se presenti
  - "Intermediario" (label dropdown) → `nome_ufficio`
  - "Sede" (dropdown sotto) → resta `nome_ufficio`
- "In qualità di" → default invariato ("Ditta individuale"), modificabile

Tutti i campi pre-compilati restano **editabili** dall'utente prima di confermare.

## Modifiche

### 1. `src/pages/ClienteDetail.tsx`
- Aggiungere accanto al pulsante "Modifica/Salva" (riga ~1500) un nuovo pulsante:
  ```tsx
  <Button variant="outline" size="sm" onClick={() => navigate(`/doc-precontrattuale?clienteId=${id}`)}>
    <FileText className="w-4 h-4 mr-1" /> Genera Precontrattuale
  </Button>
  ```
- Visibile sia in modalità lettura sia in modalità edit (lo metto fuori dal blocco `editMode ? : ` o lo duplico).

### 2. `src/pages/DocPrecontrattualePage.tsx`
- Leggere `clienteId` da `useSearchParams`.
- Se presente, eseguire una nuova query che fa join:
  - `clienti` (campi anagrafici + `ufficio_id`)
  - `clienti_assegnazioni` → `profiles` (Specialist con `ruolo IN ('backoffice','admin')`)
  - `uffici` (Sede)
- Nel `useEffect` su quei dati, popolare gli `useState` esistenti:
  - sezione cliente (CF/PIVA/indirizzo/CAP/città/provincia/nazione)
  - sezione RUI: nome+cognome dello Specialist, sezione/numero/data RUI, indirizzo/CAP/città/provincia presi dalla **Sede**, email/telefono dello Specialist
  - "Intermediario" e "Sede" dropdown → impostare opzione corrispondente al `nome_ufficio` della Sede
- Mantenere vuoti: Polizza, Appendice, Riferimento, Compagnia, Gruppo, Ramo.
- Dropdown "Intermediario" attualmente lista AE: aggiungere come opzione preselezionata "Specialist: {nome cognome}" + opzioni AE esistenti, così l'utente può comunque cambiare.

### 3. `public/version.json`
- Bump versione.

## Note tecniche

- `uffici.indirizzo` è una stringa unica → uso una helper che fa `split(",")` per ricavare via/CAP/città/provincia, con fallback graceful (se il parse fallisce, lascio tutto in `indirizzoRui` e svuoto gli altri).
- Lo Specialist viene preso da `clienti_assegnazioni` (stessa query già usata in `ClienteDetail.tsx` riga 1124 `specialist_cliente`).
- Se i campi RUI non sono presenti su `profiles` per lo Specialist, fallback su `anagrafiche_professionali` cercando per `profilo_id`.
- Nessuna migration, nessun cambio schema.
- Nessun nuovo edge function: il "genera" finale resta come è oggi (la pagina ha già il bottone Conferma + sezioni I-IV).

## File toccati

- `src/pages/ClienteDetail.tsx` (1 pulsante nell'header)
- `src/pages/DocPrecontrattualePage.tsx` (lettura `clienteId`, query, prefill)
- `public/version.json`
