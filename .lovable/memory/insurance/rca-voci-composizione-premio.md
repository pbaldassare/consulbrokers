---
name: RCA voci composizione premio
description: Tab Voci RCA in TitoloDetail con riga RCA Auto obbligatoria, calcolo SSN 10,5% sull'imposta provinciale variabile per provincia
type: feature
---

Polizze su rami Auto (`isRamoAuto` → codici RV*, PI/QA/QC/QF/QG/QR/QU/DAB/PJ o descrizione AUTO/VEICOL) mostrano tab "Voci RCA" in `TitoloDetail.tsx`.

- Voci persistite in `premi_garanzia_polizza` con colonne aggiuntive: `is_rca_principale`, `aliquota_tasse_pct`, `lordo_calcolato`, `imposta_provinciale`, `ssn`, `codice_garanzia`. Unique index su `is_rca_principale=true` per titolo.
- Riga **RCA Auto** sempre presente (auto-creata se mancante), non rimovibile.
- Calcolo:
  - Voci accessorie: `lordo = netto × (1 + aliquota%/100)`, default `22.25%`, override per voce da `rca_garanzie.aliquota_tasse`.
  - RCA principale: `imposta = netto × aliquota_provinciale%`, `ssn = imposta × 10.5%`, `lordo = netto + imposta + ssn`.
- Aliquota provinciale da `aliquote_provinciali_rca` (PK provincia char(2)), default 16%, eccezioni 9% per AO/BZ/TN. Precompilata da `cliente.provincia_residenza`, editabile inline.
- Catalogo voci aggiungibili da `rca_garanzie` (escluso codice `RCA`), via Popover+Command.
- Audit trigger `audit_row_changes('voce_rca')` su `premi_garanzia_polizza`.
- Card totali con badge quadratura vs `titoli.premio_lordo` (tolleranza 0.5€).
