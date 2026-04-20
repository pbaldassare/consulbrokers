

## Obiettivo

Aggiungere un pulsante **Rinnovo** nelle Operazioni del dettaglio polizza che apre un dialog per:
1. Mostrare i dati del nuovo periodo precompilati (in base a durata + frazionamento)
2. Permettere di modificarli
3. Creare una **nuova riga in `titoli`** (stesso `numero_titolo`, `riga` incrementata) con tutti i dati copiati e le nuove date
4. Registrare il movimento di tipo `Rinnovo` / `PQ` in `movimenti_polizza`
5. Loggare in timeline
6. Il nuovo titolo sarà `stato='attivo'`, `data_messa_cassa=null` → comparirà automaticamente in **Carico del Mese** pronto per essere messo a cassa

Esempio richiesto (verificato sul DB):
- Polizza 332437571 attuale: `durata_da=2025-04-04`, `durata_a=2026-04-04`, `anni_durata=1`, `periodicita=annuale`, `riga=0`
- Nuovo titolo proposto: `durata_da=2026-04-04`, `durata_a=2027-04-04`, `riga=1`

## Logica di calcolo nuove date

In base a `periodicita` + `anni_durata`:
- `annuale` → +1 anno (o +`anni_durata` se poliennale)
- `semestrale` → +6 mesi
- `quadrimestrale` → +4 mesi
- `trimestrale` → +3 mesi
- `mensile` → +1 mese

Nuove date proposte (modificabili):
- `durata_da` = vecchia `durata_a`
- `durata_a` = `durata_da + delta`
- `data_scadenza` = nuova `durata_a`
- `data_competenza` = nuova `durata_da`
- `garanzia_da` / `garanzia_a` = stessa logica

## Cosa creo

### 1. Componente `RinnovoTitoloDialog.tsx`
Nuovo file `src/components/polizze/RinnovoTitoloDialog.tsx`:
- Dialog con form precompilato: `durata_da`, `durata_a`, `data_scadenza`, `data_competenza`, `garanzia_da`, `garanzia_a`, `premio_lordo` (modificabile, default = stesso del precedente)
- Riepilogo info polizza (numero, cliente, ramo, compagnia)
- Bottone "Conferma Rinnovo" → INSERT nuovo titolo + INSERT movimento + log + redirect al nuovo titolo

### 2. Integrazione in `TitoloDetail.tsx`
- Aggiungere bottone **Rinnovo** (icona `RefreshCw`, verde) nella card "Operazioni" (riga ~1024-1043), accanto a Sospensione/Riattivazione/Duplicazione
- Visibile solo se: `stato='attivo'` e (siamo entro 60 giorni dalla scadenza OPPURE polizza già scaduta non ancora rinnovata)
- Click → apre `RinnovoTitoloDialog`

### 3. Logica di insert (in `RinnovoTitoloDialog`)
```
INSERT INTO titoli (
  numero_titolo: stesso,
  riga: max(riga)+1 per quel numero_titolo,
  cliente_anagrafica_id, cliente_id, prodotto_id, ufficio_id, produttore_id,
  compagnia_id, ramo_id, gruppo_ramo, specialist, commerciale_id,
  percentuale_commerciale, percentuale_riparto, tipo_mandatario,
  durata_da: NUOVA,
  durata_a: NUOVA,
  data_scadenza: NUOVA,
  data_competenza: NUOVA,
  garanzia_da/a: NUOVE,
  anni_durata, rate, periodicita, tipo_rinnovo, disdetta_mesi: stessi,
  premio_lordo, premio_netto, tasse, addizionali: dal form (default = stessi),
  stato: 'attivo',
  data_messa_cassa: NULL,
  data_incasso: NULL,
  importo_incassato: NULL,
  tipo_portafoglio: 'rinnovo',
  sostituisce_polizza: numero precedente, sostituisce_riga: riga precedente
)
```
Più:
```
INSERT INTO movimenti_polizza (
  titolo_id: nuovo,
  tipo: 'Rinnovo',
  tipo_documento: 'PQ',
  data_movimento: oggi,
  data_effetto: nuova durata_da,
  data_scadenza: nuova durata_a,
  data_rinnovo: nuova durata_da,
  premio: nuovo premio_lordo,
  stato: 'aperto',
  sostituisce_id: id titolo precedente
)
```
Più `logAttivita({ azione: "rinnovo_polizza", ... })`.

### 4. Verifica post-creazione
Il nuovo titolo:
- Ha `stato='attivo'` e `data_messa_cassa=null`
- Compare automaticamente in **Portafoglio → Carico del Mese** filtrato per `data_scadenza` del mese di decorrenza
- Cliente e tutti i collegamenti sono mantenuti
- Si può aprire e fare "Messa a Cassa" come una polizza normale

## File toccati

- **Nuovo**: `src/components/polizze/RinnovoTitoloDialog.tsx`
- **Modificato**: `src/pages/TitoloDetail.tsx` (aggiunta bottone Rinnovo + state per aprire il dialog)

Nessuna migrazione DB necessaria — schema già pronto (`riga` come progressivo, `sostituisce_polizza/riga` per il legame).

## Cosa NON faccio

- Non tocco la `RinnoviPolizzaPage` (è la lista batch dei rinnovi, separata)
- Non duplico provvigioni o movimenti contabili (verranno generati al momento della Messa a Cassa del nuovo titolo, come per qualsiasi altra polizza)
- Non cambio lo stato del titolo originale (resta `attivo` finché non lo metti a cassa o scade)

