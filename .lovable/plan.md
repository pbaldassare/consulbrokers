## Problema

Nelle ultime iterazioni ho introdotto due errori che vanno corretti:

1. La colonna "Tasse" è stata trasformata in input editabile separato dalla colonna IPT/SSN, creando due colonne sovrapposte e confuse ("Tasse / IPT + SSN €" e "Tasse €").
2. Per le righe RCA principale (es. **QA — R.C. AUTO**) IPT e SSN sono stati esclusi dal Premio Lordo, mentre devono concorrere al lordo come per qualsiasi altra voce.

## Comportamento corretto richiesto

- **Tasse**: campo **fisso, calcolato, non editabile** (sola lettura).
- **Premio Lordo di riga** = `Premio Netto + Tasse` (sempre, anche RCA).
- **Ramo QA — R.C. AUTO** (e altri RCA principale): `Tasse = Netto × 16%  +  Netto × 10,5%` (IPT 16% fissa + SSN 10,5%). Niente lookup provinciale, niente input separati IPT/SSN nella tabella.
- **Voci accessorie**: `Tasse = Netto × aliquota_tasse_ramo%` (come oggi).
- **Totali card**: `Totale Tasse = Σ tasse di riga`; `Premio Lordo = Σ Netto + Σ Tasse + Addizionali`.

## Modifiche

### `src/components/polizze/PremiGaranziaCardShell.tsx`
1. **Header tabella**: rimuovere la colonna duplicata. Restano: Voce | Premio Netto | **Tasse €** (read-only) | Premio Lordo | azioni.
2. **Cella Tasse di riga**: sempre testo read-only (`<span>` con valore calcolato), nessun input IPT/SSN inline e nessun input "Tasse" editabile.
3. **Calcolo riga RCA principale**: `tasse = round2(netto × 16%) + round2(netto × 10,5%)`. Aliquota fissa **16%** (cost. `IPT_RCA_PCT = 16`), nessuna query a `aliquote_provinciali_rca`, rimuovere `useEffect` di lookup, `provinciaCliente`, stato `aliquotaProv`.
4. **`handleNettoChange`** (RCA): ricalcola `imposta = netto*16%`, `ssn = netto*10.5%`, `tasse = imposta+ssn`. Mantiene i campi `imposta`/`ssn`/`aliquotaProvinciale=16` solo per persistenza DB.
5. **`handleLordoChange`** (RCA): `factor = 1 + 16/100 + 10.5/100 = 1.265`; `netto = lordo / factor`; ricalcola imposta/ssn/tasse coerenti. Per non-RCA invariato.
6. **`handleGaranziaSelect`** (RCA): inizializza con `aliquotaProvinciale = 16`, IPT/SSN su netto corrente.
7. **Totali**: rimuovere `totTasseLordo`. `lordo = totNetto + totTasse + add` (sempre, anche con righe RCA).
8. **Rimuovere** `handleImpostaChange`, `handleSsnChange` e relativi handler/override IPT/SSN inline.
9. Rimuovere prop `provinciaCliente` da `PremiGaranziaCardShellProps`.

### `src/pages/ImmissionePolizzaPage.tsx`
1. Rimuovere helper `sumTasseLordo`. Tornare a:
   - `tasseNum = Σ parseFloat(r.tasse)` su `premiFirmaRows`
   - `tasseQNum = Σ parseFloat(r.tasse)` su `premiQuietanzaRows`
   - `totFirma = premioNettoNum + addizionali + tasseNum`
   - `totQuietanza = premioNettoQNum + addizionaliQuietanza + tasseQNum`
2. Salvataggio `premi_garanzia_polizza`: invariato (`is_rca_principale`, `imposta_provinciale`, `ssn`, `aliquota_tasse_pct = 16` per RCA).
3. Rimuovere passaggio prop `provinciaCliente` ai due `PremiGaranziaCardShell`.

### `src/lib/rcaPrincipaleCodes.ts`
Aggiungere `export const IPT_RCA_PCT = 16;` accanto a `SSN_PCT = 10.5`.

### `.lovable/memory/insurance/rca-voci-composizione-premio.md`
Aggiornare la sezione "Calcolo" e "Immissione Polizza":
- IPT fissa 16% (non più lookup provinciale) in fase Immissione.
- IPT/SSN concorrono al Premio Lordo: `lordo = netto + IPT + SSN` per riga RCA.
- Tasse di riga sempre read-only nella card di Immissione.
- Rimuovere nota "tasse RCA non si riportano sul lordo" introdotta erroneamente.

## Fuori scope
- `VociRcaCard` di `TitoloDetail` (post-creazione) resta com'è.
- Nessuna modifica DB, RLS, trigger, mirror Quietanza.
- Nessuna modifica a Rinnovo / Duplicazione / Sospensione / Riattivazione.

## Verifica UI
1. Su `/portafoglio/immissione`, ramo Auto, sottoramo QA: imposto Netto = 1000 → Tasse mostra **265,00** (160 IPT + 105 SSN), Premio Lordo riga = **1.265,00**, Totale Tasse = 265,00, Premio Lordo card = 1.265,00 + addizionali.
2. Modifica Premio Lordo riga a 1265 → Netto torna 1000.
3. Voce accessoria DRA — A.R.D con netto 100 e aliquota 13,5% → tasse 13,50 read-only, lordo 113,50.
4. Nessun input editabile nella colonna Tasse.
