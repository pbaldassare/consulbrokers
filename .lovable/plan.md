

## Piano: Pulsante "Converti in Cliente" nel Dettaglio Prospect

### Concetto

Prospect e Cliente sono due entita separate. Quando un prospect viene "chiuso vinto", deve poter essere convertito in un record nella tabella `clienti`. Il pulsante copia i dati anagrafici dal prospect, crea il cliente, segna il prospect come convertito e reindirizza alla scheda cliente.

### Interventi

**1. Migration SQL — campo `convertito_cliente_id` su prospect**
- Aggiungere colonna `convertito_cliente_id uuid REFERENCES clienti(id)` alla tabella `prospect`
- Quando valorizzato, indica che il prospect e stato convertito e punta al cliente creato

**2. ProspectDetail.tsx — Pulsante "Converti in Cliente"**
- Aggiungere un bottone visibile solo se `prospect.stato === "chiuso_vinto"` e `convertito_cliente_id` e null
- Se gia convertito, mostrare un Badge/link "Convertito → Vai al Cliente"
- Al click: dialog di conferma con riepilogo dati che verranno copiati
- La mutation:
  1. INSERT in `clienti` con tipo_cliente = "privato", mappando nome, cognome, email, telefono, note, ufficio_id dal prospect
  2. UPDATE prospect con `convertito_cliente_id = nuovo_cliente.id`
  3. Log attivita "conversione_prospect_cliente"
  4. Toast di successo + navigazione a `/archivi/clienti/:id`

**3. ProspectList.tsx — Indicatore visivo**
- Nella lista, se il prospect ha `convertito_cliente_id` valorizzato, mostrare un piccolo badge "Convertito" accanto allo stato

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| Migration | `ALTER TABLE prospect ADD COLUMN convertito_cliente_id uuid REFERENCES clienti(id)` |
| File modificati | `ProspectDetail.tsx`, `ProspectList.tsx` |
| Mapping campi | nome, cognome, email, telefono, note, ufficio_id → clienti |
| Condizione bottone | stato = "chiuso_vinto" AND convertito_cliente_id IS NULL |

