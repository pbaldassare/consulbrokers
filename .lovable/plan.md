

## Piano: Conversione Prospect → Cliente "Comune di Varese" + Dati Simulati + Miglioramenti Portale

### Panoramica

Operazione complessa in 4 fasi: dati DB, ufficio San Donà, polizze fake con compagnie/rami reali, e miglioramenti UI al portale cliente.

---

### Fase 1 — Creare ufficio "San Donà di Piave" + assegnare Specialist

**Migrazione SQL:**
- `INSERT` ufficio con dati reali:
  - `nome_ufficio`: SEDE SAN DONA' DI PIAVE
  - `indirizzo`: Via Giobatta dall'Armi 3/2, 30027 San Donà di Piave (VE)
  - `email`: consulbrokerssandona@pec-mail.it
  - `telefono`: 0421 307800

- Scegliere uno Specialist esistente (es. GAETANO GUARRACINO, id `cf2372e6-...`, ruolo `backoffice`) e aggiornarne l'`ufficio_id` all'ufficio San Donà appena creato.

### Fase 2 — Convertire Prospect → Cliente

**Via script (Edge Function o SQL diretto):**

1. `INSERT` in `clienti` con dati del Comune di Varese:

| Campo | Valore |
|-------|--------|
| tipo_cliente | ente |
| ragione_sociale | Comune di Varese |
| partita_iva | 00291010121 |
| indirizzo_sede | Via Sacco 5 |
| cap_sede | 21100 |
| citta_sede | Varese |
| provincia_sede | VA |
| email | protocollo@comune.varese.it |
| pec | protocollo@pec.comune.varese.it |
| telefono | 0332 255111 |
| codice_sdi | UFZSRP (codice SDI tipico enti pubblici) |
| codice_fiscale_azienda | 00291010121 |
| user_id | `746c540d-...` (stesso del prospect) |
| ufficio_id | → id ufficio San Donà appena creato |
| attivo | true |
| note | Ente Pubblico - ~80.000 abitanti. Responsabile sede: Maria Midena |

2. Aggiornare il profilo auth (`profiles`) → `ruolo` da `prospect` a `cliente`
3. Aggiornare il prospect → `stato` = `chiuso_vinto`, `convertito_cliente_id` = nuovo id cliente
4. Assegnare codice commerciale (Specialist = GAETANO GUARRACINO)

### Fase 3 — Creare 8 polizze fake con compagnie e rami reali

| # | Prodotto | Compagnia (reale) | Ramo (reale) | Numero Polizza | Premio Lordo | Stato |
|---|----------|-------------------|--------------|----------------|-------------|-------|
| 1 | RCT/O | Generali Italia (`c152f68d`) | PA - R.C.T./O. (`aaf435d1`) | VA-RCTO-2025-001 | 18.500 | attivo |
| 2 | Infortuni Cumulativa | AXA (`57df53bc`) | NC - Infortuni Cumulativa (`f3478e36`) | VA-INF-2025-002 | 8.200 | attivo |
| 3 | Kasko Veicoli | Allianz (`0678589e`) | QK - Kasko (`7bfdf4f6`) | VA-KAS-2025-003 | 4.800 | attivo |
| 4 | Libro Matricola | Unipol (`a6c13e3d`) | QAB - Libro Matricola (`f42d71cc`) | VA-LM-2025-004 | 12.600 | attivo |
| 5 | Tutela Legale | Generali Italia (`c152f68d`) | PCB - RC + Tutela Legale (`bb7cbeee`) | VA-TL-2025-005 | 6.900 | attivo |
| 6 | RC Patrimoniale | Cattolica (`7b1c10eb`) | PS - RC Patrimoniale (`e2f09c7f`) | VA-RCP-2025-006 | 9.400 | attivo |
| 7 | Cyber Risk | AXA (`57df53bc`) | CY - Cyber Risk (`f479640c`) | VA-CYB-2025-007 | 7.300 | attivo |
| 8 | Welfare | Reale Mutua (`bd13e472`) | NI - Infortuni Individuale (`8d13b7c0`) | VA-WEL-2025-008 | 5.500 | attivo |

Tutti collegati a `cliente_anagrafica_id` del nuovo cliente, `ufficio_id` San Donà, `specialist` = GUARRACINO, `filiale` = "SEDE SAN DONA'".

### Fase 4 — Miglioramenti UI Portale Cliente

**4a. Aggiungere "Sinistri" alla navigazione** (`ClienteLayout.tsx`)
- Aggiungere voce "Sinistri" con icona `AlertTriangle` nel menu di navigazione (già esiste la rotta `/cliente/sinistri` e la pagina `ClienteSinistri.tsx`)

**4b. Aggiungere pagina "Il Mio Ufficio"** (nuova pagina `ClienteUfficio.tsx`)
- Mostra i dati dell'ufficio assegnato (indirizzo, telefono, email, orari)
- Mostra lo Specialist di riferimento (nome, email, telefono)
- Dati recuperati da `clienti.ufficio_id` → `uffici` + codici commerciali → profili
- Aggiungere voce "Il Mio Ufficio" nella navigazione e rotta

**4c. Aggiungere pagina "Anagrafica"** (nuova pagina `ClienteAnagrafica.tsx`)
- Mostra i dati anagrafici del cliente (read-only): ragione sociale, P.IVA, indirizzo, email, PEC, telefono
- Recuperati dalla tabella `clienti` tramite `user_id`
- Aggiungere voce "I Miei Dati" nella navigazione e rotta

---

### Dettagli tecnici

| File | Modifica |
|------|----------|
| Migrazione SQL | Ufficio San Donà + cliente + 8 titoli + aggiornamento profilo/prospect + codice commerciale |
| `src/components/ClienteLayout.tsx` | +3 voci nav (Sinistri, I Miei Dati, Il Mio Ufficio) |
| `src/pages/cliente/ClienteAnagrafica.tsx` | Nuova pagina read-only anagrafica |
| `src/pages/cliente/ClienteUfficio.tsx` | Nuova pagina info ufficio + specialist |
| `src/routes/cliente.tsx` | +2 rotte |

