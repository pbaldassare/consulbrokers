# Gestione IBAN: Specialist → Sede → Default Consulbrokers

## Decisioni confermate

1. **Specialist = riga in `backoffice`** (anagrafica), non `profiles`. È la stessa tabella dove oggi gestiamo gli Specialist da Anagrafiche Interne.
2. **Fallback silenzioso** sul conto di default Consulbrokers: se Specialist e Sede non hanno IBAN, il sistema usa sempre il default senza mostrare avvisi al cliente.
3. **L'IBAN risolto resta sempre modificabile** in fase di stampa/invio: nel PDF E/C cliente e nei template email l'utente vedrà l'IBAN proposto ma potrà sostituirlo manualmente prima di confermare.

## Catena di priorità

```text
IBAN proposto al cliente =
  1) backoffice.conto_bancario_id          (Specialist assegnato al cliente)
  2) uffici.conto_bancario_id              (Sede del cliente)
  3) conti_bancari.is_default = true       (default Consulbrokers, tipo='incasso_clienti')

→ override manuale possibile prima dell'invio
```

## Modifiche DB (una migration)

1. `ALTER TABLE uffici ADD COLUMN conto_bancario_id uuid REFERENCES conti_bancari(id) ON DELETE SET NULL;`
2. `ALTER TABLE backoffice ADD COLUMN conto_bancario_id uuid REFERENCES conti_bancari(id) ON DELETE SET NULL;`
3. Funzione SQL `get_iban_cliente(p_cliente_id uuid) RETURNS TABLE(iban text, intestato_a text, banca text, bic text, fonte text)` che applica la catena. `fonte ∈ ('specialist','sede','default')`. Mai NULL: se non c'è nemmeno un default attivo restituisce stringhe vuote con `fonte='nessuno'` (il frontend mostrerà comunque il campo editabile vuoto).
4. Seed: assicurarsi che in `conti_bancari` esista un record con `is_default=true`, `tipo='incasso_clienti'`, `attivo=true`. Se non esiste, la migration lo crea con placeholder Consulbrokers da completare poi dall'admin via UI.
5. Vincolo soft: trigger che impedisce di avere più di un `is_default=true` per ogni `tipo`.

## Modifiche UI

### `SediManager.tsx`
Sostituire i 3 campi liberi IBAN/Intestato/Banca con `<ContoBancarioSelect tipi={["incasso_clienti","generico"]} />` legato a `conto_bancario_id`. Vecchi campi locali restano in DB (back-compat) ma non più editabili.

### `SpecialistList.tsx`
Aggiungere `<ContoBancarioSelect>` nel form Specialist. Etichetta: "IBAN personale per incassi (opzionale, sovrascrive quello della Sede)".

### `ContiBancariPage.tsx`
- Badge "Default" ben visibile sulla riga `is_default=true`.
- Colonna "Usato da" con conteggio Sedi + Specialist che lo referenziano.

### Nuovo helper `src/lib/resolveIbanCliente.ts`
```ts
export async function resolveIbanCliente(clienteId: string): Promise<{
  iban: string; intestato_a: string; banca: string; bic: string;
  fonte: 'specialist'|'sede'|'default'|'nessuno';
}>
```
Chiama la RPC `get_iban_cliente`. Usato da PDF E/C cliente e dai template email.

### `ECClientePdfPage.tsx`
- Rimuovere fallback hardcoded.
- Caricare l'IBAN tramite `resolveIbanCliente`.
- Mostrare un campo IBAN **editabile** in alto (con valore preselezionato) prima del bottone "Genera PDF". L'utente può sovrascrivere prima della stampa.
- Nessun avviso "IBAN non configurato": il default Consulbrokers entra in modo silenzioso.

## Cosa NON tocco

- `conti_incasso` (Tabelle di Base): resta, è classificatore primanota.
- IBAN compagnie / rapporti compagnia: già migrati nel giro precedente.
- Drop colonne legacy `uffici.iban / intestato_a / banca`: pulizia separata, dopo verifica.

## Output finale

Dopo questa modifica, generando un E/C per qualsiasi cliente:
- chi ha Specialist con IBAN personale → vede quello
- altrimenti chi ha Sede con IBAN dedicato → vede quello della Sede
- tutti gli altri → vedono silenziosamente il default Consulbrokers
- e in ogni caso l'utente può ancora modificarlo a mano prima di stampare/inviare
