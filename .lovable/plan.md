# Anticipi cliente in Portafoglio → Carico

Obiettivo: collegare visivamente la disponibilità di anticipi del cliente alle righe della pagina **Portafoglio → Carico**, in linea con la card già presente in scheda cliente e con il MessaCassaDialog (stessa fonte dati: `cliente_anticipi.importo_residuo`).

## Cosa cambia (solo UI + un hook dati)

1. **Nuovo hook** `useAnticipiResiduoByClienti(clienteIds: string[])`
   - Fa una query aggregata su `cliente_anticipi` filtrata per `cliente_id IN (...)` e `importo_residuo > 0`.
   - Ritorna una `Map<cliente_id, { totale: number, conteggio: number }>`.
   - Chiave query: `["anticipi-residuo-by-clienti", sortedIds]` → si aggancia alle invalidazioni già esistenti aggiungendo questa chiave dove invalidiamo `anticipi-globale` (creazione/eliminazione anticipo, messa a cassa, annulla messa a cassa, annulla polizza).

2. **PortafoglioCaricoPage** (`src/pages/PortafoglioCaricoPage.tsx`)
   - Calcolo dei `clienteIds` univoci dalle righe correnti della pagina e passaggio all'hook.
   - Nuova colonna in tabella **"Anticipo"** dopo "Cliente":
     - Se residuo > 0 → badge verde cliccabile con importo formattato (es. `€ 300,00`) e tooltip "N anticipi disponibili — clicca per dettagli".
     - Click sul badge: apre `AnticipoUtilizziDrawer` (il primo anticipo disponibile del cliente) **oppure** naviga a `/contabilita/anticipi-clienti?cliente=<id>` (vedi domanda sotto se preferisci una delle due — di default prendo: click apre il drawer del primo anticipo disponibile + secondary action "Vedi tutti" nel tooltip che porta al riepilogo filtrato).
     - Se residuo = 0 → trattino `—` muted.
   - Click sulla cella non deve propagare l'apertura riga (stopPropagation).

3. **Stessa colonna replicata** in:
   - `PortafoglioAttivePage.tsx`
   - `PortafoglioStoricoPage.tsx`
   (stesso pattern, riusando l'hook — coerenza con il filtro `Polizze + Quietanze`).

4. **Sincronizzazione**: aggiungo `qc.invalidateQueries({ queryKey: ["anticipi-residuo-by-clienti"] })` in:
   - `useAnticipiCliente.ts` (create / delete)
   - `MessaCassaDialog.tsx` (su success)
   - `lib/annullaMessaACassa.ts`
   - `lib/annullaPolizza.ts`
   Così la colonna si aggiorna in tempo reale insieme a `anticipi-globale`.

## File toccati

- nuovo: `src/hooks/useAnticipiResiduoByClienti.ts`
- modifiche: `src/pages/PortafoglioCaricoPage.tsx`, `src/pages/PortafoglioAttivePage.tsx`, `src/pages/PortafoglioStoricoPage.tsx`, `src/hooks/useAnticipiCliente.ts`, `src/components/portafoglio/MessaCassaDialog.tsx`, `src/lib/annullaMessaACassa.ts`, `src/lib/annullaPolizza.ts`

## Fuori scope (come da tua risposta)

- Niente azione "Nuovo Anticipo" sulla riga.
- Niente KPI globale anticipi in testata.
- Nessun cambiamento al MessaCassaDialog (resta nascosto se il cliente non ha anticipi).

## Domanda residua

Sul click del badge "Anticipo" preferisci:
- (a) aprire il drawer utilizzi del primo anticipo disponibile (più veloce, contestuale), oppure
- (b) navigare a `/contabilita/anticipi-clienti?cliente=<id>` (riepilogo completo del cliente)?

Se non rispondi vado con (a).
