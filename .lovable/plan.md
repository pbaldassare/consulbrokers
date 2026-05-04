## Problema

Nel Dettaglio Polizza, sulle polizze in stato **"attivo"** vengono ancora mostrati i bottoni **Incassa** e **Garantito**. Ma una polizza "attiva" è già stata incassata (la messa a cassa porta lo stato a `incassato`; resta `attivo` solo nei casi di poliennale con rate future ancora da riscuotere). Quindi i bottoni rischiano di causare un secondo incasso sullo stesso titolo.

Inoltre la regola va applicata coerentemente anche alla card "Messa a Cassa" e a tutti gli ingressi correlati (lista Carico del Mese, dialog di messa a cassa diretta dalla lista).

## Regola corretta

Una polizza è "incassabile" SOLO se:
- `stato === "attivo"` **E**
- `data_messa_cassa` è **NULL** (mai incassata) **OPPURE** è una poliennale con rate residue da incassare per il periodo corrente

In tutti gli altri casi (polizza già con `data_messa_cassa` valorizzata e non poliennale, polizza in stato `incassato`, `sospeso`, `scaduto`) i bottoni **Incassa** e **Garantito** devono essere nascosti.

## Modifiche

### 1. `src/pages/TitoloDetail.tsx` (linee 1453–1478)

Sostituire la condizione `t.stato === "attivo"` sui due bottoni con la stessa logica già usata per mostrare la card: la costante `showMessaACassa` (riga 1134) che vale `!t.data_messa_cassa || (isPoliennale && t.stato === "attivo")`.

Aggiungere anche il vincolo che la polizza sia in stato `attivo` (escludendo `sospeso`, `scaduto` per evitare incassi su polizze non operative).

```text
Bottone visibile sse:
  t.stato === "attivo" && (!t.data_messa_cassa || isPoliennale)
```

### 2. Lista "Carico del Mese" / Storico — verifica

Controllare `src/pages/PortafoglioCaricoPage.tsx` e `src/components/portafoglio/MessaCassaDialog.tsx` per assicurarsi che il pulsante di messa a cassa massiva non compaia su righe già incassate (`data_messa_cassa IS NOT NULL` e non poliennale). Se la lista Carico già filtra solo titoli senza `data_messa_cassa`, nessuna modifica necessaria — solo verifica.

### 3. Hardening lato server (consigliato, da confermare)

Aggiungere un trigger `BEFORE UPDATE` su `titoli` che blocchi la valorizzazione di `data_messa_cassa` se è già non-null, a meno che non sia una polizza poliennale attiva (caso rate successive). Questo previene doppi incassi anche da SQL diretto o import.

```sql
-- Pseudocodice
IF OLD.data_messa_cassa IS NOT NULL
   AND NEW.data_messa_cassa IS DISTINCT FROM OLD.data_messa_cassa
   AND NOT (è_poliennale(NEW) AND NEW.stato = 'attivo')
THEN RAISE EXCEPTION 'Polizza già incassata';
```

## Domanda di conferma

Procedo con i punti 1 e 2 (fix UI immediato). Sul punto 3 (trigger DB anti-doppio-incasso) confermi che vuoi anche l'hardening server-side, o per ora basta la correzione UI?