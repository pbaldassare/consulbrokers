## Obiettivo

Ristrutturare la sezione **Rete Commerciale** del dialog "Nuovo Cliente" (`src/components/clienti/NuovoClienteDialog.tsx`, attualmente lines ~981-1019) per riflettere la realtà operativa:

- Lo Specialist non ha provvigioni → niente % e Brand.
- L'Agente non serve → rimosso.
- Il Produttore non è legato a una Sede → si mantiene solo come ruolo commerciale.
- La Sede del cliente va invece collegata allo Specialist e mostrata come campo dedicato.
- Il Mandato è di default **No**: appare come Switch e, se attivato, espande i campi accessori (data acquisizione, scadenza, disdetta, proroga, altro broker).

## Nuova struttura "Rete Commerciale"

```text
┌─ Account Executive ─────────────────────────────┐
│ Profilo  │  % Provvigione  │  Società/Brand     │ (invariato)
└─────────────────────────────────────────────────┘

┌─ Specialist ────────────────────────────────────┐
│ Profilo (SearchableSelect, auto-assegnato)      │  ← solo questo
└─────────────────────────────────────────────────┘

┌─ Sede (collegata allo Specialist) ──────────────┐
│ Sede / Ufficio (SearchableSelect su `uffici`)   │
│   • auto-popolata dallo Specialist selezionato  │
│     (lookup `profiles.ufficio_id`), editabile   │
└─────────────────────────────────────────────────┘

┌─ Produttore ────────────────────────────────────┐  ← rinominato da "Produttore Sede"
│ Profilo │ % Provvigione │ Società/Brand         │
│ ─ Switch "Mandato attivo" (default No) ─        │
│   se ON →  Mandato (testo) │ Data Acquisizione  │
│            Scadenza Mandato │ Data Disdetta     │
│            Termine Proroga │ Altro Broker (sw.) │
└─────────────────────────────────────────────────┘
```

(Idealmente il blocco "Mandato switch + campi" si applica anche all'AE/Specialist se hanno un mandato; per ora lo applichiamo solo al Produttore — chiedi se vuoi estenderlo.)

La sezione **Agente** viene rimossa dall'UI insieme a state `agente`/`setAgente` e relativa riga in `insertCommercialRoles`.

## Dettagli tecnici

File: `src/components/clienti/NuovoClienteDialog.tsx`.

1. **Lookup uffici**: nuova `useQuery` su `uffici` (`select id, codice_ufficio, nome_ufficio`) ordinata per nome, in `useState<string>("")` `ufficioClienteId`.

2. **Auto-fill Sede da Specialist**: `useEffect` che, quando `backofficeRole.profilo_id` cambia, legge `profiles.ufficio_id` del profilo selezionato e, se `ufficioClienteId` è vuoto, lo imposta. Resta editabile.

3. **Persistenza Sede**: nel payload del create cliente, aggiungi `payload.ufficio_id = ufficioClienteId || null` (la colonna `clienti.ufficio_id` già esiste).

4. **Specialist semplificato**: nuovo render dedicato (non più `renderCorrispondenteFields`) con solo il SearchableSelect Profilo. Lo state `backofficeRole` resta ma in `insertCommercialRoles` salviamo soltanto `profilo_id` + `ruolo='Backoffice'`, ignorando %, brand, mandato.

5. **Produttore**: nuovo render con Profilo / % / Brand + Switch `mandatoAttivo` locale (default `false`). Se attivo, mostra i campi mandato/date/altro broker già presenti nella `CommercialRole`. Se disattivo, alla persistenza i campi mandato vengono forzati a null.

6. **Rimozione Agente**: elimina state `agente`, `setAgente`, l'`AccordionItem value="agente"`, la riga `{ ruolo: "Agente", data: agente }` in `insertCommercialRoles`, e la chiamata a `setAgente(emptyRole())` in `resetForm`.

7. **`renderCorrispondenteFields`**: resta utile per il blocco mandato (estratto come sub-component `MandatoFields`), riusato dal Produttore quando lo switch è ON.

## Fuori scope

- Nessuna modifica DB/RLS/edge function. La colonna `codici_commerciali_cliente.filiale` non viene usata.
- Nessuna modifica a `ClienteDetail.tsx` o `ClientiList.tsx` (stessa struttura legacy lì rimane finché non si chiede esplicitamente).
- Estensione del flag "Mandato" anche ad AE/Specialist non inclusa (chiedere se serve).
