## Riorganizzazione Conti Bancari

### 1. Pulizia dati (migrazione)
- **Backup** dei 334 conti `tipo='compagnia'` su `_backup_conti_compagnia_20260516` (solo admin).
- **DELETE** dei 334 record `tipo='compagnia'` (sono refusi da import legacy, etichette tipo `Compagnia: *ASSIMOCO ASS.NI`).
- Conservati: 4 conti Consulbrokers (3 `generico` + 1 `incasso_clienti`).

### 2. Estensione schema `conti_bancari`
Aggiunte 2 colonne nullable:
- `compagnia_id uuid REFERENCES compagnie(id) ON DELETE SET NULL` — entità proprietaria del conto (broker, agenzia, direzione, plurimandataria).
- `rapporto_id uuid REFERENCES compagnia_rapporti(id) ON DELETE SET NULL` — opzionale, per conti specifici di un rapporto plurimandatario/broker ↔ compagnia.

Vincolo di coerenza (trigger): se `rapporto_id` è valorizzato, anche `compagnia_id` deve esserlo e deve essere uguale all'agenzia del rapporto.

### 3. Tipi conto rivisti
| tipo | Descrizione | Mostra `compagnia_id`? | Mostra `rapporto_id`? |
|---|---|---|---|
| `consulbrokers` | Conti operativi Consulbrokers (sostituisce `incasso_clienti`, `provvigioni`, `generico`) | no | no |
| `agenzia` | Conto di un'agenzia | obbligatorio | no |
| `broker` | Conto di un broker | obbligatorio | opzionale |
| `direzione` | Conto di una direzione | obbligatorio | no |
| `plurimandataria` | Conto di un plurimandatario | obbligatorio | opzionale |

I 3 sotto-tipi Consul (`incasso_clienti`, `provvigioni`, `generico`) restano come **sotto-categoria** (campo `sottotipo` o riuso di `tipo` esistente con tab interna) per non perdere granularità nella stella ⭐ di default IBAN cliente.

→ Confermami: i 3 sottotipi Consul li tengo (così la catena IBAN cliente continua a funzionare) o li unifico tutti sotto `consulbrokers`?

### 4. UI — nuove tab
```
[Consulbrokers] [Agenzie] [Broker] [Direzioni] [Plurimandatari] [Tutti]
```
Ogni tab filtra per `tipo` corrispondente e mostra colonne aggiuntive:
- Colonna **Intestatario (compagnia)**: link cliccabile al record `compagnie` (codice + nome).
- Colonna **Rapporto**: visibile solo nelle tab Broker e Plurimandatari, mostra "Compagnia X · cod. mandato Y" se `rapporto_id` valorizzato, altrimenti "—" (= conto generico dell'entità).
- Tab Consulbrokers mantiene la sotto-distinzione (Incasso/Provvigioni/Generico) come badge inline.

Tab "Compagnie" eliminata.

### 5. Form Nuovo/Modifica Conto
- Step 1: scelta `tipo` (radio: Consulbrokers, Agenzia, Broker, Direzione, Plurimandataria).
- Se `tipo === 'consulbrokers'`: campo `sottotipo` (Incasso/Provvigioni/Generico) + `is_default` per tipo.
- Altrimenti: `SearchableSelect` per **Compagnia** (filtrato per `compagnie.tipo === tipo` selezionato).
- Se `tipo in ('broker','plurimandataria')`: select opzionale **Rapporto** che mostra i rapporti attivi della compagnia scelta (label: "Compagnia madre · codice mandato"). Vuoto = conto generico dell'entità.
- Validazione IBAN invariata.

### 6. Adeguamento `ContoBancarioSelect`
Il componente già accetta una prop `tipi`. Aggiorno i punti d'uso:
- Rimessa premi Napoli: `tipi=['consulbrokers']` (con filtro su sottotipo `generico`).
- Form Compagnia (RUI & Bancario): `tipi=[<tipo dell'agenzia corrente>]` + filtro `compagnia_id === <id agenzia>` quando in modifica.

### 7. Memoria
Aggiorno `mem://insurance/conti-bancari-struttura` con il nuovo modello.

---

### Cosa NON tocco
- I 4 conti Consulbrokers attuali (restano e vengono migrati al nuovo `tipo='consulbrokers'` mantenendo il sottotipo originale).
- La logica catena IBAN cliente (Specialist → Sede → Default Consulbrokers).
- La tabella `compagnia_rapporti` esistente.

### Conferme richieste
1. **Sottotipi Consulbrokers** (Incasso/Provvigioni/Generico): li mantengo o unifico tutto sotto un unico `consulbrokers`?
2. **Cancellazione 334 conti tipo `compagnia`**: confermi DELETE definitivo (con backup admin-only)?
3. **Tab order**: ti va Consulbrokers · Agenzie · Broker · Direzioni · Plurimandatari · Tutti, o preferisci ordine diverso?
