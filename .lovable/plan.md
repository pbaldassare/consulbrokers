## Problema

Digitando `340,00` in Premio Lordo, il back-solve calcola netto = 340 / 1,265 = 268,7747… → arrotondato a 268,77. Poi:
- tasse = 268,77 × 16% = 43,0032 → 43,00
- SSN = 268,77 × 10,5% = 28,2208 → 28,22
- somma riga = **339,99 €** (perdita 0,01 € da arrotondamento)

`lordoRow` viene ricalcolato in UI come `netto + tasse + ssn`, quindi mostra 339,99 invece dei 340,00 richiesti.

## Fix

In `src/components/polizze/PremiGaranziaCardShell.tsx`, dentro `handleLordoChange`: dopo aver calcolato netto/SSN, **non** arrotondare tasse indipendentemente, ma derivarle come differenza per garantire l'invariante `netto + tasse + ssn = lordo` esatto al centesimo.

```ts
const round2 = (n: number) => Math.round(n * 100) / 100;
const nettoR = round2(nettoCalc);
const ssnR = r?.ssnAttivo ? round2(ssnCalc) : 0;
const tasseR = round2(lordo - nettoR - ssnR); // assorbe il residuo
```

Vantaggi:
- 340,00 resta 340,00 in UI (la riga lordo torna esatta).
- L'errore di arrotondamento (≤ 0,01 €) finisce sulle tasse, che è la convenzione contabile italiana standard per RCA.
- Nessuna nuova colonna/stato (`lordoOverride`) né cambiamenti DB.

Stesso identico fix non serve in `handleNettoChange`/`handleTasseChange`/`handleSsnChange` perché lì il lordo è effettivamente la somma dei tre.

## Verifica

1. Polizza R.C.A., aliquote 16% IPT + 10,5% SSN → digita Lordo `340,00` → blur:
   - Netto 268,77 · Tasse 43,01 (assorbe +0,01) · SSN 28,22 · **Lordo riga 340,00 ✓**
2. Lordo `476,50` (caso citato prima) → Netto/Tasse/SSN coerenti, totale riga 476,50 esatto.
3. Edit successivo del netto manuale → tasse ricalcolate dall'aliquota come oggi (nessuna regressione).

## File

- `src/components/polizze/PremiGaranziaCardShell.tsx` (solo `handleLordoChange`, ~10 righe).
