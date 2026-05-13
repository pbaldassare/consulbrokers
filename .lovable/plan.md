## Piano

Rinominare ovunque l'etichetta UI **"Consul" → "Produttore"** nel modulo clienti, mantenendo invariato il dato salvato nel DB (ruolo `Produttore Sede`).

### File coinvolti
- `src/components/clienti/NuovoClienteDialog.tsx` — il riquadro "Consul" + placeholder "Seleziona Consul..." → "Produttore" / "Seleziona Produttore...".
- `src/pages/ClientiList.tsx` — l'AccordionTrigger "Consul" → "Produttore".
- `src/pages/ClienteDetail.tsx` — array `ruoliCommerciali`: label `"Consul"` → `"Produttore"` (il `value` resta `"Produttore Sede"`).
- `mem://index.md` (Core) e `mem://ui/terminology-conventions` — aggiornare la regola di terminologia: il ruolo è ora "Produttore" lato UI.

### Nessun cambiamento dati
- Nessuna migrazione DB.
- Nessuna modifica a `codici_commerciali_cliente.ruolo` (resta `Produttore Sede`).
- Il valore selezionato continua a salvarsi come prima e a rileggersi correttamente nella scheda cliente.