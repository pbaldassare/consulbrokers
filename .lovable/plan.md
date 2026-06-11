## Obiettivo
Allineare la card del **Ricongiungimento Bancario** alla logica di TitoloDetail / Portafoglio Carico, aggiungendo:
1. Visibilità anticipi cliente disponibili.
2. Pulsante **Garantito** (oggi mancante in Ricongiungimento *e* in Carico).
3. Fix del collegamento polizza ↔ movimento al click di "Salva Ricongiungimento".

## Cambiamenti

### A. Nuovo componente condiviso `GarantitoDialog`
- File: `src/components/portafoglio/GarantitoDialog.tsx`
- Estratto verbatim dal dialog "Garantito" oggi inline in `TitoloDetail.tsx` (linee 1836–1884): rettangolo arancio con Circolare 02 Consulbrokers, checkbox di responsabilità, date Messa a Cassa + Decorrenza Rinnovo, bottone "Conferma Garantito".
- Props: `{ open, onOpenChange, titoli: TitoloMin[], onSuccess?: () => void }`. Stessa shape di `MessaCassaDialog` per coerenza.
- Al conferma esegue, per ogni titolo: update `titoli` set `stato='incassato', conferimento_gestito=true, fondi_ricevuti=false, data_conferimento_gestito=today, data_messa_cassa, data_decorrenza_rinnovo` + log attività (`azione: "conferimento_gestito"`). Stesso payload di TitoloDetail.
- `TitoloDetail.tsx` viene refattorizzato per usare il nuovo componente (rimosso il dialog inline, mantenuto il bottone esistente). Nessun cambio comportamentale lì.

### B. Card Ricongiungimento — Anticipi cliente
- `RicongiungimentoBancarioPage.tsx` / `MovimentoCard`:
  - Importo `useAnticipiResiduoByClienti([movimento.cliente_id])` (stesso hook di Carico).
  - Sopra la sezione "Polizze attive" nuova riga "Anticipi disponibili": se `summary.totale > 0` mostro badge verde con `fmtEuro(summary.totale)` + tooltip "click per dettagli" che apre `AnticipoUtilizziDrawer` (riusato 1:1 da Carico) + bottone "Usa nel ricongiungimento" che imposta il campo `Anticipo (€)` = min(residuo, importo movimento − totalePolizze).
  - Aggiunto invalidate `["anticipi-residuo-by-clienti","anticipi-globale"]` dopo salva/messa a cassa.

### C. Pulsante "Garantito" nella card Ricongiungimento
- Riga azioni della card: dopo "Salva Ricongiungimento" e prima di "Metti a Cassa", aggiunto `<Button variant="outline" className="border-orange-500 text-orange-700 hover:bg-orange-50">Garantito</Button>`.
- Stessa pre-condizione di "Metti a Cassa": quadratura + almeno una polizza selezionata.
- Al click apre `GarantitoDialog` con i titoli selezionati. `onSuccess` esegue la stessa persistenza di `onCassaSuccess` (movimenti_clienti, movimenti_polizze `messo_a_cassa=true`, `movimenti_bancari.stato='incassato'`, notifica `notificaSedeMovimentoBancario`).

### D. Pulsante "Garantito" in Portafoglio Carico
- `PortafoglioCaricoPage.tsx`:
  - Stato `garantitoDialogOpen`, `garantitoDialogTitoli`.
  - Colonna azioni: accanto al bottone "Cassa" per polizze non incassate, nuovo bottone "Garantito" (icona Shield, stile arancio) che apre `GarantitoDialog` per il singolo titolo.
  - Toolbar selezione massiva: accanto a "Metti a Cassa massivo" nuovo bottone "Garantito massivo" che apre lo stesso dialog con l'array di titoli selezionati.
  - `onSuccess` invalida le stesse query già usate dopo Cassa.

### E. Fix collegamento al "Salva Ricongiungimento"
- Bug attuale verificato in `salvaRicongiungimento`: scrive `movimenti_clienti` + righe `movimenti_polizze` ma non aggiorna stato del movimento_bancario in modo coerente quando non si arriva alla messa a cassa.
- Cambio: dopo l'insert delle righe, garantisco `movimenti_bancari.stato='ricongiunti'` (già fatto) **e** valorizzo `movimenti_polizze.titolo_id` con l'id della polizza selezionata (già fatto, ma riverifico che venga incluso anche quando `selPol[id]=0` ma checkbox attiva — uso `>0` mantenendo il default = premio_lordo all'attivazione checkbox, comportamento già presente).
- Aggiungo toast informativo "Polizza X collegata al movimento" che cita il numero polizza.

## File modificati
- **Nuovo**: `src/components/portafoglio/GarantitoDialog.tsx`
- `src/pages/TitoloDetail.tsx` (sostituisce dialog inline con `<GarantitoDialog />`, mantiene bottone)
- `src/pages/contabilita/RicongiungimentoBancarioPage.tsx` (anticipi card + bottone Garantito + fix salva)
- `src/pages/PortafoglioCaricoPage.tsx` (bottone Garantito su riga + toolbar massiva)

Nessuna modifica al DB. Tutti i campi usati esistono già: `titoli.conferimento_gestito`, `fondi_ricevuti`, `data_conferimento_gestito`, `data_decorrenza_rinnovo`.

## Verifica
- ARS RESTAURI DI TRIBBIA: espando il movimento da 647 €, seleziono la polizza 114601594, clicco **Salva Ricongiungimento** → toast "Polizza 114601594 collegata", movimento passa a "ricongiunti" e resta in elenco. Riapro: la spunta è memorizzata.
- Stesso movimento: clicco **Garantito** → si apre il dialog Circolare 02; spunto la dichiarazione, confermo → polizza diventa `incassato + Garantito` (badge arancio in TitoloDetail), movimento_bancario diventa `incassato`, notifica inviata.
- Carico: su una polizza attiva non incassata clicco **Garantito** sulla colonna azioni → stesso dialog, stesso esito.
- Selezione massiva di 2 polizze in Carico → bottone **Garantito** in toolbar → dialog mostra "Incasso multiplo: 2 polizze".
- Cliente con anticipi residui (testabile sui clienti già usati in Carico): la card Ricongiungimento mostra il badge verde con il totale, click apre il drawer dettagli, "Usa nel ricongiungimento" pre-compila il campo Anticipo.
