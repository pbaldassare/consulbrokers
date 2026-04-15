

## Piano: Semplificare il modale "Area Riservata"

### Problema attuale
Il pulsante "Attiva Area Riservata" nella TabsList non apre correttamente il modale. Inoltre il pulsante "Modifica" nell'header e la logica "Gestisci" creano confusione.

### Cosa cambia

**1. Rimuovere il pulsante "Modifica" dall'header** (riga 1076) — il pulsante "Modifica" dell'anagrafica resta solo se serve per i campi del cliente, ma NON deve interferire con l'area riservata.

**2. Riscrivere `AreaRiservataHeaderButton`** — semplificato:
- Se area NON attiva: pulsante verde "Attiva Area Riservata" → click apre **un unico Dialog** con:
  - Textarea con email precompilata (dati cliente: nome, email come username, password Consul123!, link portale)
  - Select tipo accesso: Solo Visualizzazione / Attiva
  - Pulsante "Invia e Attiva"
- Se area ATTIVA: badge stato (verde/arancione) + possibilità di cliccare per aprire lo stesso Dialog in modalità gestione (cambia tipo o disattiva)
- Rimuovere la modalità "edit" separata e il pulsante "Gestisci" — tutto in un unico flusso

**3. Assicurarsi che il click apra il Dialog** — il problema attuale è probabilmente che il `DialogTrigger` manca o il `dialogOpen` non viene settato. Verificare che `openActivateDialog()` venga chiamato correttamente dal click del pulsante.

### File coinvolti
- **`src/pages/ClienteDetail.tsx`**: riscrivere `AreaRiservataHeaderButton` — un solo Dialog, email precompilata editabile, select tipo, pulsante invio. Rimuovere complessità "edit mode" / "Gestisci".

