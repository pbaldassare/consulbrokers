

## Piano: Modulo Contabilità Generale Completo

### Stato attuale
- Solo **Fornitori** è implementato; tutte le altre voci sono PlaceholderPage
- Tabelle esistenti: `movimenti_contabili`, `estratti_conto`, `incroci_bancari`, `fornitori`
- `BancaImport` esiste ma è sotto altra sezione
- Nessuna tabella causali/tabelle di servizio

### File Excel caricato
Contiene dati **Certificazione Unica (CU)** con movimenti dettaglio: Codice fornitore, Nome, N° Primanota, Data, Protocollo, Documento, Tipo (EE=redditi lavoro autonomo), Imponibile, Ritenuta, ecc. — va importato nella sezione Dichiarativi.

### Architettura — 7 moduli da creare

#### 1. Tabelle di Servizio / Causali (nuova pagina + DB)
Tabella unica `causali_contabili` con campo `tipo_tabella` per distinguere:

| Codice | Descrizione | tipo_tabella |
|--------|-------------|--------------|
| TBDSCC | Causali Primanota | causale_primanota |
| TBDSIV | Assoggettamento IVA | assoggettamento_iva |
| TBDSFI | Formato | formato |
| TBDSDV | Divisioni | divisione |
| TBDSCO | Modalità consegna | modalita_consegna |
| TBDSCM | Tipo compenso | tipo_compenso |
| TBDSCF | Categoria fido | categoria_fido |
| TBDSCD | Codice descrizione | codice_descrizione |
| TBDSRE | Budget Report | budget_report |

→ Pagina `/cont-generale/causali` con tabs per ogni tipo tabella, CRUD inline.

#### 2. Primanota Contabilità Generale
Nuova tabella `primanota_generale`:
- `id`, `numero_pn`, `data_pn`, `numero_protocollo`, `data_protocollo`, `numero_documento`, `data_documento`
- `fornitore_id` → FK `fornitori`
- `causale_id` → FK `causali_contabili`
- `ufficio_id` (centro di costo = ufficio)
- `tipo` (EE, EC, ecc.), `descrizione`, `totale`, `imponibile`, `aliquota_ritenuta`, `ritenuta`, `non_soggetto`, `altri_importi`
- `stato` (bozza, registrata, verificata)

→ Pagina con tabella, filtri (data, fornitore, causale, ufficio/centro costo), dialog inserimento.

#### 3. Scadenziario
Nuova tabella `scadenziario`:
- `id`, `fornitore_id`, `descrizione`, `importo`, `data_scadenza`, `data_pagamento`, `stato` (aperta, pagata, scaduta)
- `primanota_id` (collegamento opzionale), `ufficio_id`

→ Pagina con vista calendario/lista, filtri per stato e periodo, alert scadenze imminenti.

#### 4. Elaborazioni Periodiche
Nuova tabella `elaborazioni_periodiche`:
- `id`, `tipo` (liquidazione_iva, ritenute, chiusura_periodo), `periodo_da`, `periodo_a`, `ufficio_id`
- `stato` (da_elaborare, elaborata, confermata), `risultato_json`, `created_at`, `eseguita_da`

→ Pagina con lista elaborazioni eseguite, bottone per lanciare nuova elaborazione con parametri.

#### 5. Import Bancario (ricollocazione)
Spostare `BancaImport` sotto `/cont-generale/import-bancario`. Collegare i movimenti importati ai fornitori e alla primanota.

#### 6. Clienti Contabilità (collegamento)
Pagina che mostra i clienti (da `profiles` con ruolo cliente) collegati ai movimenti contabili, con vista E/C per cliente e collegamento ai titoli.

#### 7. Dichiarativi e Certificazioni
Nuova tabella `certificazioni_cu`:
- `id`, `anno_fiscale`, `fornitore_id`, `codice_fornitore`, `nome_fornitore`
- `tipo_reddito` (EE, ecc.), `totale`, `imponibile`, `aliquota_ritenuta`, `ritenuta`, `non_soggetto`, `altri_importi`
- `stato` (bozza, generata, inviata), `ufficio_id`

Nuova tabella `elab_annuali`:
- `id`, `tipo` (cu, 770, iva_annuale), `anno`, `stato`, `risultato_json`, `ufficio_id`

→ Pagina Dichiarativi: import da Excel CU, generazione automatica da primanota, vista per fornitore con totali annuali.
→ Pagina Elab. Annuali: lista elaborazioni annuali (CU, 770, IVA annuale).

### Nuove voci sidebar Cont. Generale

```
Cont. Generale
├── Causali/Tabelle       (NUOVO)
├── Primanota             (da placeholder → pagina)
├── Scadenziario          (NUOVO)
├── Elab. Periodiche      (da placeholder → pagina)
├── Fornitori             (già fatto ✓)
├── Clienti               (da placeholder → pagina)
├── Import Bancario       (NUOVO - rilocazione BancaImport)
├── Elab. Annuali         (da placeholder → pagina)
└── Dichiarativi/CU       (da placeholder → pagina)
```

### Migration DB
Una singola migration con:
- `causali_contabili` + seed dati iniziali (9 tipi)
- `primanota_generale` con FK a fornitori, causali, uffici
- `scadenziario` con FK a fornitori, primanota
- `elaborazioni_periodiche`
- `certificazioni_cu` con FK a fornitori
- `elab_annuali`
- RLS su tutte (admin full, cfo/contabilità select, ufficio own)

### Import dati CU dal file Excel
Script per parsare `CU_DettMov_20260320132933.xlsx` e inserire i record in `certificazioni_cu` collegando per codice fornitore.

### File coinvolti

| Azione | File |
|--------|------|
| Migration | 6 nuove tabelle + RLS + seed causali |
| Creare | `src/pages/contGenerale/CausaliPage.tsx` |
| Creare | `src/pages/contGenerale/PrimanotaGeneralePage.tsx` |
| Creare | `src/pages/contGenerale/ScadenziarioPage.tsx` |
| Creare | `src/pages/contGenerale/ElabPeriodichePage.tsx` |
| Creare | `src/pages/contGenerale/ClientiContabPage.tsx` |
| Creare | `src/pages/contGenerale/DichiarativiCUPage.tsx` |
| Creare | `src/pages/contGenerale/ElabAnnualiPage.tsx` |
| Modificare | `src/App.tsx` — nuove rotte, rimuovere PlaceholderPage |
| Modificare | `src/components/AppSidebar.tsx` — aggiungere Causali, Scadenziario, Import Bancario |
| Modificare | `src/components/PageBreadcrumb.tsx` — nuovi path labels |
| Aggiornare | `src/integrations/supabase/types.ts` — tipi generati |
| Script | Import dati CU da Excel |

