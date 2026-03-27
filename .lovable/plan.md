

## Piano: Importare Clienti Napoli ed eliminare i fake

### Dati Excel
Il file `Clienti_Napoli_1.xlsx` contiene **~548 clienti** con 40 colonne. Include dati anagrafici, rete commerciale (Brand, Unit, Specialist), gruppi statistici/finanziari, zone, indotti, e date di gestione.

### Step 1 — Eliminare tutti i clienti fake

Ordine di cancellazione per rispettare le FK:
1. `clienti_relazioni` — DELETE all (762 record fake)
2. `codici_commerciali_cliente` — DELETE all (0 record)
3. `nominativi_cliente` — DELETE all (0 record)
4. `prospect` — nullificare `convertito_cliente_id`
5. `titoli` — già svuotata (0 record)
6. `sinistri` — già svuotata (0 record)
7. `clienti` — DELETE all (5.773 record fake)

### Step 2 — Importare dall'Excel

Script Python che:
- Legge l'Excel con pandas
- Determina `tipo_cliente`: `F` → `privato`, `G` → `azienda`
- Per privati: split del campo `Nome` in `cognome` e `nome` (prima parola = cognome, resto = nome)
- Per aziende: `Nome` → `ragione_sociale`

**Mappatura campi principali:**

| Excel | DB (clienti) |
|-------|-------------|
| Codice | codice_ricerca |
| Nome | cognome+nome / ragione_sociale |
| Indirizzo | indirizzo_residenza (privato) / indirizzo_sede (azienda) |
| Cap | cap_residenza / cap_sede |
| Comune | citta_residenza / citta_sede |
| Prov | provincia_residenza / provincia_sede |
| Tel | telefono |
| Email | email |
| AttenDi | attenzione_di |
| F/G | tipo_cliente |
| CF | codice_fiscale |
| PIva | partita_iva |
| GruStat | gruppo_statistico |
| GruFin | gruppo_finanziario_id (lookup per nome nella tabella `gruppi_finanziari`) |
| Indotto | indotto |
| Zona | zona |
| Attivita | attivita |
| Fatturato | fascia_fatturato |
| Dipendenti | fascia_dipendenti |
| SpecialistSX | spec_sx_danni |
| Stato | attivo (Attivo→true, altro→false) |

### Step 3 — Importare dati rete commerciale

Per ogni cliente, popolare `codici_commerciali_cliente` con:
- `societa_brand` ← Brand
- `filiale` ← Unit
- `ruolo` ← "account_executive" (lo Specialist è l'AE)
- `profilo_id` ← lookup in `anagrafiche_professionali` per nome dello Specialist
- `data_acquisito` ← Acquisito
- `scadenza_mandato` ← ScadMandato

I campi Prod1, Prod2, Prod3 non hanno colonna diretta; verranno ignorati o salvati nelle note.

### Step 4 — Collegare ufficio

La colonna `Filiale` dell'Excel (es. "Ufficio di Napoli") verrà mappata all'ufficio corrispondente nella tabella `uffici`. L'ufficio "Agenzia Napoli" è il match più probabile; se non coincide esattamente, verrà gestito con mapping manuale nel script.

### Step 5 — Verificare

- Conteggio clienti importati
- Conteggio codici commerciali
- Verifica che la pagina ClientiList e ClienteDetail mostrino i dati corretti

### Campi Excel senza corrispondenza diretta

| Campo Excel | Note |
|-------------|------|
| Prod1, Prod2, Prod3 | Nessuna colonna dedicata; possono essere salvati nelle note |
| CF dup, PI dup | Flag duplicati, info di controllo, non serve importarli |
| 7A Invio/Reso/Evaso | Gestione 7A, non presente nel modello attuale |
| GDPR Evaso | Privacy/consensi, gestiti separatamente |
| Inserito, Variato, Ultimo carico, Pr Scad | Date gestionali, non tutte hanno una colonna corrispondente |

### Dettagli tecnici
- Import via edge function generalizzata o script Python diretto con API REST
- Batch insert da 50 record
- Nessuna migrazione DB necessaria (tutte le colonne esistono già)

