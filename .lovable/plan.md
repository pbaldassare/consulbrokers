# Sottoramo come riga garanzia (non più campo singolo)

## Obiettivo

Cambiare il modello UI per cui il **Sottoramo** non è più un campo accanto al Ramo, ma diventa la **prima colonna delle righe garanzia** nelle card "Composizione Premio Firma" e "Quietanza". Il Ramo (gruppo) resta unico per polizza e fa da filtro per i sottorami selezionabili nelle righe.

## Esempio confermato

Polizza Auto:
- **Ramo** = `ZQ - R.C.A.` (gruppo)
- Composizione Premio Firma:
  - Riga 1 → Sottoramo `PI - R.C. AUTOVEICOLI` → netto + tasse + lordo
  - Riga 2 → Sottoramo `ARD - Auto Rischi Diversi` → ...
  - Riga 3 → Sottoramo `CR - Cristalli` → ...
  - Riga 4 → Sottoramo `AS - Assistenza` → ...
- Premio Firma totale = somma lordi righe; idem Quietanza.

## Cambi UI

### `ImmissionePolizzaPage.tsx`
1. Card **Contratto**: rimuovere il selettore "Sottoramo". Resta solo "Ramo" (gruppi_ramo) con `SearchableSelect`.
2. Le righe garanzia in `PremiGaranziaCardShell` (Firma e Quietanza) cambiano la cella "Voce":
   - Diventa `SearchableSelect` di **Sottorami** (`rami` filtrati per `gruppo_ramo_id = selectedRamoId`).
   - Label: `codice - descrizione`.
   - Quando il Ramo non è selezionato, le righe sono disabilitate con messaggio "Seleziona prima il Ramo".
3. Cambio Ramo → reset righe garanzia (sottorami non più validi per il nuovo gruppo).
4. Tasse riga: default da `rami.aliquota_tasse_ramo` del sottoramo selezionato (override manuale possibile).

### `TitoloDetail.tsx` (modifica polizza esistente)
Stessa logica: rimuovere il campo "Sottoramo" singolo dal blocco contratto; spostarlo nelle righe `VociRcaCard` (Firma + Quietanza) come selettore di sottoramo filtrato per gruppo.

## Cambi dati

### Salvataggio
- `titoli.ramo_id` → ora punta al **gruppo ramo** (`gruppi_ramo.id`). Confermato dall'utente.
- I sottorami vivono solo sulle righe voci premio.

### Schema
1. Nuova FK su `titoli.ramo_id`: prima puntava a `rami.id`, ora deve puntare a `gruppi_ramo.id`. Migrazione dati:
   - Per ogni `titoli.ramo_id` esistente, rimpiazzare con il `gruppo_ramo_id` del relativo `rami`.
   - Drop FK vecchia, crea nuova FK su `gruppi_ramo`.
2. Tabella righe voci premio (es. `titoli_voci_premio` o equivalente attuale usata da `PremiGaranziaCardShell`):
   - Aggiungere colonna `sottoramo_id uuid references rami(id)` (nullable per retrocompatibilità).
   - Per voci esistenti agganciate a `rca_garanzie`, lasciare il legame come fallback.
3. Vista `v_portafoglio_titoli`: ricreare derivando `gruppo_ramo` direttamente da `titoli.ramo_id → gruppi_ramo`, e `sottorami` aggregati dalle righe voci premio.
4. Report/filtri esistenti che filtravano per `ramo_id` come sottoramo: aggiornati a filtrare via righe voci premio (oppure via gruppo).

## Componenti riusabili
- Estendere `useRami(gruppoRamoId)` (già esiste) per popolare il selettore riga.
- Nuovo componente `SottoramoSelectCell` riutilizzato da Firma + Quietanza + TitoloDetail.

## Validazione
- `/portafoglio/immissione`: verificare che il campo Sottoramo non appare più nel blocco Contratto e che ogni riga garanzia mostra il selettore sottoramo filtrato.
- Polizza Auto demo: aggiungere riga PI + ARD + Cristalli e confermare somma premio.
- Polizza esistente: aprire `TitoloDetail`, vedere righe popolate con sottoramo derivato.
- Salvataggio: `titoli.ramo_id` contiene un `gruppi_ramo.id` valido; righe voci premio contengono `sottoramo_id` valorizzato.

## Rischi
- Migrazione dati `titoli.ramo_id`: serve backfill 1-a-1; titoli orfani (ramo senza gruppo) vanno mappati o segnalati.
- Report e RPC che oggi joinano `titoli.ramo_id → rami` vanno aggiornati a `gruppi_ramo`. Da censire prima della migration (memory `Ramo / Sottoramo coordinato` va aggiornata).
