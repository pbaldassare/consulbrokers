

L'utente vuole una pagina dedicata e ben strutturata graficamente per gestire utenti, livelli e privilegi. Devo prima esplorare cosa esiste già (GestioneUtenti, CreaNuovoUtente, ImpostazioniPage) per capire il punto di partenza, poi proporre una riorganizzazione completa con UX a livelli gerarchici.

Esploro velocemente i file chiave.

## Piano: Centro Gestione Utenti e Privilegi (multi-livello)

### Obiettivo
Una **unica pagina master** `/gestione-utenti-privilegi` (rinominabile) che organizzi visivamente utenti per livello gerarchico, con creazione guidata, gestione permessi e collegamento alle anagrafiche professionali esistenti.

### Architettura a 6 livelli (gerarchia)

```text
┌─────────────────────────────────────────────────────┐
│ L1  ADMIN              → tutto, configurazione      │
│ L2  CFO                → lettura globale + finanza  │
│ L3  SEDE (ufficio)     → vede sua sede + altre      │
│     SPECIALIST (BO)    → come sede, label diverso   │
│ L4  MANAGER            → vede i suoi produttori     │
│ L5  PRODUTTORE/CONSUL  → vede solo proprio porto    │
│     CORRISPONDENTE     → come produttore            │
│ L6  CLIENTE / PROSPECT → portale read-only          │
└─────────────────────────────────────────────────────┘
```

### Pagina nuova: 3 sezioni principali

**1. Header con KPI e filtro livelli**
- Card per ciascun livello con conteggio utenti attivi
- Click su card → filtra la lista sotto
- Pulsante grande "+ Crea nuovo utente" (apre wizard)

**2. Lista utenti organizzata per livello (accordion / tabs)**
- Raggruppamento visivo per livello con colori differenziati (gradiente teal coerente con identità)
- Per ogni utente: avatar, nome, email, sede, badge ruolo, switch attivo/sospeso, azione "Permessi" e "Modifica"
- Ricerca + filtro per sede/stato

**3. Pannello laterale "Permessi" (Sheet)**
- Quando si clicca su un utente, slide-in con:
  - **Tab Anagrafica**: nome, email, sede, ruolo
  - **Tab Visibilità**: chi vede (sua sede / tutte / solo suoi produttori / solo se stesso) — radio
  - **Tab Permessi modulari**: griglia checkbox per `permessi_json` (Polizze R/W, Sinistri R/W, Contabilità R, Provvigioni view, Tabelle base, ecc.)
  - **Tab Provvigioni**: switch "riceve provvigioni" + percentuali
  - **Tab Sicurezza**: reset password, disattiva, log accessi

### Wizard "Crea nuovo utente" (4 step)

```text
Step 1: Sorgente
  ○ Crea nuovo utente da zero (assegno email manuale)
  ○ Promuovi da Anagrafica Professionale esistente
     (lista searchable: AE, Corrispondenti, Executive…)
  ○ Promuovi da Cliente esistente (raro, per area riservata)

Step 2: Dati base
  - Nome, Cognome, Email (auto se da anagrafica)
  - Sede di appartenenza (SearchableSelect uffici)

Step 3: Livello e Ruolo
  - Scelta livello L1-L6 (card visuali)
  - Auto-template di permessi pre-impostati per quel livello
  - Visibilità gerarchica (di chi vede i dati)

Step 4: Conferma e provisioning
  - Mostra riepilogo
  - Genera password (Leone123! default o custom)
  - Invia email benvenuto (opzionale)
  - Edge function: crea auth.users + profiles + user_roles
```

### Permessi modulari (`permessi_json`)
Matrice visiva a checkbox raggruppata per area:
- **Operatività**: polizze, sinistri, trattative, prospect, calendario
- **Contabilità**: prima nota, rimesse, EC, chiusure
- **Reportistica**: CFO, report, estrazioni, area CFO
- **Amministrazione**: utenti, tabelle base, compagnie, uffici, manutenzione
- **Documentale**: librerie, upload, template
- **Provvigioni**: visualizza, riceve, gestisce pagamenti

Template pre-confezionati per livello (l'utente può poi personalizzare).

### Provisioning email (regole)
- **Da Anagrafica Professionale** (AE/Corrispondente/Executive): usa `email` esistente del professionista
- **Da zero** (Sede/Specialist/Manager/Admin/CFO): email custom inserita
- **Da Cliente/Prospect** (auto-provisioning esistente): già gestito dalle edge function attuali, nessuna modifica
- Password default: `Leone123!` (memorizzata in convenzione progetto)

### Interventi tecnici

**Frontend**
- Nuova pagina `src/pages/GestioneUtentiPrivilegi.tsx` (sostituisce/affianca `GestioneUtenti.tsx`)
- Componenti:
  - `UserLevelCard.tsx` (card KPI livello)
  - `UserList.tsx` (tabella raggruppata)
  - `UserPermissionsSheet.tsx` (pannello laterale)
  - `CreateUserWizard.tsx` (4 step Dialog)
  - `PermissionsMatrix.tsx` (griglia checkbox riusabile)
- Routing: aggiunta route admin-only in `src/routes/sistema.tsx`
- Voce sidebar in AppSidebar (sezione Sistema)

**Backend**
- Nessuna modifica schema obbligatoria — sfrutto `profiles.permessi_json`, `profiles.ruolo`, `profiles.ufficio_id`, `user_roles`
- Edge function `provision-user` esistente: estendo per accettare `permessi_json` e `level`
- Migrazione opzionale: tabella `livelli_utente_template` per salvare i preset di permessi (admin può modificare)

**Sicurezza**
- Pagina protetta da `RoleGuard allowedRoles={["admin"]}`
- Tutte le modifiche permessi loggate via `logAttivita`
- Conferma esplicita per disattivazione/cancellazione

### Domande per te (rispondi prima dello sviluppo)

1. **Livelli**: confermi i 6 livelli sopra (Admin, CFO, Sede/Specialist, Manager, Produttore/Corrispondente, Cliente/Prospect)? Vuoi aggiungerne/toglierne?

2. **Manager**: esiste già nel sistema o lo creiamo nuovo? Che ruolo DB usiamo (`manager`? `responsabile_sede`?)

3. **Visibilità**: ti basta la regola "vede solo proprio portafoglio / vede sua sede / vede tutte le sedi / vede produttori assegnati"? O serve qualcosa di più granulare (es. per ramo, per cliente)?

4. **Template permessi**: vuoi che salvi i preset in DB (modificabili dall'admin) oppure li hardcodo nel codice (più semplice, meno flessibile)?

### File coinvolti (riepilogo)
- ➕ `src/pages/GestioneUtentiPrivilegi.tsx`
- ➕ `src/components/utenti/UserLevelCard.tsx`
- ➕ `src/components/utenti/UserPermissionsSheet.tsx`
- ➕ `src/components/utenti/CreateUserWizard.tsx`
- ➕ `src/components/utenti/PermissionsMatrix.tsx`
- ✏️ `src/routes/sistema.tsx` (nuova route)
- ✏️ `src/components/AppSidebar.tsx` (nuova voce menu)
- ✏️ `supabase/functions/provision-user/index.ts` (estensione)
- ➕ migrazione opzionale `livelli_utente_template`

