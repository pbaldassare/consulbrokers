

## Piano: Spostare "Area Riservata" accanto al tab Anagrafica

### Cosa cambia

1. **Rimuovere `AreaRiservataHeaderButton` dall'header** (riga 1054) — non più accanto al badge Attivo/Disattivo

2. **Aggiungere il pulsante "Area Riservata" accanto al tab Anagrafica** nella `TabsList` (riga 1075):
   - Un pulsante separato (non un TabTrigger) posizionato dopo "Anagrafica"
   - Se area non attiva: pulsante "Attiva Area Riservata" (verde)
   - Se area attiva: badge con stato + pulsante "Gestisci"

3. **Semplificare il Dialog**:
   - Mostra l'anteprima email **editabile** (textarea con HTML di default, personalizzabile)
   - Select con due opzioni: "Solo Visualizzazione" / "Attiva" (caricamento dati)
   - Pulsante "Invia e Attiva"
   - Rimuovere la parte "Gestisci" complessa — solo attiva/disattiva e cambia tipo

4. **Badge area riservata** visibile nella TabsList accanto al pulsante

### Layout risultante TabsList

```text
Polizze | Sinistri | Aziende | Documenti | Chat | Timeline | Trattative | Anagrafica | [🟢 Area Riservata Attiva] oppure [Attiva Area Riservata]
```

### File coinvolti
- **`src/pages/ClienteDetail.tsx`**: spostare il trigger del pulsante dalla riga 1054 nella TabsList, semplificare il dialog con email editabile in textarea

