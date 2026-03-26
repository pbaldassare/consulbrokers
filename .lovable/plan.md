

## Piano: Aggiungere dati Sede ai Template Email

### Intervento

Aggiungere nuove variabili placeholder per la sede (ufficio) con tutti i dati disponibili dalla tabella `uffici`: indirizzo, email, telefono, codice ufficio.

### Modifiche a `src/pages/TemplatePage.tsx`

**1. Nuove variabili placeholder**

Aggiungere a `PLACEHOLDER_VARS`:
- `{{sede_indirizzo}}` — uffici.indirizzo
- `{{sede_email}}` — uffici.email
- `{{sede_telefono}}` — uffici.telefono
- `{{sede_codice}}` — uffici.codice_ufficio

**2. Dati di esempio**

Aggiungere a `EXAMPLE_DATA` valori di esempio per le nuove variabili.

**3. Query polizza**

La query su `titoli` gia fa join su `uffici(nome_ufficio)` — estendere per includere anche `indirizzo, email, telefono, codice_ufficio`.

**4. PolizzaResult interface**

Aggiungere i nuovi campi: `sede_indirizzo`, `sede_email`, `sede_telefono`, `sede_codice`.

**5. buildDataMap**

Popolare le nuove variabili dai dati della polizza selezionata.

### Nessuna modifica al DB

Tutto lato frontend, i campi esistono gia nella tabella `uffici`.

