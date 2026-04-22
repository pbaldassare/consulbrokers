

## Fix Specialist — usare `"Backoffice"` (B maiuscola)

### Causa

Il trigger DB `validate_codici_commerciali_ruolo` accetta `'Backoffice'` (B maiuscola). Tutti i 544 record esistenti — inclusi quelli importati dall'Excel di Napoli con GUARRACINO/SCARPELLI — sono salvati come `'Backoffice'`. Il codice nuovo invece usa `'backoffice'` minuscolo, quindi:
- la SELECT su `ruolo='backoffice'` ritorna sempre `[]` → il select Specialist sembra vuoto anche quando il dato c'è;
- l'UPSERT con `ruolo='backoffice'` viene respinta dal trigger con errore 400 `"Invalid ruolo: backoffice"` → impossibile selezionare/cambiare lo Specialist.

### Cosa cambia in `src/pages/ClienteDetail.tsx`

Sostituire le 3 occorrenze di `"backoffice"` riferite alla colonna `codici_commerciali_cliente.ruolo` con `"Backoffice"`:

1. Query `["specialist_cliente", id]` (riga ~1138): `.eq("ruolo", "Backoffice")`.
2. Mutation `upsertSpecialistMutation` — branch DELETE (riga ~1168): `.eq("ruolo", "Backoffice")`.
3. Mutation `upsertSpecialistMutation` — branch UPSERT (riga ~1174): payload `{ cliente_id: id, ruolo: "Backoffice", profilo_id }`.

Le query React Query restano con la chiave `["specialist_cliente", id]` (key invariata).

### Cosa NON tocco

- Trigger DB e dati esistenti (sono già corretti — il bug è solo nel codice nuovo).
- Componente `CodiciCommercialiSection` / `CodiceCommercialeRow` (già usa la mappatura corretta `backoffice → Specialist` con i valori giusti).
- Etichetta UI mostrata (`"Specialist"`) e label dropdown (`"Backoffice" → "Specialist"`) — invariate.
- `requiredFieldsList`, validazione, sync con pannello "Codici Commerciali (Rete)".

### Verifica

1. Apro ABBATE ANDREA → il select "Specialist" nella card in alto si pre-popola con il profilo importato dall'Excel (riga `Backoffice` esistente).
2. Cambio Specialist dal select in alto → toast "Specialist aggiornato", nessun errore 400, la riga "Specialist" nel pannello "Codici Commerciali (Rete)" mostra subito lo stesso profilo.
3. Apro un cliente senza riga Backoffice → bordo rosso + counter obbligatori + Salva bloccato. Selezionando uno Specialist la riga viene creata correttamente.
4. Cambio lo Specialist dal pannello "Codici Commerciali (Rete)" → la card in alto si aggiorna live.

