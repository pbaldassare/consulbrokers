
## Richiesta utente

Configurare la **creazione di una polizza/titolo** completa con:
1. Tutti i campi standard di una polizza
2. Campi extra se ramo = RCA Auto
3. Collegamento a cliente esistente OPPURE creazione nuova anagrafica al volo
4. Collegamento a Ufficio (Sede), Produttore (AE/Consul), Specialist (Backoffice)

## Esplorazione fatta

- `ImmissionePolizzaPage.tsx` esiste già (visto in step precedente con MarcaCombobox)
- `mem://insurance/policy-financial-structure-expansion` — schema `titoli` ricco di campi tecnici
- `mem://insurance/policy-data-inheritance` — eredità da Cliente/Prodotto
- `mem://insurance/rca-auto-specific-data` — sezione RCA con marca/modello/CU/targa/sector
- `mem://insurance/branch-commissions-automation` — Compagnia+Sede+Ramo → provvigioni auto
- `mem://insurance/policy-commission-split` — split commerciale/Consul

Devo verificare lo stato attuale di `ImmissionePolizzaPage.tsx` per capire cosa c'è e cosa manca.

## Piano

### Step 1 — Audit della pagina esistente
Leggere `ImmissionePolizzaPage.tsx` per identificare:
- Sezioni già presenti
- Campi mancanti rispetto allo schema `titoli`
- Eventuale supporto RCA condizionale
- Logica creazione nuova anagrafica inline

### Step 2 — Riorganizzazione del form a sezioni accordion
Strutturare il form di immissione in **6 sezioni espandibili** (allineate al `TitoloDetail`):

**A) Cliente & Anagrafica**
- `SearchableSelect` cliente esistente con filtro server-side (privati/aziende/enti)
- Pulsante **"+ Nuovo Cliente"** → apre `Dialog` con form rapido (tipo, ragione sociale/nome+cognome, CF/PIVA, email, telefono, comune) → al salvataggio inserisce in `clienti` e auto-seleziona
- Auto-popolamento: alla selezione cliente → eredita Gr.Finanziario, Linea, Attività, Settore, Specialist (backoffice_assegnato_id)

**B) Contratto**
- Compagnia (`SearchableSelect` su `compagnie`)
- Ramo (`SearchableSelect` su `rami`, con gruppo)
- Prodotto (filtrato per compagnia+ramo se disponibile)
- Numero polizza, Tipo portafoglio, Riga, Appendice
- Vincolo, Targa/Telaio (visibile solo se ramo è RCA-like)

**C) Periodo**
- Durata Da/A, Garanzia Da/A, Data Competenza, Data Scadenza
- Anni durata (auto-calc), Rate, GG Mora, Tipo Rinnovo, Disdetta mesi
- Validazione: Durata A > Durata Da; warning se >13 mesi (poliennale, da memoria)

**D) Premio & Importi**
- Lordo, Imponibile, Tasse, Accessori, Diritti, Frazionamento
- Auto-calc tasse da `aliquota_tasse_ramo` (memoria branch-tax-rates)

**E) Commerciale & Provvigioni**
- Ufficio/Sede (`SearchableSelect` su `uffici`) — preselezionato dal cliente
- Produttore/AE (`SearchableSelect` su profili commerciali)
- Specialist/Backoffice (`SearchableSelect` su profili backoffice) — preselezionato dal cliente
- Commerciale (anagrafica_commerciale_id) + % Commerciale + importo provv.
- Consul + % Consul + importo provv.
- Auto-fetch % da `provvigioni_compagnia_sede_ramo` su evento (Compagnia+Sede+Ramo)

**F) RCA Auto** (visibile **solo se** ramo selezionato è categoria RCA)
- Targa (uppercase), Telaio
- **MarcaCombobox / ModelloCombobox** (già creati, da DB locale)
- Anno immatricolazione, Data immatricolazione
- Tipo veicolo (`TIPI_VEICOLO` da `rcaConstants`)
- Classe CU (`CLASSI_MERITO` 1-18)
- Settore d'uso, Uso del veicolo (lookup gerarchico)
- Alimentazione, Cilindrata, Potenza kW, Posti
- Massa rimorchiabile (se autocarro)
- Attestato rischio (numero, data emissione)

### Step 3 — Logica condizionale RCA
- Determinare "è RCA" da `rami.gruppo IN ('RCA', 'AUTO')` o codice ramo specifico
- Mostrare/nascondere Sezione F dinamicamente all'evento di selezione ramo
- Se RCA: rendere obbligatori targa, marca, modello, classe CU

### Step 4 — Dialog "Nuovo Cliente" inline
Nuovo componente `QuickClienteDialog.tsx`:
- Tabs: Privato / Azienda / Ente
- Campi minimi obbligatori (nome/ragione, CF/PIVA con auto-uppercase)
- Inserimento in `clienti` + ritorno id al form padre
- Toast conferma + auto-selezione

### Step 5 — Validazione & Salvataggio
- Schema `zod` per il form
- Salvataggio in `titoli` con tutti i campi
- Creazione automatica primo movimento (`movimenti_polizza` tipo `PI` Polizza Iniziale)
- Log su `log_attivita` (`creazione_polizza`)
- Redirect a `/titoli/{id}`

## File toccati

- `src/pages/ImmissionePolizzaPage.tsx` (refactor in sezioni accordion)
- `src/components/polizze/QuickClienteDialog.tsx` (nuovo)
- `src/components/polizze/RcaSection.tsx` (nuovo, riusabile)
- `src/components/polizze/CommercialeSection.tsx` (nuovo)
- `src/hooks/usePolizzaInheritance.ts` (nuovo, gestisce auto-popolamento)
- `src/hooks/useRamoIsRca.ts` (helper per detection RCA)

## Cosa NON cambia

- Schema DB `titoli` (già abbastanza ricco)
- Componenti MarcaCombobox/ModelloCombobox (già pronti)
- Lookup tables esistenti

## Nota importante

Confermo che ti basta una sola **modalità di creazione** (form a sezioni accordion in pagina dedicata). Se preferisci un **wizard a step guidato** (Cliente → Contratto → Periodo → Premio → Commerciale → RCA → Riepilogo), dimmelo prima di procedere così riorganizzo lo Step 2.
