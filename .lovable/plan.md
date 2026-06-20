## Cosa succede

Sul cliente `Lo Giudice Emilia Concetta` la tab mostra **"Polizze (9) · Quietanze (0)"**, ma in realtà c'è **1 polizza** (`RCM00010074404`) con **9 rate**.

Verificato in DB:
- Tabella `titoli`: 9 record con `numero_titolo = RCM00010074404`, tutti con `sostituisce_polizza = NULL`.
- Tabella `quietanze`: 9 record (`numero_rata 1/9 … 9/9`) tutti con lo stesso `polizza_id`.

Il conteggio in `ClienteDetail.tsx` (riga 2075) usa:
```ts
const nQuiet = polizze.filter((p) => !!p.sostituisce_polizza).length;
const nPol = polizze.length - nQuiet;
```
È un criterio fragile: funziona solo quando le rate figlie hanno `sostituisce_polizza` valorizzato. Per titoli legacy o generati dal trigger di auto-quietanza il campo è NULL, quindi vengono contati tutti come polizze.

## Fix proposto

Sostituire il criterio con un raggruppamento per `numero_titolo` (= numero polizza), che è la verità funzionale:

```ts
// File: src/pages/ClienteDetail.tsx ~ riga 2075
const numeriUnici = new Set(polizze.map((p) => p.numero_titolo).filter(Boolean));
const nPol = numeriUnici.size;
const nQuiet = polizze.length - nPol;
```

Effetto: per il cliente in esame il badge diventa **"Polizze (1) · Quietanze (8)"** (1 polizza madre + 8 rate successive).

## Cosa NON tocco
- Nessun cambio a query, schema o trigger DB.
- Nessun cambio alla tabella mostrata o al filtro tipo (quelli usano già `groupTitoliByPolizza` che raggruppa correttamente).
- Solo i due numeri nel badge del tab.

## Verifica
1. Apro `/archivi/clienti/746aed8c-67fc-435e-9e88-70991ea03097?tab=polizze` → il badge mostra `Polizze (1) · Quietanze (8)`.
2. Controllo un altro cliente con più polizze distinte per assicurarmi che il conteggio resti corretto.

Procedo?