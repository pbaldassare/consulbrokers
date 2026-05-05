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
- Unique index parziale `(titolo_id, tipo_premio) WHERE is_rca_principale=true` (sostituisce il vecchio `uniq_rca_principale_per_titolo`).

## Mirroring DB
- Funzione `sync_quietanza_da_firma(p_titolo_id uuid)` SECURITY DEFINER: rimuove orfani Quietanza non personalizzati, crea gemelle mancanti, riallinea quelle non personalizzate.
- Trigger `premi_garanzia_sync_quietanza` AFTER INSERT/UPDATE/DELETE su righe `tipo_premio='firma'` chiama la funzione.
- RPC `sync_quietanza_da_firma` invocata dal componente quando l'utente clicca "Risincronizza" sulla card Quietanza (dopo aver resettato `quietanza_personalizzata=false` per quel titolo).

## UI
- Firma → card teal, alimenta `titoli.premio_netto / tasse / premio_lordo` via debounced UPDATE 800ms.
- Quietanza → card amber, alimenta `titoli.premio_netto_quietanza / tasse_quietanza`, `addizionali_quietanza=0` (tasse include IPT+SSN+accessorie). Badge "Sincronizzata" o "Personalizzata" + bottone "Risincronizza".
- Edit/INSERT/DELETE su card Quietanza marcano automaticamente `quietanza_personalizzata=true`.
- Riga **RCA Auto** sempre presente (auto-creata sulla Firma; per la Quietanza nasce dal trigger), non rimovibile.

## Calcolo
- Voci accessorie: `lordo = netto × (1 + aliquota%/100)`, default `13.5%`.
- RCA principale: `imposta = netto × aliquota_provinciale%`, `ssn = imposta × 10.5%`, `lordo = netto + imposta + ssn`.
- Aliquota provinciale precompilata da `cliente.provincia_residenza` via `aliquote_provinciali_rca`, default 16%, eccezioni 9% AO/BZ/TN.
