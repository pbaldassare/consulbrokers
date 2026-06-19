## Espansione righe in Elenco Posizioni Assicurative (portale cliente)

Nella pagina `/cliente/polizze` (`src/pages/cliente/ClientePolizze.tsx`) aggiungo la possibilità di espandere ogni riga della tabella per vedere il dettaglio della polizza, in coerenza col comportamento già presente lato admin.

### Modifiche
1. **Colonna chevron**: aggiungo una colonna iniziale con icona `ChevronRight`/`ChevronDown` su ogni riga.
2. **Stato locale**: `expandedId: string | null` (una riga espansa per volta) gestito con `useState`.
3. **Toggle**: click sulla riga → espande/comprime; rimuovo la navigazione automatica al detail dal click di riga e la sposto su un pulsante "Apri dettaglio" dentro il pannello espanso (così il click non confligge con l'espansione).
4. **Pannello espanso**: `<TableRow>` aggiuntiva con `colSpan` totale che mostra in griglia 2-3 colonne:
   - Decorrenza, Scadenza, Periodicità
   - Compagnia, Produttore, Ramo
   - Numero polizza, Targa/Telaio, CIG
   - Premio imponibile, Premio lordo
   - Pulsante "Apri dettaglio polizza" → `navigate(t._detailPath)`
5. **Styling**: sfondo `bg-teal-50/40`, padding, tipografia coerente con il resto della pagina (teal-700 per i label).

### Fuori scope
- Nessuna modifica a query, dati o lato admin.
- Nessun cambio alla card filtri o agli export CSV/Excel.
