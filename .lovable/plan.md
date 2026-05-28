## Obiettivo
Allineare la sezione **Importi / Composizione Premio** di `TitoloDetail` a quella di `ImmissionePolizzaPage`, in modo che:
- la grafica sia identica (stesso componente, stesso layout 2 card Firma+Quietanza),
- l'SSN venga calcolato e mostrato per ogni riga con flag `rami.ssn_attivo` e sommato nel Totale Tasse e nel Premio Lordo,
- le provvigioni siano formattate a 2 decimali nell'input.

## 1. Sostituire `VociRcaCard` con `PremiGaranziaCardShell` in `TitoloDetail.tsx`
- Rimuovere import di `VociRcaCard`; importare `PremiGaranziaCardShell` + `emptyGaranziaRow` + `GaranziaRow`.
- Mantenere la sezione "Importi" con due `PolizzaSection` figli (Firma + Quietanza) come fa Immissione.
- Caricare le righe esistenti da `premi_garanzia_polizza` (`tipo_premio='firma'` / `'quietanza'`) e mapparle a `GaranziaRow` (sottoramo_id, codice, descrizione, netto, tasse, aliquota_tasse, ssn).
- Persistere le modifiche: stesso pattern di Immissione (upsert su `premi_garanzia_polizza`) + aggiornare `titoli.premio_netto/tasse/ssn_firma/premio_lordo` e gli analoghi `_quietanza` aggregando le righe (riusando i totali esposti dal componente o ricalcolandoli con la stessa formula `ssn = (netto+tasse)*aliquota_ssn/100`).
- Trigger DB `premi_garanzia_sync_quietanza` continua a gestire il mirror Firma→Quietanza automaticamente.

## 2. Lock messa-a-cassa
Mantenere il comportamento già esistente: passare a `PremiGaranziaCardShell` un prop `readOnly` (se non presente, aggiungerlo) o disabilitare i pulsanti "Aggiungi voce" / inputs quando `isLocked` è true, coerente con il banner ambra già presente.

## 3. Provvigioni: formattazione a 2 decimali
Nei due input "Provvigioni Firma" e "Provvigioni Quietanza" (sotto le card), normalizzare il valore visualizzato con `Number(v).toFixed(2)` come `defaultValue` (e mantenere `step="0.01"`). Applicare la stessa pulizia ovunque nella pagina compaiano provvigioni come input editabile (anche `provvigioni_firma/quietanza` nel form `importiForm`).

## 4. Rimozione legacy
- Eliminare dalla sezione Importi di `TitoloDetail` ogni riferimento al concetto di "riga RCA principale auto" e ai campi `imposta_provinciale`/`ssn` letti dalla sola riga RCA, perché ora il calcolo è per riga via `rami.ssn_attivo`.
- Non rimuovere `VociRcaCard` dal repo (potrebbe essere usato altrove); rimuovere solo l'uso in `TitoloDetail`.

## 5. Aggiornamento memoria
Aggiornare `mem://insurance/titolo-detail-allineato-immissione` e `mem://insurance/sottoramo-as-garanzia-row` segnalando che ora anche TitoloDetail usa `PremiGaranziaCardShell` con SSN per riga; rimuovere la nota "allineamento successivo".

## File coinvolti
- `src/pages/TitoloDetail.tsx` — sostituzione card Importi, mapping righe DB ↔ `GaranziaRow`, salvataggio, lock, formattazione provvigioni.
- `src/components/polizze/PremiGaranziaCardShell.tsx` — eventuale aggiunta prop `readOnly` se manca.
- `.lovable/memory/insurance/titolo-detail-allineato-immissione.md`, `.lovable/memory/insurance/sottoramo-as-garanzia-row.md` — aggiornamento.

## Non in scope
- Modifiche al parser AI (già OK).
- Nessuna migration DB: schema `premi_garanzia_polizza` + flag `rami.ssn_attivo` già pronti.
- Sezione Veicolo/RCA: non si tocca, è già allineata.

## Risultato atteso sulla polizza 184667297
- Premio Lordo torna a ~1971€ perché l'SSN delle righe RCA con `ssn_attivo` rientra in "Totale Tasse".
- Le card Firma e Quietanza hanno **esattamente** lo stesso aspetto della pagina Immissione.
- Le provvigioni mostrano `188,57` e non `188,5672000000`.
