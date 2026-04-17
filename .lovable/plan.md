

## Problema

L'utente apre "Modifica Sede" sull'**Ufficio di Napoli** e i dati non si salvano. Causa root:

1. **`codice_ufficio` è NULL in DB** per Napoli (storico — vedi memoria `napoli-branch-setup`).
2. In `openEditDialog` (riga 113-120) `formData.codice_ufficio` viene impostato a `u.codice_ufficio` che è `null` → l'`Input` riceve `value={null}` (warning React) e soprattutto `handleSave` fa `formData.codice_ufficio.trim()` → **TypeError: Cannot read properties of null (reading 'trim')** (errore runtime confermato).
3. Anche se fixiamo il trim, il form richiede comunque codice: l'utente vede campo vuoto ma poi salva senza accorgersi.

## Fix

**File: `src/pages/GestioneUfficiPage.tsx`**

1. **Coerce a stringa in `openEditDialog`**: `codice_ufficio: u.codice_ufficio || ""` (analogo a quanto già fatto per indirizzo/email/telefono).
2. **Guard difensivo in `handleSave`**: usare `(formData.codice_ufficio || "").trim()` e idem per `nome_ufficio`, così non esplode mai.
3. **Pre-popolare codice di default per Napoli**: se vuoto, suggerisco "NAP" come placeholder visivo (l'utente decide se accettarlo). Niente UPDATE silenzioso al DB.

**Bonus**: in `Input` value forzo sempre stringa (`value={formData.codice_ufficio ?? ""}`) per evitare il warning React.

Nessuna modifica DB necessaria — l'utente potrà ora aprire la modale, vedere il codice vuoto, inserirlo e salvare correttamente.

### File coinvolti
- ✏️ `src/pages/GestioneUfficiPage.tsx` — fix null handling in `openEditDialog`, `handleSave` e `Input value`

