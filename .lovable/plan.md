## Obiettivo
Migliorare il dialog "Importa polizza da PDF (AI)" con: progress + log live, multi-match selezionabile per cliente/compagnia/ramo, editing inline dei campi estratti, riepilogo finale prima dell'apply, e — quando il cliente non esiste — flusso obbligato che apre `NuovoClienteDialog` pre-compilato con i campi obbligatori bloccanti, prima di poter applicare la polizza.

## Modifiche

### 1. `src/components/polizze/ImportNuovaPolizzaAIDialog.tsx` (refactor principale)

**Stati nuovi**
- `step`: `"upload" | "parsing" | "review" | "summary"`
- `progress`: 0–100, `progressLabel`: stringa
- `logs`: `{ts, level, msg}[]` con auto-scroll
- `data`: `ParsedPolizzaData` editabile (form controllato copiato dal risultato AI)
- `clienteCandidates`, `compagniaCandidates`, `ramoCandidates` (top 5 ciascuno) + relativi `selectedId`
- `manualNewCliente: boolean` (forza creazione anche se candidati esistenti)

**Progress + Log**
- Componente `<Progress />` (shadcn) sopra il drop-zone durante parsing.
- Pannello scrollabile con righe colorate (info/success/warn/error), aggiornato in fasi:
  1. "Lettura file…" (10%)
  2. "Conversione base64…" (25%)
  3. "Invio a Gemini…" (40%)
  4. "Estrazione dati…" (70%) — al ritorno
  5. "Ricerca cliente in DB…" (80%)
  6. "Ricerca compagnia…" (88%)
  7. "Ricerca ramo…" (95%)
  8. "Completato" (100%)
- Errori catturati come riga log + toast.

**Multi-match (lookup esteso)**
- `lookupMatches` rivisto: ritorna array `candidates` per ognuno (limit 5):
  - Cliente: query con `or(cf.eq, piva.eq)` esatta + fallback `ilike` su ragione_sociale/cognome usando token nome.
  - Compagnia: `ilike` su `nome` e `gruppo_compagnia` (più token), score per match parola intera.
  - Ramo: tokenizzato come oggi ma top 5 con join a `gruppi_ramo` (mostro `gruppo - ramo`).
- UI: `SearchableSelect` per ciascuno (con "Crea nuovo cliente" come opzione speciale per il cliente).

**Editing inline (step "review")**
- Tutti i `<Field>` read-only diventano `<Input>`/`<Select>`/`<Switch>` controllati su `data`.
- Sezioni: Cliente (anagrafica + indirizzo), Compagnia & Ramo (con i select multi-match), Periodo (date + frazionamento + tacito), Premi (Firma + Quietanza, numerici), Garanzie (lista editabile descrizione/massimale/premio, con "Rimuovi").
- Bottone "Ricalcola lordo" che somma netto+imposte+accessori per Firma e Quietanza.

**Step "summary" (riepilogo)**
- Vista compatta read-only con tutti i dati finalizzati, badge match per ogni entità (✓ esistente / ➕ nuovo / ⚠ da scegliere).
- Conferma con bottone "Applica al form".
- Se cliente = "nuovo" → bottone primario diventa "Crea cliente e applica" (vedi punto 3).

**Footer dinamico**
- step upload: solo "Annulla"
- step review: "Indietro", "Riepilogo →"
- step summary: "Indietro", "Applica" / "Crea cliente e applica"

### 2. `src/components/clienti/NuovoClienteDialog.tsx` (estensione minima)

- Aggiungere prop opzionale `initialData?: Partial<{...campi...}>` e `controlledOpen?`/`onOpenChange?` per pilotarlo dall'esterno.
- In `useEffect`, quando `open` passa a true e `initialData` fornito, popolare gli stati pertinenti (nome/cognome/CF, ragione_sociale/PIVA, indirizzo+CAP+città+provincia, email/telefono).
- Inferire `tipoCliente`: "azienda" se PIVA presente o CF di 11 cifre, altrimenti "privato".
- **Nessun cambio alle validazioni esistenti**: `gruppo_finanziario_id` resta obbligatorio (l'utente lo deve scegliere), CF 16 char per privato, CUP per ente. Questa è già la garanzia richiesta dall'utente sui campi obbligatori — il salvataggio non parte se mancano.
- Aggiungere chiaramente l'asterisco "*" a label dei campi obbligatori già esistenti (Gruppo Finanziario, e per ente Codice CUP) per visibilità.

### 3. `src/pages/ImmissionePolizzaPage.tsx` (integrazione)

- `handleAIImportApply(m: MatchResult)` esteso:
  - Se `m.cliente?.id` esiste → applica come oggi e chiude.
  - Se `m.cliente == null` (utente ha scelto "nuovo cliente") → invece di applicare subito, salva `m` in `pendingImport` state, apre `NuovoClienteDialog` con `initialData` derivato da `m.data.contraente_*`. Al callback `onCreated(clienteId, label)` setta `selectedClienteId = clienteId` e procede ad applicare il resto del payload (compagnia/ramo/premi/date).
  - Toast finale "Polizza pre-compilata".
- Il bottone "Applica al form" del dialog AI resta bloccato (disabled) se l'utente in step summary non ha scelto un cliente esistente né "nuovo cliente".

## Dettagli tecnici

**Tipi nuovi**
```ts
type Candidate<T> = T & { score?: number };
type MatchState = {
  data: ParsedPolizzaData;                  // editabile
  clienteCandidates: { id; label; cf?; piva? }[];
  selectedClienteId: string | "__new__" | "";
  compagniaCandidates: { id; label }[];
  selectedCompagniaId: string;
  ramoCandidates: { gruppoRamoId; ramoId; label }[];
  selectedRamoKey: string;                  // `${gruppoRamoId}:${ramoId}`
};
```

**MatchResult passato a `onApply`** (retrocompatibile)
```ts
{ data, cliente: selectedClienteId !== "__new__" ? {id, label} : null,
  compagnia: ..., ramo: ... }
```

**Helper per logging**
```ts
const log = (level, msg) => setLogs(l => [...l, {ts: Date.now(), level, msg}]);
```

**Nessuna modifica a `parse-polizza-completa` edge function** (interfaccia invariata).

## Out of scope
- Nessuna modifica allo schema DB.
- Nessuna modifica al modello AI o al prompt.
- Nessuna validazione extra lato server (RLS già in vigore).
- Persistenza del file PDF allegato (non richiesta).
