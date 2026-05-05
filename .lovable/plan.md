# Provvigioni dentro le card RCA + label "Quota"

Due piccoli interventi:

## 1. Spostare le provvigioni dentro le due card Firma/Quietanza

In `src/components/polizze/VociRcaCard.tsx`:

- Aggiungere due props opzionali: `provvigioniValue?: number | null` e `onProvvigioniChange?: (v: number) => void`.
- Nel blocco "Totali" (in fondo alla CardContent), aggiungere una nuova riga sotto la griglia esistente:
  - Label "Provvigioni" (teal per Firma, amber per Quietanza)
  - `<Input type="number" step="0.01">` con `value={provvigioniValue ?? ""}` e `onBlur` → `onProvvigioniChange(parseFloat(...))`
  - Layout: `flex items-center justify-between gap-3 p-3 sm:p-4 border-t bg-muted/30` per allinearsi visivamente al riquadro totali.

In `src/pages/TitoloDetail.tsx`:

- Passare alle due `<VociRcaCard>` le nuove props:
  - Firma: `provvigioniValue={t.provvigioni_firma}` + `onProvvigioniChange` che fa update di `titoli.provvigioni_firma` via supabase + `invalidateQueries(["titolo", t.id])`.
  - Quietanza: idem con `provvigioni_quietanza`.
- Rimuovere dalla sezione **Importi** (sia in lettura che in modifica per RCA) i campi "Provvigioni Firma" e "Provvigioni Quietanza" — sono ora nelle card.
- In modalità RCA modifica, la sezione Importi mostrerà solo il banner blu informativo + il blocco Valuta/Indicizzata/Rimborso (i campi provvigioni vengono gestiti direttamente dentro le card RCA, sempre visibili e modificabili senza entrare in "Modifica").

## 2. Rinominare "Quota Agenzia" → "Quota"

Nel restyle della card Commerciale & Provvigioni (lettura), cambiare il label dell'header della card amber da "QUOTA AGENZIA" a semplicemente "QUOTA". Mantengo invariato il testo descrittivo "Consulbrokers SPA" e il calcolo (differenza tra totale provvigioni e quota commerciale, che già funziona così: `importoAdmin = provvQ * (100 - percComm) / 100`).

## File toccati

- `src/components/polizze/VociRcaCard.tsx` — nuove props + riga Provvigioni nella CardContent.
- `src/pages/TitoloDetail.tsx`:
  - Passaggio props alle due `<VociRcaCard>` con handler di update DB.
  - Rimozione dei campi "Provvigioni Firma/Quietanza" sia in lettura che in modifica per RCA.
  - Cambio label "QUOTA AGENZIA" → "QUOTA".

Nessuna migrazione DB.
