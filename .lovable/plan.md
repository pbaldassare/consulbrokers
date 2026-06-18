## Modifiche allo Step 2 del Wizard Apertura Sinistro

File: `src/pages/SinistroAperturaWizardPage.tsx`

### 1. Luogo Accadimento — facoltativo
- Rimuovere `.min(1, ...)` da `luogo_sinistro` nello schema zod (diventa `z.string().optional()`).
- Rimuoverlo dall'array `fieldsToValidate` dello step 2.
- Label da `Luogo Accadimento *` a `Luogo Accadimento` (senza asterisco).

### 2. Data Denuncia — default = data apertura (oggi)
- Nei `defaultValues` del form impostare `data_denuncia: new Date().toISOString().slice(0,10)` invece di stringa vuota.
- (La `data_apertura` nel backend già usa `oggi` di default, quindi denuncia = apertura.)

### 3. Tipo Sinistro — supporto tipo personalizzato
Replicare il pattern del componente cliente `NuovaDenunciaSinistroDialog.tsx`:
- Aggiungere campo `tipo_sinistro_personalizzato: z.string().optional()` allo schema.
- Aggiungere checkbox "Tipo non in elenco (personalizzato)" sotto il Select Tipo Sinistro.
- Quando attivo: nascondere il Select e mostrare un `<Input>` per il testo libero (min 3 caratteri).
- Validazione step 2: richiedere `tipo_sinistro` OPPURE `tipo_sinistro_personalizzato` (min 3 char).
- Nel payload invio a `gestione-sinistri` (azione `crea`): inviare `tipo_sinistro: null` + `tipo_sinistro_personalizzato: testo` quando personalizzato, altrimenti come oggi.
- Aggiornare il riepilogo step 5 per mostrare il valore personalizzato (usare `formatTipoSinistro` da `src/lib/tipiSinistro.ts`).

Nessuna modifica a DB, RLS o edge function: i campi `tipo_sinistro_personalizzato` sono già supportati lato server.
