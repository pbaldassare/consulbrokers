# Piano

In `src/pages/ImmissionePolizzaPage.tsx`:

1. **CIG/Rif solo per Enti**
   - Nascondere l'intero blocco "CIG/Rif." (righe ~1277-1290) quando `cigObbligatorio` è `false` (cioè `tipoSoggetto !== "ente"`).
   - Quando nascosto, la riga della grid mostrerà solo "Vincolo": cambiare il wrapper grid in modo che, se non Ente, "Vincolo" occupi tutta la larghezza (oppure mantenere `grid-cols-2` con il solo Vincolo su una colonna — preferito: condizionare le colonne).
   - Lasciare invariata la logica di obbligatorietà esistente per gli Enti (asterisco, bordo, blocco salvataggio).

2. **N° Polizza obbligatorio (per tutti)**
   - Aggiungere asterisco rosso `*` nel Label "N° Polizza" (riga 1254).
   - Bordo destructive sull'`Input` quando `!numeroPolizza.trim()`.
   - Estendere `saveBlockReason` (righe 395-401) aggiungendo un controllo: se `!numeroPolizza.trim()` → "Il N° Polizza è obbligatorio". Inserirlo subito dopo il check del Gruppo Finanziario per coerenza con gli altri messaggi.
   - Nessuna modifica al backend / schema DB: il campo è già persistito; cambia solo la validazione client-side.

3. **Nessun altro cambiamento**
   - Niente refactor del resto della sezione Contratto.
   - Nessun cambiamento ai test esistenti (riguardano l'import AI, non questa pagina).

## Dettagli tecnici
- File toccato: `src/pages/ImmissionePolizzaPage.tsx` (solo presentation + validazione blocco salvataggio già esistente).
- Stato `tipoSoggetto` e `cigObbligatorio` già disponibili: nessun nuovo hook.
- Coerenza UX: stesso stile (border-destructive + testo `text-[10px] text-destructive`) usato già per CIG.
