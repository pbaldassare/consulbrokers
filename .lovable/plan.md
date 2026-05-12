## Obiettivo
Caricare nel sistema 5 polizze d'esempio (dai PDF allegati) associandole al cliente **Comune di Varese** (id `94dc5a3c-1682-4aea-a9e2-190bf8bf34b1`), riusando i dati reali estratti dai PDF (premi, decorrenze, scadenze, garanzie) e adattando solo Contraente/CF/indirizzo al Comune di Varese. I file PDF originali vengono caricati su Storage e collegati ai rispettivi titoli come allegati visibili al cliente.

## Dati estratti dai PDF (riusati 1:1 tranne contraente)

| # | Numero polizza nuovo | Compagnia | Ramo / Prodotto | Decorrenza | Scadenza | Frazion. | Premio netto | Tasse | Premio lordo | File allegato |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | DEMO-VA-2026-010 | XL Insurance Company SE (AXA XL) | All Risks Property | 30/09/2024 | 30/09/2026 | Annuale | 21.556,97 | 4.796,42 | **26.353,39** | All_Risk_compressed.pdf |
| 2 | DEMO-VA-2026-011 | Net Insurance (Special Risk Underwriting) | Tutela Legale Enti Pubblici | 30/09/2023 | 30/09/2026 | Annuale | 3.468,48 | 731,52 | **4.200,00** | Tutela_Legale.PDF |
| 3 | DEMO-VA-2026-012 | UnipolSai Assicurazioni | Cyber Risk PA (ramo 190) | 30/09/2023 | 30/09/2026 | Annuale | 4.112,41 | 887,59 | **5.000,00** | Polizza_Cyber_Risk.pdf |
| 4 | DEMO-VA-2026-013 | Nobis (Ag. Galgano) | RC Generale Enti Pubblici (RCT/O) | 30/09/2023 | 30/09/2026 | Annuale | 13.070,28 | 2.908,14 | **15.978,42** | RCT-O_2023-2026.pdf |
| 5 | DEMO-VA-2026-014 | UnipolSai Assicurazioni | RC Natanti (cumulativa) | 30/09/2023 | 30/09/2026 | Annuale | 47,05 | 8,95 | **56,00** | RC_Natanti.pdf |

Contraente per tutte: **COMUNE DI VARESE** (CF/PIVA del cliente esistente). Indirizzo: quello del cliente in DB. CIG: dove presente sul PDF lo riportiamo in `cig_rif`. Sede: SEDE SAN DONA' DI PIAVE (come da memory demo).

## Esecuzione (tutto via Edge Function / migration, niente UI)

### Step 1 — Mapping anagrafiche
Cercare in DB gli `id` di:
- compagnie: XL Insurance, Net Insurance, UnipolSai, Nobis. Se mancanti → INSERT minimal in `compagnie` (marcate `[DEMO]` in note).
- rami: "All Risks", "Tutela Legale", "Cyber", "RC Generale", "RC Natanti". Match per nome o creazione minima.
- ufficio: SEDE SAN DONA' DI PIAVE (id già noto).

### Step 2 — Insert in `titoli`
Una riga per polizza con: `cliente_id`, `compagnia_id`, `ramo_id`, `ufficio_id`, `numero_titolo`, `prodotto_nome` (testo libero dal PDF), `descrizione_polizza`, `durata_da/a`, `garanzia_da/a`, `data_scadenza`, `premio_netto`, `tasse`, `premio_lordo`, `periodicita='annuale'`, `tacito_rinnovo` (true per Tutela/RCT-O/Cyber che lo prevedono), `cig_rif`, `stato='attivo'`, `note='[DEMO] Caricata da PDF esempio'`. Per la polizza Natanti, `targa_telaio` valorizzato come "NATANTE" (no targa specifica nel PDF base).

### Step 3 — Upload PDF + record `documenti`
Per ogni polizza:
1. Upload del PDF nel bucket **`documenti_titoli`** con path `{titolo_id}/{nome_file}.pdf`.
2. INSERT in `documenti`: `entita_tipo='titolo'`, `entita_id={titolo_id}`, `bucket_name='documenti_titoli'`, `path_storage`, `nome_file`, `categoria='polizza_originale'`, `visibile_al_cliente=true`.

### Step 4 — Verifica
- Login portale cliente (protocollo@comune.it) → /cliente/polizze deve mostrare le 5 nuove polizze sotto le esistenti DEMO-VA-*.
- Click su una polizza → tab Documenti mostra il PDF originale scaricabile.

## Note
- I dati finanziari restano marcati `[DEMO]` per essere esclusi dai report reali (regola in memory `real-data-preference`).
- Nessuna modifica a UI, business logic o schema: solo seed dati + upload file.
- Non vengono creati sinistri o appendici: solo i 5 titoli con i rispettivi PDF allegati.

Confermi che procedo con questo seed?