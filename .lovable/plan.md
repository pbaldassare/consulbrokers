
## Richiesta

Per il ruolo **Sede/Ufficio** (Responsabile Ufficio - "Segreteria Consulbrokers" nello screenshot), nascondere dalla sidebar le seguenti voci:

1. **Anagrafiche Utenti** (intera sezione o solo i sottomenù?)
2. **Cruscotto del Giorno** (Contabilità)
3. **Distinta Giornaliera** (Contabilità)
4. **E/C Compagnie** (Contabilità → Estratti Conto)
5. **Estrazioni e Stampe** ("la stampi" → presumo Estrazioni e Stampe nella sidebar root)
6. **Check Primanota** (Contabilità → Primanota)

## Investigazione

Verifico in:
- `src/components/AppSidebar.tsx` — struttura del menu e logica di filtro per ruolo
- Eventuali file `src/routes/contabilita.tsx`, `src/routes/sistema.tsx` per la struttura voci

Per capire:
- Come oggi vengono filtrate le voci per ruolo (probabilmente via `permessi_json` o controllo `userLevel`)
- Se esiste già un meccanismo `hideForRoles` o simili

## Piano

### File toccato
- `src/components/AppSidebar.tsx` — aggiungere logica di hiding condizionale per ruolo `ufficio` sulle 6 voci sopra elencate.

### Approccio
1. Identificare il ruolo corrente (`profile.ruolo === 'ufficio'`).
2. Per ogni voce target, aggiungere condizione che la nasconda quando il ruolo è `ufficio`:
   - **Anagrafiche Utenti** → da chiarire: nascondere SOLO il sottomenu "Gestione Utenti / Privilegi" oppure l'intera sezione "Anagrafiche Utenti"? (Vedi domanda sotto)
   - **Estrazioni e Stampe** (voce root sidebar)
   - **Cruscotto Giornaliero** (Contabilità → submenu)
   - **Distinta Giornaliera** (Contabilità → submenu)
   - **E/C Compagnie** (Contabilità → Estratti Conto → submenu)
   - **Check Primanota** (Contabilità → Primanota → submenu)
3. Mantenere visibili le altre voci per il ruolo Sede.
4. Per `admin` / `executive` tutte le voci restano visibili.

### Note tecniche
- Lo stesso filtro va applicato sia al menu della sidebar che alla `GlobalSearch` se include questi link, per evitare scorciatoie nascoste ma raggiungibili.
- I `RoleGuard` su rotte sono separati: nascondere dalla sidebar NON impedisce l'accesso via URL diretto. Va eventualmente aggiunto/aggiornato il `RoleGuard` sulle relative pagine se vogliamo bloccare anche l'accesso diretto. **Procedo nascondendo solo dalla sidebar** se non specifichi diversamente (modifica meno invasiva).

### Domanda di chiarimento

1. Per **"Anagrafiche Utenti"** vuoi nascondere:
   - **(a)** L'intera sezione (Gestione Utenti, Privilegi, Crea Nuovo Utente, Gestione Uffici) → ufficio non vede nulla
   - **(b)** Solo le voci di gestione (Crea/Privilegi) lasciando visibile la sola lista lettura

   *Procedo con (a) — nasconderò l'intera voce "Anagrafiche Utenti" dalla sidebar dell'ufficio — se non diversamente specificato.*

2. Vuoi che le pagine restino accessibili via URL diretto (solo nascoste dal menu) oppure devo aggiungere un `RoleGuard` che blocca anche l'accesso diretto per il ruolo `ufficio`?

   *Procedo con: solo nascoste dalla sidebar (accessibili via URL se digitato manualmente).*
