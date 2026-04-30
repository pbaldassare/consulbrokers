## Obiettivo

Separare nettamente le responsabilità:
- **Anagrafiche Amministrative** = unico posto dove si gestiscono dati personali, RUI, banca, percentuali, **Sede di appartenenza** di Specialist, Produttori, Account Executive, Resp. Sede.
- **Centro Utenti & Privilegi** = solo creazione utente di sistema, ruolo, password, permessi (`permessi_json`), attivo/disattivo. Niente più editing di sede, percentuali, RUI, banca.

Regola di business: **ogni Specialist e ogni Produttore deve essere collegato a una Sede** (`ufficio_id` obbligatorio). Anche Resp. Sede e Account Executive devono averla.

## Modifiche al Database

1. **Backfill dati mancanti**: per ogni `profiles` con ruolo in (`backoffice`, `account_executive`, `corrispondente_*`, `responsabile_sede`) che ha `ufficio_id` NULL, segnalarlo (query di audit) — NON forzare un valore arbitrario.
2. **Vincolo NOT NULL condizionato** tramite trigger `validate_profilo_sede_required`:
   - se `ruolo` ∈ {`backoffice`, `account_executive`, `corrispondente_1/2/3`, `responsabile_sede`} ⇒ `ufficio_id` obbligatorio (RAISE EXCEPTION se NULL).
   - non si applica ai ruoli `admin`, `cliente`, `prospect`.
3. Nessuna modifica strutturale alle colonne (sono già tutte presenti in `profiles`: `ufficio_id`, `codice_contabile`, `nome_rui`, `numero_rui`, `sezione_rui`, `data_iscrizione_rui`, `percentuale_base`, `percentuale_consulenza`, `percentuale_ra`, `iban`, `intestatario_cc`).

## Modifiche UI

### `src/components/anagrafiche/SpecialistList.tsx`
- Rendere **Sede obbligatoria** nel form (asterisco, validazione client + messaggio).
- Bloccare il salvataggio se Sede vuota.
- Mostrare warning sulla riga della tabella se uno Specialist non ha Sede (badge "Sede mancante" rosso).
- Banner aggiornato: "Per CREARE un nuovo Specialist (utente di sistema con password) usa Centro Utenti & Privilegi. Tutti gli altri dati (anagrafica, RUI, banca, percentuali, **Sede**) si gestiscono qui."

### `src/pages/AnagraficheInternePage.tsx`
- Rendere Sede obbligatoria nei form Account Executive, Produttori, Resp. Sede (già presente come campo: aggiungere validazione + asterisco).

### `src/pages/GestioneUtentiPrivilegi.tsx`
- **Rimuovere** dalla schermata di edit utente i campi: `ufficio_id`, `percentuale_base`, `percentuale_ra`, eventuale RUI/IBAN se presenti.
- Lasciare solo: email, ruolo, attivo, `permessi_json`, password reset.
- Per ogni utente mostrare in sola lettura un link "Modifica anagrafica completa →" che porta in Anagrafiche Amministrative al tab corretto in base al ruolo, con la riga preselezionata/aperta in edit.
- Mostrare anche in sola lettura la Sede attualmente assegnata (con badge "non impostata" in rosso se mancante).

### Navigazione
- Da Centro Utenti il link "Modifica anagrafica" naviga a:
  - ruolo `backoffice` → `/archivi/anagrafiche-amministrative?tab=specialist&edit=<id>`
  - ruolo `account_executive` → `?tab=account_executive&edit=<id>`
  - ruolo `corrispondente_*` → `?tab=corrispondente&edit=<id>`
  - ruolo `responsabile_sede` → `?tab=responsabile_sede&edit=<id>`
- Le pagine target leggono i query param e aprono il dialog di edit.

## File toccati

- nuova migration SQL: trigger `validate_profilo_sede_required` su `profiles`
- `src/components/anagrafiche/SpecialistList.tsx` (Sede obbligatoria + badge warning)
- `src/pages/AnagraficheInternePage.tsx` (Sede obbligatoria sugli altri tab + supporto query param `tab` e `edit`)
- `src/pages/GestioneUtentiPrivilegi.tsx` (rimozione campi anagrafici, link a Anagrafiche, badge Sede mancante)
- aggiornamento memory `mem://auth/user-management-and-profile-schema` con nuova divisione di responsabilità
- bump `public/version.json`

## Note importanti

- **Audit preliminare**: dopo l'applicazione del trigger, qualsiasi UPDATE su un profilo "professionale" senza Sede fallirà. Prima di attivare il trigger eseguo una SELECT per elencare i profili attualmente senza Sede e li mostro all'utente nei log così può sistemarli (oppure il trigger viene applicato solo sugli INSERT/UPDATE futuri in cui il campo `ufficio_id` viene toccato — preferisco questa variante più sicura: il trigger blocca solo se dopo l'operazione `ufficio_id IS NULL` su un ruolo professionale, evitando rotture su update di altri campi solo se il valore esisteva già; la regola è quindi "non puoi salvare un profilo professionale senza Sede").
- Centro Utenti rimane l'**unico** punto per creare l'utente Auth (chiama già edge function dedicata) — non duplichiamo questa logica in Anagrafiche.