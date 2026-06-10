---
name: Messa a cassa con compensazioni contabili
description: Quadratura messa a cassa con anticipi cliente + causali di compensazione (abbuoni/sconti/spese); dialog unificato; scritture in movimenti_contabili
type: feature
---
# Messa a Cassa — Anticipi + Compensazioni

Formula di quadratura applicata nel dialog:
```
Dovuto finale = Premio lordo + Σ compensazioni segno '-' (aumentano dovuto) − Σ compensazioni segno '+' (riducono dovuto)
Coperto       = Cash/bonifico + Anticipi utilizzati
Delta         = Dovuto finale − Coperto   →  deve essere 0 (tolleranza 0,01)
```
Esempio: lordo 1.200 €, abbuono attivo 50 € → dovuto 1.150 €; cliente bonifica 1.150 € → quadrato.

## Tabelle
- `causali_contabili.segno_default` (`+` riduce / `-` aumenta).
- `tipo_tabella = 'compensazione_messa_cassa'` con 6 seed: `ABB_ATT, ABB_PAS, SCONTO, ARROT_A, ARROT_P, SPESE`.
- `titoli_compensazioni`: snapshot per titolo (titolo_id ON DELETE CASCADE, causale_id, codice/descrizione snapshot, importo>0, segno, note).

## Dialog unificato
- `src/components/portafoglio/MessaCassaDialog.tsx` è ora usato sia da `PortafoglioCaricoPage` che da `TitoloDetail` (il dialog proprietario è stato rimosso). Risolve la limitazione storica documentata in `mem://accounting/anticipi-cliente`.
- Sezione "Compensazioni contabili" visibile **solo single-titolo** (bulk → nascosta, messaggio dedicato).
- Bottone Conferma disabilitato finché `delta ≠ 0`.
- Auto-quadratura: bottone calcolatrice imposta cash = dovuto − anticipi.

## Persistenza al conferma
1. UPDATE `titoli` (stato=incassato, importo_incassato = solo parte cash, tipo_pagamento esteso con `compensato`/`misto_compensato`).
2. INSERT `cliente_anticipi_utilizzi` (trigger esistente scala residuo).
3. INSERT `titoli_compensazioni`.
4. INSERT `movimenti_contabili` (uno per compensazione, `categoria='compensazione_titolo'`, `riferimento_tipo='titolo'`, `tipo = uscita` se segno '+' (costo per agenzia) / `entrata` se segno '-').
5. Auto-quietanza trigger DB invariato. `notifica-messa-cassa-agenzia` invariato.

## Annullamento
`annullaMessaACassa.ts` ora elimina anche `titoli_compensazioni` (oltre a anticipi_utilizzi e movimenti_contabili già gestiti). Il cascade su annullamento polizza copre tutto via FK ON DELETE CASCADE.

## TODO
- CRUD "Causali Compensazione" in `/tabelle-base` (oggi gestibili solo via SQL/Supabase Studio).
- Render righe compensazione in `ec-cliente-pdf.ts`.
