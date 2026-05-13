## Obiettivo
Rendere la "Sede di riferimento" un campo obbligatorio in fase di creazione cliente (per tutti i tipi: privato, azienda, ente) e garantirne il salvataggio.

## Stato attuale
- Il dialog `NuovoClienteDialog.tsx` ha già il campo "Sede / Ufficio" (`ufficioClienteId`) salvato in `clienti.ufficio_id` (riga 469).
- Auto-compilazione dallo Specialist selezionato (righe 366-379) — resta invariata, modificabile.
- Validazione obbligatoria della Sede oggi è presente SOLO per tipo cliente "privato" (riga 418). Per azienda/ente non è bloccante.

## Modifica
**File:** `src/components/clienti/NuovoClienteDialog.tsx`

1. In `getMissingFields()` spostare il check `if (!ufficioClienteId) missing.push("Sede")` fuori dal ramo "privato" così è obbligatorio per tutti i tipi cliente.
2. Aggiungere asterisco visivo "*" all'etichetta `Sede / Ufficio` nel blocco Sede (riga 990) per segnalare l'obbligatorietà.

## Fuori scope
- Nessuna modifica DB/RLS: `clienti.ufficio_id` esiste già e viene scritto.
- Nessuna modifica al dettaglio cliente o alla lista.
- Nessun cambio alla logica di auto-fill dallo Specialist.
