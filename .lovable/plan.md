## Rendere visibile il bottone "Esegui" su ogni riga

### Problema
Il bottone che apre il dialog di creazione (Appendice, Storno, …) è nell'**ultima** delle 11 colonne della tabella, che esce dallo schermo per overflow orizzontale. Sembra che la pagina sia "ferma" mentre in realtà il CTA è fuori vista a destra.

### Modifiche (solo UI, file unico)

`src/pages/GestionePolizzePage.tsx`:

1. **Sticky-right** sulla colonna Azione (header + celle):
   - `className="sticky right-0 bg-background z-10 border-l shadow-[-4px_0_8px_-6px_rgba(0,0,0,0.15)]"`
   - Riga pari/dispari: usare `bg-background` / `bg-muted/30` coerente con la riga.
2. **CTA più visibile**: bottone con label dinamica `"Crea {label}"` (es. "Crea Appendice", "Avvia Storno", "Genera Rinnovo"), variante primary (verde teal del brand), icona + testo, `data-tour="esegui-riga"`.
3. **Hint sopra la tabella**: nella card "3. Risultati — {op}" aggiungere un sottotesto: *"Clicca **{Esegui label}** sulla riga della polizza per aprire il dialog e salvare l'operazione."*
4. **Header colonna**: rinominare la 11ª colonna da "Azione" implicita a un'intestazione esplicita `"Azione"` (oggi è vuota) per chiarezza.
5. Mantenere `overflow-x-auto` sul wrapper della Table; lo sticky cell tiene il CTA sempre a vista.

Niente cambi di logica, niente DB, niente nuovi file. È un fix di **discoverability** del CTA esistente.
