## Obiettivo

In **Immissione Polizza**, i campi **Account Executive** e **Produttore** devono attingere dalla pagina **Archivi → Anagrafiche Amministrative** (`anagrafiche_professionali`) e auto-popolarsi dal cliente selezionato. Sede e Specialist mantengono le fonti attuali (`uffici`, `profiles` ruolo `backoffice`).

**Importante**: gli elenchi di Produttore/Sede/AE/Specialist sono **identici per tutti i tipi cliente** (privato/azienda/ente). Il `tipo_soggetto` del Gruppo Finanziario governa solo i campi anagrafici del cliente, non queste tendine.

## Stato attuale e problema

- `anagrafiche_professionali` contiene già: 163 AE (`tipo='account_executive'`), 248 Produttori (`tipo='corrispondente'`), 146 Resp. Sede.
- Oggi in Immissione le tendine AE e Produttore attingono in parte da `profiles`. Per il cliente "baldassare paolo" l'AE assegnato è un profilo `ruolo='backoffice'` → l'`id` è settato ma non compare tra le opzioni → tendina vuota.
- Produttore tenta un match per nome verso anagrafiche → spesso fallisce → vuoto.

## Modifiche

### 1. Schema (migrazione)

- `titoli.ae_anagrafica_id uuid` (FK → `anagrafiche_professionali.id`, nullable). Affianca il legacy `commerciale_id`.
- `codici_commerciali_cliente.anagrafica_id uuid` (FK → `anagrafiche_professionali.id`, nullable). Coesiste con `profilo_id`.

Nessuna eliminazione di colonne legacy in questo step.

### 2. Hook lookup canonici (`src/hooks`)

- `useProduttoriLookup` (esistente, `tipo='corrispondente'`).
- Nuovo `useAccountExecutivesLookup` (`tipo='account_executive'`, `attivo=true`).
- Entrambi restano gli stessi a prescindere dal tipo cliente.

### 3. Scheda Cliente (`src/pages/ClienteDetail.tsx` + tab commerciali)

- Tendine "Account Executive" e "Produttore Sede": switch da profili a anagrafiche professionali.
- Salvataggio: scrive `codici_commerciali_cliente.anagrafica_id`. `profilo_id` può rimanere NULL per le nuove righe AE/Produttore.
- Specialist resta su `profiles` (ruolo `backoffice`).
- Sede resta su `uffici`.

### 4. Immissione Polizza (`src/pages/ImmissionePolizzaPage.tsx`)

- **AE**: opzioni da `useAccountExecutivesLookup`.
- **Produttore**: opzioni da `useProduttoriLookup` (rimuovere il match per nome).
- **Specialist**: invariato.
- **Sede**: invariata.
- Eredità da cliente: leggi `codici_commerciali_cliente`; per ruoli `account_executive`/`AE` e `Produttore Sede` usa `anagrafica_id` come valore preselezionato. Se NULL, fallback al match per nome verso anagrafiche; se nessun match, mostra hint "Collega AE/Produttore all'Anagrafica Amministrativa nella scheda cliente".
- Salvataggio:
  - `titoli.ae_anagrafica_id` = AE selezionato.
  - `titoli.anagrafica_commerciale_id` = Produttore selezionato (già così).
  - `titoli.ae_nome` / `titoli.produttore_nome` continuano a essere popolati come testo leggibile.

### 5. Wizard Import Polizza AI (`ImportNuovaPolizzaAIDialog.tsx`)

Stessi due lookup canonici per AE e Produttore.

## Out of scope

- Migrazione massiva dei dati storici di `codici_commerciali_cliente` (linkare progressivamente in modifica scheda; eventuale script in task dedicato).
- Pulizia colonne legacy (`commerciale_id`, `profilo_id` per AE/Produttore).

## Memoria da aggiornare

- Estendere `mem://insurance/produttori-lookup-source` includendo anche AE: fonte `anagrafiche_professionali` `tipo='account_executive'`; nuovo campo `titoli.ae_anagrafica_id`.
- Nota in `mem://insurance/gruppi-finanziari-tipo-soggetto`: il `tipo_soggetto` non influenza le tendine Produttore/Sede/AE/Specialist.
