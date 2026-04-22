

## Specialist nella card "Assegnazioni Gestionali" — 3 colonne

### Cosa cambia in `src/pages/ClienteDetail.tsx`

1. **Card "Assegnazioni Gestionali"** → grid da 2 a **3 colonne** (`md:grid-cols-3`, 1 su mobile):
   - **Sede *** (`ufficio_id`) — invariato
   - **Gruppo Finanziario *** (`gruppo_finanziario_id`) — invariato
   - **Specialist *** — nuovo `SearchableSelect` accanto agli altri due, **stessa identica fonte dati** già usata da `CodiciCommercialiSection`:
     - Carico la lista profili dentro `ClienteDetail` con la stessa query `["profili_commerciali"]` (filtrata su `ruolo backoffice` per lo Specialist, `attivo=true`, ordinata per cognome).
     - Valore corrente letto da `specialistRow.profilo_id` (query `["specialist_cliente", id]` già esistente).
     - Bordo rosso `border-destructive` + hint "Campo obbligatorio" quando `!specialistAssigned` (logica `isFieldMissing("specialist_id")` già presente in `requiredFieldsList`).

2. **Mutation `upsertSpecialistMutation`** dedicata:
   - `supabase.from("codici_commerciali_cliente").upsert({ cliente_id: id, ruolo: "backoffice", profilo_id }, { onConflict: "cliente_id,ruolo" })`.
   - `onSuccess`: invalida `["specialist_cliente", id]` **e** `["codici_commerciali", id]` → la riga "Specialist" nel pannello "Codici Commerciali (Rete)" si aggiorna istantaneamente, e viceversa quando l'utente la modifica da lì.
   - Toast "Specialist aggiornato".

3. **Testo informativo** sotto la card: rimuovo "Specialist obbligatorio, si gestisce in 'Codici Commerciali (Rete)'" e lo sostituisco con: "I dettagli del codice commerciale (mandato, % provvigione, brand, date) si gestiscono in 'Codici Commerciali (Rete)'."

4. **Nessuna modifica** all'edge function `import-clienti`: la colonna `specialist` dell'Excel viene già mappata correttamente su `codici_commerciali_cliente` con `ruolo='backoffice'` (quindi GUARRACINO GAETANO, SCARPELLI PAOLA ecc. vengono già caricati). La nuova UI legge da quella stessa tabella, quindi tutto lo storico esistente compare subito senza re-import.

### Cosa NON tocco

- DB / RLS / edge functions.
- Pannello "Codici Commerciali (Rete)" (resta integro per editing avanzato di % provvigione, mandato, brand, ecc.).
- `requiredFieldsList`, `specialistAssigned`, validazione email/Sede/Gruppo Finanziario (già pronti).

### Verifica

1. Apro un cliente con Specialist già assegnato (es. quello che ha GUARRACINO o SCARPELLI in colonna `specialist`) → la card in alto mostra **3 colonne** Sede | Gruppo Finanziario | Specialist e Specialist è **pre-popolato** con il profilo importato dall'Excel.
2. Apro un cliente senza Specialist → bordo rosso sul select Specialist + hint "Campo obbligatorio" + counter "Compila i campi obbligatori (N)" lo include + Salva bloccato.
3. Seleziono uno Specialist dalla card in alto → toast "Specialist aggiornato", scendo nel pannello "Codici Commerciali (Rete)" → la riga Specialist mostra lo stesso profilo.
4. Cambio Specialist dal pannello "Codici Commerciali (Rete)" → la card in alto si aggiorna live (stessa query invalidata).
5. Su mobile (< 768px) le 3 colonne si impilano verticalmente.

