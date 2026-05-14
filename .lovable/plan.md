## Restyling modale "Conferma Rimessa & Genera PDF"

Obiettivo: rendere il dialog più curato, coerente col design system (teal/dark petrol) e con il resto dell'app, mantenendo invariata la logica.

### Modifiche UI (solo `ECCompagniaContabPage.tsx`, blocco Dialog righe 620-709)

1. **Larghezza e respiro**
   - `sm:max-w-lg` (più ampio del `md` attuale, meglio per IBAN lunghi).
   - Padding interno coerente (`space-y-5` invece di `space-y-4`).

2. **Header arricchito**
   - Titolo affiancato da icona in pill colorata (bg `primary/10`, icona `primary`).
   - Sotto-titolo come riga riepilogo in card soft (`bg-muted/40 rounded-lg px-3 py-2`) con: nome compagnia (bold), badge "N titoli", importo totale a destra in `text-primary font-semibold`.

3. **Sezione "Bonifico" (mittente + destinazione)**
   - Card `border rounded-lg p-4 bg-card` con label di sezione "Coordinate bonifico".
   - **Conto Consulbrokers**: sostituire il `<select>` nativo con `SearchableSelect` (coerente con resto app); IBAN mittente mostrato come riga `font-mono` con etichetta "IBAN" in `text-muted-foreground`.
   - **IBAN Agenzia**: `Input` in `font-mono`, icona `Building2` a sinistra (input con padding-left).
   - Avvisi (conto mancante / IBAN mancante) come `Alert` shadcn `variant="default"` con icona, non più semplice testo amber.

4. **Sezione "Importi"**
   - Riga a 2 colonne (`grid grid-cols-2 gap-4`):
     - "Importo da rimettere" → valore grande `text-2xl font-bold text-primary`, label sopra in `text-xs uppercase tracking-wide text-muted-foreground`.
     - "Importo da pagare" → Input numerico con suffisso "€" (icona/addon a destra).
   - Avviso pagamento parziale come `Alert` compatto con icona `AlertCircle`.

5. **Note**
   - Textarea con `resize-none` e `rows={3}`, placeholder più descrittivo.

6. **Footer**
   - `Annulla` invariato (`variant="outline"`).
   - CTA primaria full-width su mobile, auto su desktop, con spinner inline durante `isPending` (sostituisce il testo "Generazione...").

### Token / classi
- Tutto via classi Tailwind semantic tokens già esistenti (`bg-card`, `bg-muted/40`, `text-primary`, `border`, `text-muted-foreground`). Nessuna nuova variabile CSS.

### Fuori scopo
- Nessuna modifica a logica, edge function, PDF, schema DB, `StoricoRimessePage`.
- Nessun cambio testi salvo i placeholder.

### File toccati
- `src/pages/contabilita/ECCompagniaContabPage.tsx` (solo blocco JSX del Dialog + eventuale import di `SearchableSelect` e `Alert`).