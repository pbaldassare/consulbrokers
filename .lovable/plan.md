## Obiettivo
Aggiungere un test Playwright E2E che valida il ciclo completo del flag **Regolazione** come promemoria: attivazione su un titolo, salvataggio dei campi obbligatori, e riflesso sulla card "Regolazioni Attese" in Gestione Polizze (badge live + filtro segmentato + colonna stato).

## File da creare
`tests/e2e/10-regolazione-flag.spec.ts` — nuovo file, allineato al pattern di `09-gestione-polizze.spec.ts` (storageState admin + `expectPageHealthy`).

## Setup dati
Riuso degli helper esistenti in `tests/helpers/db-helper.ts`:
- `createTestTitolo()` per creare un titolo `attivo` con `regolazione=false`
- `cleanupTestTitolo()` in `afterAll` per teardown
- Numero polizza univoco con timestamp (`REG-E2E-${Date.now()}`)

Il `clienteId`/`produttoreId` di partenza viene risolto via `supabaseAdmin` cercando il primo cliente attivo e un'anagrafica professionale corrispondente, così il test resta self-contained.

## Scenari di test

### 1. Conteggio iniziale card "Regolazioni Attese"
- Apre `/portafoglio/gestione`
- Cattura il numero (badge ambra) sulla card `[data-op="regolazione"]` come `countBefore` (0 se badge assente)

### 2. Attivazione flag da TitoloDetail
- Naviga a `/titoli/{titoloId}?section=regolazione`
- Verifica che la sezione "Regolazione" sia espansa
- Attiva lo Switch "Polizza in regolazione (promemoria)"
- Compila:
  - **Data presunta**: oggi + 15 giorni (badge atteso 🟡 "In scadenza")
  - **Fattore**: `Fatturato` (via SearchableSelect)
  - **Note**: "Test E2E promemoria"
- Click "Salva" / submit della sezione
- Attende toast di conferma e ricarica → verifica che i campi siano persistiti

### 3. Aggiornamento card + filtro + colonna in Gestione Polizze
- Torna a `/portafoglio/gestione`
- Verifica che il badge sulla card `[data-op="regolazione"]` sia `countBefore + 1`
- Click sulla card → si attiva l'operazione "Regolazioni Attese"
- Verifica che il filtro segmentato "Regolazione" sia nascosto (già implicito dall'operazione)
- Cerca il numero polizza di test nel filtro "N° polizza / ricerca libera"
- Verifica nella tabella risultati:
  - Riga presente con numero polizza atteso
  - Colonna **Reg.** mostra badge 🟡 (in scadenza, entro 30gg)
  - Bottone "Esegui" presente
- Click "Esegui" → URL `/titoli/{id}?section=regolazione`

### 4. Verifica filtro segmentato (con operazione neutra)
- Torna a `/portafoglio/gestione`, seleziona operazione `appendice` (non-regolazione)
- Verifica che il filtro segmentato "Regolazione" sia visibile
- Click "In reg." → URL contiene `reg=si`
- Cerca il numero polizza test → riga presente
- Click "Senza" → riga assente / messaggio empty

### 5. Disattivazione flag (cleanup logico)
- Naviga a `/titoli/{titoloId}?section=regolazione`
- Disattiva Switch e salva
- Verifica che `data_presunta`, `fattore`, `note` siano azzerati (re-fetch via `supabaseAdmin`)
- Torna alla hub, verifica che il badge sia tornato a `countBefore`

## Dettagli tecnici
- **Selettori**: preferenza per `getByRole`, `getByLabel`, `[data-op="regolazione"]`. Per i badge sulla card uso `locator('[data-op="regolazione"]').locator('text=/^\\d+$/')`.
- **Stato SearchableSelect**: pattern Popover+Command → click trigger, poi `getByRole('option', { name: 'Fatturato' })`.
- **Sincronizzazione**: dopo i submit attendo `expect(toast).toBeVisible()` + reload mirato; per la card hub uso `expect.poll()` sul numero del badge (max 5s) per gestire l'invalidazione TanStack Query.
- **Teardown**: `afterAll` chiama `cleanupTestTitolo()` e non lascia righe orfane in `titoli_regolazioni` (il test non crea regolazioni eseguite — solo il flag promemoria).
- Nessuna modifica a codice di produzione o migrazioni: solo nuovo file di test.

## Non incluso
- Test di concorrenza / race condition sul badge
- Test del badge 🔴 "Scaduta" e ⚪ "Programmata" (basterebbero altre 2 date — posso aggiungerli se vuoi coprire tutti e 3 gli stati colore)
- Modifica del flag su più titoli in parallelo

Vuoi che estenda lo scenario 3 a coprire **tutti e 3 i colori del badge** (creando 3 titoli con date diverse: ieri / +15gg / +60gg)?
