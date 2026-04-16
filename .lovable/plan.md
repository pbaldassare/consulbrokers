

L'utente ha visto nella sidebar sotto "Anagrafiche Utenti" tre voci e mi chiede di spiegare cosa fanno **"Crea Utente (legacy)"** e **"Utenti di Rete (legacy)"**, e poi di migliorare l'organizzazione di questa sezione.

Esploro velocemente i file per dare una risposta precisa.

## Spiegazione delle voci attuali

### 1. `Crea Utente (legacy)` → `src/pages/CreaNuovoUtente.tsx`
Form **semplice e vecchio** (vedi screenshot): Nome, Cognome, Email, "Template Ruolo" da un dropdown. Crea l'utente via edge function `create-user` con password fissa `Leone123!`.
- **Limiti**: nessuna scelta sede, nessun permesso modulare, nessuna visibilità gerarchica, nessun collegamento ad anagrafiche professionali esistenti.
- È stato **superato** dal nuovo wizard a 4 step dentro **Centro Utenti & Privilegi**.

### 2. `Utenti di Rete (legacy)` → `src/pages/GestioneUtenti.tsx`
Tabella piatta che elenca tutti i `profiles` (tranne clienti/prospect) con filtri base per ruolo/stato. Permette di disattivare utenti o resettare permessi singolarmente.
- **Limiti**: niente raggruppamento per livello gerarchico, niente KPI, pannello permessi rudimentale.
- È stato **superato** dalla nuova pagina **Centro Utenti & Privilegi** che mostra tutto raggruppato per L1–L6 con sheet dettagliato.

### 3. `Centro Utenti & Privilegi` → `src/pages/GestioneUtentiPrivilegi.tsx` (la nuova)
Quella appena creata: card livello L1–L6, lista raggruppata, wizard 4-step, pannello permessi con tab.

## Conclusione: c'è ridondanza

Le tre voci fanno **la stessa cosa** ma in tre modi diversi. Il "Centro Utenti & Privilegi" copre già tutto. Le legacy vanno tolte dal menu (codice eventualmente rimuovibile in seguito).

---

## Piano: ripulire e consolidare la sezione Anagrafiche Utenti

### A. Sidebar — rimozione legacy
Nel gruppo **Anagrafiche Utenti** della sidebar (`AppSidebar.tsx`) restano solo:

```text
ANAGRAFICHE UTENTI
├── Centro Utenti & Privilegi   (l'unico hub di gestione/creazione)
└── Gestione Sedi               (anagrafica uffici, resta com'è)
```

Rimuovo:
- `Crea Utente (legacy)`
- `Utenti di Rete (legacy)`

### B. Route — redirect compatibilità
Per non rompere link salvati o vecchi bookmark:
- `/crea-utente` → redirect a `/utenti-privilegi?wizard=open`
- `/gestione-utenti` → redirect a `/utenti-privilegi`

Le pagine `CreaNuovoUtente.tsx` e `GestioneUtenti.tsx` **restano in repo** (non cancellate) per safety, ma non più raggiungibili dal menu.

### C. Migliorie al "Centro Utenti & Privilegi"
Per rendere la pagina davvero il punto unico, aggiungo:

1. **Apertura wizard via query param** (`?wizard=open`) — serve per il redirect sopra e per deep-link.
2. **Pulsante "Crea Utente" più evidente** in header (già c'è, lo rendo primario teal).
3. **Tab/segmenti in alto**: "Tutti gli utenti" | "Solo attivi" | "Sospesi" — filtro rapido.
4. **Colonna "Sede"** visibile nella riga utente (oggi manca).
5. **Sezione "Da provisionare"**: evidenzia anagrafiche professionali (AE/Corrispondenti) **senza account** — bottone diretto "Crea account" che apre il wizard al passo 2 con dati precompilati.
6. **Info-box esplicativo** in cima alla pagina con la legenda dei 6 livelli (così l'admin capisce subito la gerarchia).

### D. Nessuna modifica DB
Lavoro solo su frontend e routing.

### File coinvolti
- ✏️ `src/components/AppSidebar.tsx` (rimuovo 2 voci legacy)
- ✏️ `src/routes/sistema.tsx` (aggiungo redirect)
- ✏️ `src/pages/GestioneUtentiPrivilegi.tsx` (query param wizard, filtri, sezione "da provisionare", info-box, colonna sede)

### Domanda finale (rispondi prima dell'implementazione)
Confermi che vuoi:
- **(a)** rimuovere le 2 voci legacy dal menu e fare redirect → tutto consolidato in "Centro Utenti & Privilegi"
- **(b)** lasciarle visibili come "vista alternativa" → solo aggiungo le migliorie al Centro
- **(c)** rimuoverle anche dal codice (cancellazione totale dei due file)?

