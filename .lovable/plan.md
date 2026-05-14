
## Obiettivo

Nelle card "Premi per Garanzia — Firma/Quietanza" l'utente deve poter digitare indifferentemente **Premio Netto** o **Premio Lordo** su ciascuna riga garanzia. L'altro valore viene ricalcolato automaticamente tramite l'aliquota di tassa del sottoramo, e le Tasse sono il delta. I totali in basso (Totale Netto, Totale Tasse, Premio Lordo) restano la somma delle righe e si aggiornano in tempo reale.

## Comportamento per riga

Ogni riga ha tre input numerici indipendentemente editabili: **Netto**, **Tasse**, **Lordo**. La regola di propagazione è:

- **Modifico Netto** → Tasse = `Netto × aliquota%`, Lordo = `Netto + Tasse`.
- **Modifico Lordo** → Netto = `Lordo / (1 + aliquota%/100)`, Tasse = `Lordo − Netto`.
- **Modifico Tasse** (override manuale, oggi non ricalcola) → Lordo = `Netto + Tasse`; aliquota mostrata diventa quella effettiva.
- Se il sottoramo non ha aliquota (= 0) e l'utente edita Lordo: Netto = Lordo, Tasse = 0.

Arrotondamento sempre a 2 decimali. Se il campo viene svuotato (`""`), gli altri tornano vuoti senza forzare 0.

## Totali in basso

Restano calcolati come somma delle righe (read‑only), perché la richiesta è "ogni riga ha il suo lordo/netto, poi il totale viene automatico". Le Addizionali rimangono l'unico input modificabile del riepilogo e concorrono al Premio Lordo totale.

## File toccati

```text
src/components/polizze/PremiGaranziaCardShell.tsx
```

Unico componente da modificare — è già usato sia in Firma sia in Quietanza, sia nella pagina Immissione che (via `Sincronizza da Firma`) nella Quietanza, quindi la modifica si propaga ovunque senza altri interventi.

### Dettagli tecnici

1. Estendere `handleNettoChange` perché aggiorni anche un eventuale recalc se l'aliquota è 0.
2. `handleLordoChange` esiste già: agganciarlo all'input Lordo della riga (verifica che funzioni con valori vuoti / `NaN`).
3. Sostituire l'input Tasse `onChange` semplice con un handler `handleTasseChange(idx, value)` che lascia Netto invariato e ricalcola solo Lordo (via somma); l'aliquota visualizzata diverrà quella effettiva (`tax/netto*100`), già implementata nella riga `aliquotaCalc`.
4. Mantenere il valore visualizzato dei tre input come stringa libera (no `toFixed` distruttivo durante la digitazione): solo l'`onBlur` normalizza a 2 decimali.
5. Non sono richieste modifiche al DB né al payload di `ImmissionePolizzaPage.tsx`: il totale `premio_lordo` salvato è già la somma delle righe.

## Fuori scopo

- Editing dei totali aggregati (Totale Netto / Premio Lordo) — confermato che restano calcolati.
- Modifiche al modello dati o alle migration.
- Card RCA `VociRcaCard` — ha già la sua logica dedicata e non è stata segnalata.
