---
name: RCA voci composizione premio (Firma + Quietanza)
description: Due card gemelle in TitoloDetail (Firma e Quietanza) con mirroring DB automatico, override per riga e RCA Auto obbligatoria
type: feature
---

Polizze su rami Auto **e Natanti/Nautica** (`isRamoAuto` esteso) mostrano nella sezione **Importi** due card `VociRcaCard` affiancate (`tipoPremio="firma"` e `tipoPremio="quietanza"`) e il pulsante **Importa con AI** (`ImportPolizzaAiButton`).

Rami coperti: auto (`PI, QA, QAC, QC, QF, QG, QR, QU, DAB, PJ, RV*`) + natanti/nautica (`QN, QT, QNA, DD, DN, DNA, RV10, RV11`). La label della riga principale è dinamica: `RCA Auto` per auto, `RC Natanti` per QN/QT/QNA/RV10/RV11, `Corpi Nautica` per DD/DN/DNA. Il prop `mainLabel` di `VociRcaCard` e `ramo` di `ImportPolizzaAiButton` calcolano l'etichetta in base al ramo.

In **Immissione Polizza** la card è gestita da `PremiGaranziaCardShell`. Quando il `codice` del sottoramo è in `RCA_PRINCIPALE_CODES` (`src/lib/rcaPrincipaleCodes.ts`), la riga è marcata `isRcaPrincipale=true` e calcola **IPT 16% fissa** (`IPT_RCA_PCT`) + **SSN 10,5%** (`SSN_PCT`) sul netto. La colonna "Tasse €" è **read-only**: mostra `IPT + SSN` per RCA, `netto × aliquota_tasse_ramo%` per le voci accessorie. **Premio Lordo riga = Netto + Tasse** in tutti i casi (anche RCA). In Immissione non si fa lookup `aliquote_provinciali_rca`: l'aliquota è fissa 16% conforme a normativa post-riforma. Salvataggio su `premi_garanzia_polizza`: `is_rca_principale`, `imposta_provinciale`, `ssn`, `aliquota_tasse_pct=16`.

## Schema `premi_garanzia_polizza`
- `tipo_premio` text NOT NULL DEFAULT 'firma' — check `('firma','quietanza')`.
- `quietanza_personalizzata` boolean DEFAULT false — true ⇒ riga Quietanza non viene più sovrascritta dal mirror.
- `voce_origine_id` uuid FK self ON DELETE SET NULL — link riga Quietanza → Firma.
- Unique index parziale `(titolo_id, tipo_premio) WHERE is_rca_principale=true`.

## Mirroring DB
- Funzione `sync_quietanza_da_firma(p_titolo_id uuid)` SECURITY DEFINER + trigger `premi_garanzia_sync_quietanza` AFTER INSERT/UPDATE/DELETE su righe `tipo_premio='firma'`.
- **GRANT EXECUTE TO authenticated** è obbligatorio per la chiamata RPC dal client (pulsante "Risincronizza"). Senza grant l'RPC fallisce con 404.
- RPC `sync_quietanza_da_firma` invocata su click "Risincronizza" (resetta `quietanza_personalizzata=false`). Fallback client-side: DELETE righe quietanza non personalizzate + reinsert da firma.

## UI
- Firma → card teal, alimenta `titoli.premio_netto / tasse / premio_lordo` via debounced UPDATE 800ms.
- Quietanza → card amber, alimenta `titoli.premio_netto_quietanza / tasse_quietanza`.
- Edit/INSERT/DELETE su card Quietanza marcano `quietanza_personalizzata=true`.
- Riga **RCA Auto** sempre presente, non rimovibile.
- Provvigioni Firma/Quietanza editate dalla card → DB UPDATE su `titoli.provvigioni_*` + `refetchQueries(["titolo", id])` (sincrono, garantisce refresh split commerciale/agenzia).

## Calcolo
- Voci accessorie: `lordo = netto × (1 + aliquota%/100)`, default `13.5%`.
- **RCA principale (formula corretta normativa)**:
  - `imposta = netto × aliquota_provinciale%`
  - `ssn = netto × 10.5%` (SSN si calcola sul **netto**, non sull'imposta)
  - `lordo = netto + imposta + ssn`
  - Inverso lordo→netto: `factor = 1 + aliquota_provinciale% + 10.5%` ⇒ `netto = lordo/factor`

## Override manuale IPT/SSN
- Sub-righe RCA editabili (desktop ≥1024px e mobile/tablet <1024px). Override rilevato con tolleranza 0,01 €.
- Edit Lordo azzera override; edit Netto/aliquota mantiene override.
- Pulsante "Ricalcola IPT/SSN" nell'header per ripristino al volo.

## Totali editabili
Riquadro "Totali" → blocco "Totale Tasse" contiene 3 input affiancati: **IPT**, **SSN**, **Tasse accessorie**.
- IPT/SSN → `handleImpostaOverrideBlur`/`handleSsnOverrideBlur` sulla riga RCA principale.
- Tasse accessorie → ricalcola `aliquota_tasse_pct = (val / Σ netto accessorie) × 100` applicata a tutte le voci non-RCA.
