---
name: RCA voci composizione premio (Firma + Quietanza)
description: Due card gemelle in TitoloDetail (Firma e Quietanza) con mirroring DB automatico, override per riga e RCA Auto obbligatoria
type: feature
---

Polizze su rami Auto (`isRamoAuto`) mostrano nella sezione **Importi** due card `VociRcaCard` affiancate (`tipoPremio="firma"` e `tipoPremio="quietanza"`).

## Schema `premi_garanzia_polizza`
- `tipo_premio` text NOT NULL DEFAULT 'firma' — check `('firma','quietanza')`.
- `quietanza_personalizzata` boolean DEFAULT false — true ⇒ riga Quietanza non viene più sovrascritta dal mirror.
- `voce_origine_id` uuid FK self ON DELETE SET NULL — link riga Quietanza → Firma.
- Unique index parziale `(titolo_id, tipo_premio) WHERE is_rca_principale=true`.

## Mirroring DB
- Funzione `sync_quietanza_da_firma(p_titolo_id uuid)` SECURITY DEFINER + trigger `premi_garanzia_sync_quietanza` AFTER INSERT/UPDATE/DELETE su righe `tipo_premio='firma'`.
- RPC `sync_quietanza_da_firma` invocata su click "Risincronizza" (resetta `quietanza_personalizzata=false`).

## UI
- Firma → card teal, alimenta `titoli.premio_netto / tasse / premio_lordo` via debounced UPDATE 800ms.
- Quietanza → card amber, alimenta `titoli.premio_netto_quietanza / tasse_quietanza`.
- Edit/INSERT/DELETE su card Quietanza marcano `quietanza_personalizzata=true`.
- Riga **RCA Auto** sempre presente, non rimovibile.

## Calcolo
- Voci accessorie: `lordo = netto × (1 + aliquota%/100)`, default `13.5%`.
- **RCA principale (formula corretta normativa)**:
  - `imposta = netto × aliquota_provinciale%`
  - `ssn = netto × 10.5%` (SSN si calcola sul **netto**, non sull'imposta)
  - `lordo = netto + imposta + ssn`
  - Inverso lordo→netto: `factor = 1 + aliquota_provinciale% + 10.5%` ⇒ `netto = lordo/factor`
- Aliquota provinciale precompilata da `cliente.provincia_residenza` via `aliquote_provinciali_rca`, default 16%, eccezioni 9% AO/BZ/TN.

## Override manuale IPT/SSN (riga RCA)
- Le sub-righe "Imposta provinciale" e "Contributo SSN" sono **Input editabili** sia desktop che mobile.
- Override rilevato confrontando il valore salvato con quello calcolato (tolleranza 0,01 €): badge "manuale" (amber) + bottone ↺ per ripristinare.
- Edit del **Lordo** azzera gli override (toast informativo) e rientra in modalità automatica.
- Edit del **Netto** o dell'**aliquota provinciale** mantiene gli override già impostati (toast "Sovrascrittura IPT/SSN mantenuta").
- L'override lavora sulla colonna `imposta_provinciale` e `ssn` di `premi_garanzia_polizza`, nessuna nuova colonna richiesta.
