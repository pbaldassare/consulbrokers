# Fix provvigioni E/C: rispettare lo zero scritto a mano

## Problema
Sulla polizza 184683970 (rata di marzo, premio 0,00 €, incasso a zero) l'Estratto Conto Agenzia ha accreditato 23,57 € di provvigioni non dovute. Causa: la funzione di calcolo `getProvvigioneEC` (in `src/lib/getProvvigioneEC.ts`) ignora lo zero scritto dall'operatore e prende il valore della quietanza quando questo è maggiore di zero:

```ts
return quietanza > 0 ? quietanza : firma;
```

Regola richiesta: **il valore inserito a mano vince sempre**. Se l'operatore scrive zero, la provvigione deve restare zero — nessun override automatico.

## Modifica
In `src/lib/getProvvigioneEC.ts` cambiare la logica in:

- **Quietanza/rata** (`sostituisce_polizza` presente): usa `provvigioni_quietanza` così com'è (zero compreso).
- **Polizza madre**: usa `provvigioni_firma` se il campo è valorizzato (anche se vale 0); solo se `provvigioni_firma` è **null/vuoto** (mai compilato) si ripiega su `provvigioni_quietanza`.

In pratica: lo zero esplicito non viene più sostituito; il fallback sulla quietanza scatta solo quando il campo firma non è mai stato impostato.

## Verifica
- Aggiornare/estendere il test unitario `src/lib/__tests__/getProvvigioneEC.test.ts` con i casi: firma=0 + quietanza=23,57 → 0; firma=null + quietanza=23,57 → 23,57; quietanza su rata → valore quietanza.
- Eseguire i test e il typecheck.
- Verificare che il caso 184683970 (marzo) risulterebbe a 0,00 € e che i casi legacy (madri con solo quietanza valorizzata) restino invariati.

## Note tecniche
- La distinzione tra "zero scritto" e "mai compilato" si basa su `null`/`undefined` vs `0`: il trigger `trg_titoli_normalizza_importi` e le form scrivono 0 esplicito quando l'operatore azzera il campo.
- Nessuna modifica al database né ai dati esistenti: la correzione riguarda solo il calcolo in lettura dell'E/C. L'E/C `B0879/261006` già generato resta come è (eventuale storno/rettifica da valutare a parte).
