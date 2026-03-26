

## Piano: Espansione Anagrafica Compagnie

### Cosa cambia

La tabella `compagnie` attualmente ha ~24 campi. Il legacy ne richiede ~15 aggiuntivi. La pagina CompagnieList va ristrutturata con form completo, dropdown con SearchableSelect, e click-to-edit sulla riga.

### 1. Nuove colonne su `compagnie` (migration)

| Colonna | Tipo | Note |
|---|---|---|
| `nazione` | text | Default 'ITALIA' |
| `cellulare` | text | |
| `note` | text | Attenzione di / Note |
| `iscrizione_rui_sez` | text | Sezione RUI |
| `iscrizione_rui_num` | text | Numero RUI |
| `pagamento` | text | es. "Bonifico a 30 gg." |
| `tipo_pagamento` | text | Assegno/Bonifico/Rimessa Diretta |
| `codice_abi` | text | |
| `codice_cab` | text | |
| `bic` | text | |
| `citta_banca` | text | |
| `aut_incasso_118` | boolean | DEFAULT false |
| `tipo_copertura` | text | Deposito/Scambio conferme/Conferma broker |
| `ra_ec_negativi` | boolean | DEFAULT false |
| `allegato_excel_avvisi` | boolean | DEFAULT false |
| `allegato_excel_ec` | boolean | DEFAULT false |
| `firma_digitale` | text | No/FES/FEA |
| `escluso_all4` | boolean | DEFAULT false |

### 2. Tabelle lookup (seed nella stessa migration)

Riutilizzo `gruppi_finanziari` già esistente per il dropdown "Gruppo Finanziario". Per gli altri dropdown uso array costanti nel frontend:

- **Nazioni**: array statico (ITALIA, FRANCIA, GERMANIA, ecc.)
- **Stato**: Attivo / Sospeso / Non Operativo (radio)
- **Tipo Mandatario**: 13 voci (Direzione, Gerenza, Agenzia Generale, ecc.)
- **Gruppo Statistico**: ~90 voci dal testo fornito (array costante)
- **Tipo Pagamento**: Assegno bancario, Assegno circolare, Bonifico, Rimessa Diretta
- **Firma Digitale**: No, FES, FEA
- **Tipo Copertura**: 3 voci

### 3. Ristrutturazione `CompagnieList.tsx`

**Lista**: click su riga apre Dialog di dettaglio/modifica (non solo creazione).

**Form Dialog** riorganizzato in 2 tab:
- **Dati Anagrafici**: Codice, Nome, Indirizzo, CAP/Città/Prov, Nazione (SearchableSelect), Stato (radio 3 opzioni), Email, Telefono, Fax, Cellulare, Note
- **Dati Contabili**: CF, P.IVA, Iscrizione RUI (Sez + Num), Pagamento, Tipo Pagamento, % Rit. Acconto, Gruppo Finanziario (SearchableSelect da `gruppi_finanziari`), Tipo Mandatario (SearchableSelect), Gruppo Statistico (SearchableSelect), IBAN, ABI/CAB, Intestato a, BIC, Città banca, Aut. Incasso 118 (switch), Tipo Copertura, R.A. su E/C negativi (switch), Allegato Excel (switches), Firma Digitale (radio), Escluso All.4 (switch)

### 4. Aggiornamento dati demo

UPDATE delle 15 compagnie esistenti con valori realistici per i nuovi campi (nazione, tipo_mandatario, gruppo_statistico, ecc.)

### Modifiche per file

| File | Modifica |
|---|---|
| **Migration SQL** | ALTER TABLE compagnie ADD ~18 colonne + UPDATE dati demo |
| **CompagnieList.tsx** | Ristrutturazione completa: click-to-edit, form 2 tab con tutti i campi, SearchableSelect per dropdown lunghi |

