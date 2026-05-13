## Obiettivo

Rendere bidirezionali i calcoli nelle card "Premi per Garanzia — Firma/Quietanza": oggi si parte solo dal Premio Netto e si calcolano Tasse + Lordo. Voglio poter inserire anche il **Premio Lordo** e ottenere automaticamente Netto e Tasse usando l'aliquota del sottoramo.

## Modifica

File unico: `src/components/polizze/PremiGaranziaCardShell.tsx`.

### 1. Premio Lordo diventa editabile

La cella "Premio Lordo" (riga 226) oggi è un `<span>` calcolato (`netto + tasse`). Diventa un `<Input type="number">` controllato dal valore corrente (`netto + tasse`).

### 2. Nuovo handler `handleLordoChange(idx, value)`

Logica:
- `lordo = parseFloat(value) || 0`
- `aliquota = r.aliquotaTasse || 0` (presa dal sottoramo selezionato)
- Se `aliquota > 0`: `netto = lordo / (1 + aliquota/100)`, `tasse = lordo - netto`
- Se `aliquota = 0` (nessun sottoramo): `netto = lordo`, `tasse = 0`
- `updateRow(idx, { netto: netto.toFixed(2), tasse: tasse.toFixed(2) })`

### 3. Comportamento esistente preservato

- `handleNettoChange` (netto → tasse via aliquota) resta invariato.
- Edit manuale del campo Tasse resta invariato (override).
- Colonna "Aliquota %" continua a mostrare l'aliquota effettiva ricalcolata.
- Totali, Addizionali, Provvigioni: nessun cambio.

### 4. UX

- Input Lordo con stessa larghezza/stile degli altri (font mono, allineato a destra, h-8).
- Su blur, riformatta a 2 decimali per coerenza visiva.

## Validazione

Sul preview (`/portafoglio/immissione`):
1. Seleziono ramo + sottoramo EC CRISTALLI (aliquota 100%) → digito Lordo `244` → Netto deve diventare `122.00`, Tasse `122.00`.
2. Sottoramo QA RC AUTO (aliquota 16%) → Lordo `141.52` → Netto `122.00`, Tasse `19.52`.
3. Verifico inverso: cambio Netto a `200` → Tasse e Lordo si aggiornano come prima.
4. Totali in fondo (Totale Netto / Tasse / Premio Lordo) restano coerenti.

Nessun cambio a logiche di salvataggio o DB.