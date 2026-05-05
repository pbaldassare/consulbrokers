## Obiettivo

Nelle card **Composizione Premio (Firma + Quietanza)** rendere ogni voce completamente editabile in autonomia e far ricalcolare **Totale Netto**, **Totale Tasse** e **Premio Lordo** **in tempo reale** mentre l'utente digita (oggi i totali si aggiornano solo dopo `blur` + refetch del DB).

## Problema attuale (`src/components/polizze/VociRcaCard.tsx`)

- Tutti gli input usano `defaultValue` (uncontrolled) con `key` legata al valore salvato. I totali (`useMemo` su `voci`) si aggiornano solo dopo che la mutation è andata a buon fine e il refetch porta nuovi dati.
- L'utente vede il riquadro Totali "fermo" finché non esce dal campo → percezione di calcolo non reattivo.
- Sulla riga **RCA principale** la cella "Aliquota %" è in sola lettura (mostra `{aliquotaProv}% + SSN`); non si può modificare l'aliquota provinciale dalla riga (solo dall'header o dalle sub-righe IPT/SSN).

## Soluzione

### 1. Stato "draft" controllato per editing live

Introdurre uno stato locale `draftVoci: Record<id, Partial<Voce>>` che mantiene le modifiche in corso prima del salvataggio. Tutti gli input diventano **controlled**: 
- `onChange` → aggiorna `draftVoci[id]` (e ricomputa i totali immediatamente)
- `onBlur` → invoca le mutation esistenti (`handleNettoBlur`, `handleLordoBlur`, ecc.) e svuota la entry del draft per quel campo

`useMemo` totali lavora su `vociMerged = voci.map(v => ({...v, ...draftVoci[v.id]}))` invece che su `voci` raw → totali aggiornati ad ogni keystroke.

Si applica a **entrambi i layout** (desktop table + mobile cards) e a **tutti i campi editabili**: netto, lordo, aliquota accessoria, IPT, SSN.

### 2. Editabilità completa riga RCA principale

Sostituire la cella "Aliquota %" della riga RCA (oggi `<span>{aliquotaProv}% + SSN</span>`) con un piccolo Input editabile che chiama `handleAliquotaProvChange` (handler già esistente). Stesso comportamento sul mobile. L'aliquota resta visualizzata anche nell'header (resta sincronizzata via stato).

### 3. Coerenza calcolo live ↔ salvato

`calcolaLordo` viene già chiamato lato client su ogni voce: usandolo sui dati `merged` (draft + DB), Totale Netto / Tasse / Lordo / IPT / SSN / Acc. nei totali si aggiornano in tempo reale. Le mutation di salvataggio (e il propagare a `titoli.premio_*` via `onTotaliChange`) restano invariate e partono on-blur.

### 4. Riquadro Totali

I 3 input editabili (IPT / SSN / Acc.) restano on-blur (richiedono ricalcolo distribuito sulle voci accessorie via mutation), ma i loro `defaultValue` sono già keyed sul totale calcolato → con i totali live aggiornati il valore mostrato segue l'utente.

## File toccati

- `src/components/polizze/VociRcaCard.tsx` — stato `draftVoci`, conversione input a controlled, totali da `vociMerged`, riga RCA con aliquota provinciale editabile inline.

## Note

- Nessuna migration DB.
- Comportamento di mirroring Firma→Quietanza, override IPT/SSN, e sync di `titoli.premio_netto/tasse/lordo` rimane invariato (le mutation partono comunque on-blur).
- Validazioni esistenti (range 0–1.000.000 €, aliquota 0–100%) restano nei rispettivi handler `*Blur`.
