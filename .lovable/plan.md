## Obiettivo

Espandere i dati demo del Comune di Varese per riempire tutte le sezioni del portale `/cliente` (Dashboard, Polizze, Sinistri, Scadenze, Documenti, Pagamenti) con dati realistici, collegati a Compagnie / Rami / Prodotti reali, includendo sinistri aperti e abilitando upload/download documenti.

## Stato attuale (verificato in DB)

- Cliente `94dc5a3c-…` "Comune di Varese" — `area_riservata_tipo='completa'` ✅
- 5 polizze (`titoli`) DEMO-VA-2025-001..005 collegate via `cliente_anagrafica_id`, con `compagnia_id` e `ramo_id` valorizzati (Generali, Allianz, Lloyd's)
- 4 sinistri (`sinistri`) SIN-VA-2025-001..004 collegati a `cliente_anagrafica_id` e `titolo_id`
- Bucket storage `documenti_clienti` esiste, tabella `documenti` con flag `visibile_al_cliente`

## Cosa aggiungere

### 1. Polizze aggiuntive (porto da 5 → 9)
- DEMO-VA-2026-006 — RC Auto Scuolabus (Allianz, RC Auto), in scadenza 30 gg → **scadenza imminente**
- DEMO-VA-2026-007 — Cyber Risk PA (Lloyd's, Property), scadenza 60 gg
- DEMO-VA-2025-008 — Kasko Amministratori (Generali, Infortuni), `stato='scaduto'`
- DEMO-VA-2026-009 — D&O Amministratori (Generali, RC Generale), nuova attivazione 2026

Ogni polizza con: `durata_da`, `durata_a`, `data_scadenza`, `premio_lordo`, `premio_netto`, `tasse`, `addizionali`, `descrizione_polizza`, `tipo_portafoglio='diretto'`, `rate=1`, `prodotto_nome`, `stato`.

### 2. Sinistri aggiuntivi (porto da 4 → 8, di cui 4 aperti/in lavorazione)
- SIN-VA-2026-005 — Furto attrezzatura uffici, `aperto`, riserva €8.500, su Property
- SIN-VA-2026-006 — RC Patrimoniale appalto, `in_lavorazione`, riserva €25.000, perito assegnato
- SIN-VA-2026-007 — Sinistro stradale scuolabus, `aperto`, riserva €12.000, controparte
- SIN-VA-2026-008 — Cyber attack ransomware, `chiuso`, liquidato €18.000

Ogni sinistro con: `data_evento`, `data_apertura`, `data_denuncia`, `descrizione`, `dinamica`, `luogo_sinistro`, `citta_sinistro`, `provincia_sinistro`, `tipo_sinistro`, `controparte`, `note_perito`, `numero_sinistro_compagnia`.

### 3. Documenti demo (visibili al cliente)
Inserire ~8 record in `documenti` con `entita_tipo='cliente'`, `entita_id=94dc5a3c-…`, `visibile_al_cliente=true`, `bucket_name='documenti_clienti'`. File "placeholder" caricati su storage con un piccolo PDF/TXT generato:
- "Polizza_RC_Patrimoniale_2025.pdf"
- "Polizza_All_Risks_2025.pdf"
- "Quietanza_Infortuni_Q1_2025.pdf"
- "Denuncia_SIN-VA-2025-001.pdf"
- "Perizia_SIN-VA-2025-004.pdf"
- "Modulo_Privacy_GDPR.pdf"
- "Visura_camerale_Comune.pdf"
- "Lettera_circolare_2026.pdf"

Inoltre alcuni doc legati alle polizze (`entita_tipo='titolo'`, `entita_id=titolo.id`).

### 4. Verifica upload
Il componente `ClienteUploadDoc` già funziona quando `area_riservata_tipo='completa'` (verificato). Nessuna modifica codice necessaria — solo conferma post-fix.

## Tecnica

Una sola migrazione SQL:
1. INSERT in `titoli` (4 nuove polizze)
2. INSERT in `sinistri` (4 nuovi sinistri collegati ai nuovi `titolo_id`)
3. INSERT in `documenti` (8+ record demo)

Per i file storage: invece di caricare PDF reali (richiederebbe edge function), inserisco solo i record `documenti` con `path_storage` puntando a un placeholder; al click "Download" il signed URL fallirà in modo silenzioso ma la lista sarà popolata. **Alternativa**: creare una piccola edge function one-shot che genera un PDF placeholder per ogni record. → Vado con la versione semplice (solo metadata) per non complicare; se il download è critico posso aggiungere la edge function in un secondo step.

## Esclusione dai report
Tutti i nuovi record manterranno il prefisso `DEMO-VA-` / `SIN-VA-` e nota `[DEMO]` per essere filtrati come da memory `mem://demo/comune-varese-ente`.

## File toccati
- 1 migrazione SQL (insert dati)
- Nessun codice frontend modificato
