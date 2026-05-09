## Obiettivo

Sostituire la legacy "Premi per Garanzia" (capitale/tasso/firma/rata/annuo) usata oggi nei rami non-auto con la stessa UI a card teal usata per RCA (Firma + Quietanza affiancate, zebra, edit inline, AI scan, totali sincronizzati al titolo). Nessun dato viene perso: la stessa tabella DB `premi_garanzia_polizza` viene continuata ad usare, e i campi `capitale`, `tasso`, `rata`, `annuo` vengono mantenuti come colonne opzionali nella nuova UI.

## Scope

**File toccati**
- `src/components/polizze/VociRcaCard.tsx` — estensione (no breaking changes per RCA)
- `src/pages/TitoloDetail.tsx` — sostituzione blocco `!isRamoAuto → SectionCollapsible "Premi per Garanzia"` con coppia `<VociRcaCard useAutoTaxFormula={false} />` (Firma + Quietanza)

**Fuori scope (questo turno)**
- Pagine Immissione/Rinnovi/Appendici/Duplicazione (le voci si gestiscono dopo la creazione, dal dettaglio)
- Modifiche schema DB
- Logica RCA esistente (resta invariata, default `useAutoTaxFormula=true`)

## Modifiche a VociRcaCard

### Nuove props (tutte opzionali, default = comportamento RCA attuale)
- `useAutoTaxFormula?: boolean = true` — già presente, controlla creazione riga RCA principale e visibilità sotto-righe IPT/SSN.
- `aliquotaDefault?: number` — aliquota tasse di default per nuove voci (per non-auto: `aliquota_tasse_ramo` letto da `rami` via prop). Sostituisce il fisso `13.5`.
- `mostraCampiCapitaleRata?: boolean = false` — quando `true` mostra le colonne **Capitale**, **Tasso ‰**, **Rata**, **Annuo** dopo "Premio Lordo".

### UI nuovo layout (rami non-auto)
Tabella con colonne:

```
Garanzia | Premio Netto | Aliquota % | Premio Lordo | Capitale | Tasso ‰ | Rata | Annuo | ⌫
```

- Niente sotto-righe IPT/SSN (gating `useAutoTaxFormula`).
- Niente input "Imposta provinciale" globale (gating `useAutoTaxFormula`).
- Stessi pattern: zebra, draft inline, blur-to-save, ⌫ trash con conferma, badge Quietanza personalizzata, "Riallinea Quietanza alla Firma".
- Header card resta teal coerente con RCA, ma il titolo cambia in **"Premi per Garanzia — Firma"** / **"... Quietanza"** (vs "Voci RCA Auto").

### Calcolo lordo (ramo non-auto)
- Solo formula semplice: `lordo = round2(netto × (1 + aliquota/100))`.
- `aliquota` di default = `aliquotaDefault` (passato dal parent) o `13.5` come fallback finale.
- `imposta_provinciale` e `ssn` restano `null` in DB (nessun cambiamento sui valori esistenti se la riga ce li avesse).

### Mutazione upsert
- Estesa per accettare `capitale`, `tasso`, `rata`, `annuo` quando `mostraCampiCapitaleRata=true`.
- Per RCA (default false) questi campi non vengono toccati: nessun rischio per voci esistenti.

## Modifiche a TitoloDetail

### Sostituzione del blocco "Premi per Garanzia" (linee ~3003-3085)

Sostituire l'intero `SectionCollapsible "Premi per Garanzia"` con:

```tsx
{!isRamoAuto((t as any).ramo) && (
  <SectionCollapsible title="Premi per Garanzia" icon={ShieldCheck}>
    <div className="space-y-4">
      <VociRcaCard
        tipoPremio="firma"
        useAutoTaxFormula={false}
        mostraCampiCapitaleRata
        mainLabel={(t as any).ramo?.descrizione || "Premio"}
        aliquotaDefault={(t as any).ramo?.aliquota_tasse_ramo ?? 22.25}
        titoloId={t.id}
        premioLordoTitolo={(t as any).premio_lordo}
        onTotaliChange={(tot) => {
          // stesso pattern usato per RCA: sync su titoli.premio_netto / tasse / premio_lordo
        }}
        provvigioniValue={(t as any).provvigioni_firma}
        onProvvigioniChange={async (v) => { ... }}
      />
      {renderSplitImporti("Provvigioni alla Firma", sFirma, "teal")}
      <VociRcaCard
        tipoPremio="quietanza"
        useAutoTaxFormula={false}
        mostraCampiCapitaleRata
        mainLabel={(t as any).ramo?.descrizione || "Premio"}
        aliquotaDefault={(t as any).ramo?.aliquota_tasse_ramo ?? 22.25}
        titoloId={t.id}
        onTotaliChange={(tot) => { /* sync premio_netto_quietanza / tasse_quietanza */ }}
      />
    </div>
  </SectionCollapsible>
)}
```

### Codice legacy da rimuovere (solo presentation)
- `premiRows`, `editingPremi`, `startEditPremi`, `addPremiRow`, `removePremiRow`, `updatePremiRow`, `savePremiMutation` → diventano dead code, possiamo rimuoverli (sono solo wrapper UI sulla stessa tabella).
- La query `premiGaranzia` resta (può servire per AI button invalidation), oppure si rimuove anche quella e si invalida solo `voci-rca`.

### Cosa NON cambia
- Tabella DB `premi_garanzia_polizza`: identica.
- Trigger di sync Quietanza ↔ Firma: identici (già attivi anche su voci non-RCA).
- Sezione RCA Auto (linee 2678-2865): inalterata.
- Logica AI scan: invariata, il bottone già funziona per tutti i rami.

## Aliquota tasse default per ramo

Da memory `aliquota_tasse_ramo` esiste sulla tabella `rami`. Verifico in fase di build che il campo sia incluso nella query del titolo (`rami!titoli_ramo_id_fkey(*)` o simile). Se non lo è, aggiungo la select del campo.

## Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Polizze esistenti non-auto con righe in `premi_garanzia_polizza` non hanno `aliquota_tasse_pct` | Fallback: `v.aliquota_tasse_pct ?? aliquotaDefault ?? 13.5` |
| Trigger sync Firma→Quietanza potrebbe non gestire le nuove righe non-RCA | Verifico in build leggendo lo schema; se serve, fallback client-side già presente in `resetQuietanzaMut` |
| Perdita visiva di capitale/tasso/rata/annuo | Mantenuti come colonne nella nuova UI (`mostraCampiCapitaleRata`) |
| Regressione sulle polizze RCA | Tutte le nuove props sono opzionali con default = comportamento attuale |

## Verifica post-build

1. Aprire un titolo RCA esistente: layout RCA invariato (IPT/SSN visibili).
2. Aprire un titolo non-auto (Incendio / Vita / RCT): nuovo layout teal con Firma+Quietanza, capitale/tasso/rata/annuo visibili e modificabili, niente IPT/SSN.
3. Verificare che l'AI scan inserisca voci correttamente in entrambi i casi.
4. Verificare totali sincronizzati su `titoli.premio_netto/tasse/premio_lordo` e `premio_netto_quietanza/tasse_quietanza`.
