# Fix Tasse: aliquota fissa da DB + SSN aggiuntivo per RCA

## Errore attuale
Per le righe RCA principale (QA, PI, QC, QN…) il codice usa `IPT_RCA_PCT = 16` hardcoded e ignora `rami.aliquota_tasse_ramo`. Per le voci accessorie l'aliquota da DB è già usata, ma se l'utente cambia il netto l'utente percepisce le tasse "che si modificano" perché ricalcoliamo ogni volta.

In realtà la regola corretta richiesta è: **l'aliquota tasse di ogni sottoramo è fissa e proviene dal DB (`rami.aliquota_tasse_ramo`)**. Per i sottorami RCA principali (set `RCA_PRINCIPALE_CODES`) si aggiunge **SSN 10,5%** sul netto, **distinto** dalla quota IPT ma **sommato** nel campo Tasse.

DB conferma: QA/PI/QC/QF/QG/QR/QU/QN/QT = 16%, QAC/DAB/QB = 12,5%, DN = 7,5%, PJ = 0%. L'aliquota va presa da lì, **non** hardcoded.

## Modifiche

### `src/lib/rcaPrincipaleCodes.ts`
- Mantieni `SSN_PCT = 10.5`.
- **Rimuovi** `IPT_RCA_PCT` (non più usato; l'IPT è `rami.aliquota_tasse_ramo`).

### `src/components/polizze/PremiGaranziaCardShell.tsx`
Regola unica per tutte le righe:
```
ipt   = round2(netto × aliquotaTasse / 100)            // da DB, fissa per sottoramo
ssn   = isRcaPrincipale ? round2(netto × 10.5 / 100) : 0
tasse = ipt + ssn
lordo = netto + tasse
```

1. **`handleGaranziaSelect`**: salva `aliquotaTasse = sel.aliquota_tasse_ramo` (sempre, anche RCA). Per RCA imposta `isRcaPrincipale=true`, `aliquotaProvinciale = aliquotaTasse` (per persistenza). Calcola `imposta`, `ssn` (solo se RCA), `tasse`.
2. **`handleNettoChange`**: ricalcola `imposta = netto × aliquotaTasse%`, `ssn = isRca ? netto × 10.5% : 0`, `tasse = imposta + ssn`. **Non cambia mai l'aliquota** (resta quella DB).
3. **`handleLordoChange`**:
   - RCA: `factor = 1 + (aliquotaTasse + 10.5)/100` ⇒ `netto = lordo/factor`, ricalcola.
   - Non-RCA: `factor = 1 + aliquotaTasse/100` ⇒ `netto = lordo/factor`.
4. **Colonna Tasse** (read-only): mostra `imposta + ssn`. Tooltip:
   - RCA: `"IPT {aliquotaTasse}% + SSN 10,5%"`
   - Non-RCA: `"Aliquota {aliquotaTasse}%"`
5. **Totali**: `totTasse = Σ (imposta||tasse) + Σ ssn`. `lordo = totNetto + totTasse + addizionali`.
6. **Lordo riga** = `netto + tasse` (sempre incluso, già corretto).

### `src/pages/ImmissionePolizzaPage.tsx`
- `aliquota_tasse_pct` salvato = `r.aliquotaTasse` (DB), **non più 16 hardcoded**.
- `imposta_provinciale` = `r.imposta`, `ssn` = `r.ssn` (solo RCA).
- Totali invariati: `tasseNum = Σ parseFloat(r.tasse)`.

### `.lovable/memory/insurance/rca-voci-composizione-premio.md`
- "IPT 16% fissa" → "IPT = `rami.aliquota_tasse_ramo` (DB, fissa per sottoramo)".
- SSN 10,5% solo per `RCA_PRINCIPALE_CODES`, sommato a IPT nel campo Tasse, distinto in DB (`ssn`).
- Esempio: QA netto 1000 → IPT 160 (16%) + SSN 105 (10,5%) = Tasse 265, Lordo 1265.
- QAC netto 1000 → IPT 125 (12,5% da DB) + SSN 105 = Tasse 230, Lordo 1230.

## Verifica
1. QA, netto 1000 → Tasse 265,00 (160 + 105), Lordo 1265,00. Tooltip "IPT 16% + SSN 10,5%".
2. QAC, netto 1000 → Tasse 230,00 (125 + 105), Lordo 1230,00.
3. QB (no RCA), netto 1000 → Tasse 125,00, Lordo 1125,00.
4. Cambio Lordo a 1265 su QA → Netto torna 1000.
5. L'aliquota DB non si modifica mai cambiando netto/lordo.

## Fuori scope
`VociRcaCard` post-creazione, RLS, trigger, mirror Quietanza.
