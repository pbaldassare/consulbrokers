# Dettaglio Voci RCA Auto

Pagina/sezione che permette di gestire le componenti tecniche di una polizza RCA Auto (Cristalli, Furto, Casko, Assistenza, Tutela, Infortuni conducente, ARD, ecc.), con la voce **RCA Auto sempre presente e non rimovibile**, calcolo automatico del lordo per ciascuna voce, e gestione speciale per RCA con SSN + Addizionale Provinciale.

## Dove vive

Nuova **tab "Voci RCA"** nella pagina `TitoloDetail.tsx`, visibile solo quando il ramo è RCA Auto (codici `RV01…RV16` sotto gruppo `ZQ - R.C.A.`). Dati persistiti in `premi_garanzia_polizza` (già esistente).

## Comportamento

### Tabella voci
Colonne: `Voce` · `Premio Netto` (editabile) · `Aliquota tasse` · `Premio Lordo` (calcolato, readonly) · azione `🗑` (rimuovi, disabilitata su RCA Auto).

Sotto la tabella un pulsante **`+ Aggiungi voce`** apre un popover con le voci disponibili (`rca_garanzie` non ancora aggiunte).

### Calcolo lordo
- **Voci accessorie** (Cristalli, Furto, Casko, Assistenza, Tutela, Infortuni, ARD, …): `lordo = netto × 1,225` (aliquota fissa **22,5%**, standard rami danni non auto-RCA).
  - *(Nota: l'utente ha indicato 13,5%; quella è l'aliquota della Tutela Legale. Le altre garanzie auto accessorie sono al 22,25%. Confermare in fase di build quale aliquota usare di default — proposta: usare `rca_garanzie.aliquota_tasse` già a DB voce per voce.)*
- **RCA Auto** (caso speciale, riga sempre presente):
  - **Imposta RCA + Addizionale Provinciale**: aliquota variabile per provincia di residenza del contraente. Base nazionale **12,50%**, le province possono modulare ±3,5 punti → range tipico **9% – 16%**. Default applicato: **16%** (Roma, Milano, Napoli e maggior parte dei capoluoghi); valore **editabile per polizza** e precompilato in base alla provincia del cliente quando disponibile.
  - **SSN (Servizio Sanitario Nazionale)**: **10,50% calcolato sull'imposta RCA** (non sul netto).
  - Formula: `imposta = netto × aliquota_prov%`, `ssn = imposta × 10,5%`, `lordo_rca = netto + imposta + ssn`.
  - Tre righe-figlie readonly mostrate sotto la riga RCA: *Imposta Provinciale*, *SSN 10,5%*, *Totale RCA lordo*.

### Totale polizza
Card riepilogo in fondo:
- Totale Netto = Σ netti
- Totale Tasse = Σ (lordo − netto)
- **Totale Premio Lordo** = Σ lordi → quadra con `titoli.premio_lordo`. Badge verde se quadra, rosso con delta se no, pulsante "Allinea su titolo".

## Tabelle coinvolte

Tutte già esistenti — nessuna nuova tabella, solo nuove colonne:

- `premi_garanzia_polizza` (esistente): `titolo_id`, `garanzia` (text), `capitale`, `tasso`, `firma`, `rata`, `annuo`, `ordine`. Useremo `firma` come "premio netto firma" e aggiungeremo:
  - `aliquota_tasse_pct numeric` (override per riga, opzionale)
  - `lordo_calcolato numeric generated` (oppure calcolato lato client)
  - `is_rca_principale boolean default false` (flag per la riga RCA Auto)
  - `imposta_provinciale numeric`, `ssn numeric` (popolati solo per la riga RCA principale)
- `rca_garanzie` (esistente, 17 voci): usata come catalogo nel popover "+ Aggiungi voce". Useremo `aliquota_tasse` come default.
- Nuova tabella `aliquote_provinciali_rca` con `provincia (char(2) PK)`, `aliquota_pct numeric`, `aggiornato_il date`. Seeding iniziale con le 110 province (default 16%, override per province con aliquota nota inferiore).

## UI / grafica

- Card con header teal (brand) "Composizione premio RCA Auto" + icona `Car`.
- Riga RCA Auto evidenziata con sfondo `bg-teal-50` e bordo sinistro teal, non eliminabile (cestino disabled + tooltip).
- Tabella zebra (rule progetto), input numerici allineati a destra, formato EUR.
- Le 3 righe-figlie (imposta/ssn/totale) rientrate con `pl-8` e font più piccolo, sfondo `bg-muted/40`.
- Card totali in basso con 3 metriche in grid 3-col, badge di quadratura.
- Pulsante `+ Aggiungi voce` outline con icona `Plus`, apre `Popover + Command` (pattern SearchableSelect del progetto).
- Salvataggio: debounced 600 ms su blur del campo netto, toast di conferma silenzioso.

## Tracciatura DB

- Ogni inserimento/modifica/eliminazione su `premi_garanzia_polizza` viene già loggato dal sistema audit automatico (trigger `audit_row_changes` esiste sulle entità principali — verrà esteso a questa tabella).
- Visibile nel tab "Log Attività" del titolo.

## Step implementativi

1. Migrazione: aggiunta colonne a `premi_garanzia_polizza`, creazione `aliquote_provinciali_rca` + seed, attach trigger audit.
2. Hook `useVociRcaTitolo(titoloId)` con CRUD + ensure-RCA (crea riga RCA Auto se mancante all'apertura).
3. Componente `<VociRcaCard />` (tabella + popover aggiungi + card totali).
4. Integrazione in `TitoloDetail.tsx` come nuova tab visibile solo per rami RCA.
5. Memoria progetto aggiornata: regola "RCA: imposta provinciale variabile + SSN 10,5% sull'imposta; voci accessorie usano `rca_garanzie.aliquota_tasse`".

## Domande aperte da confermare in build

- Aliquota di default per le **voci accessorie** auto: 22,25% (standard) o 13,5% come indicato? Proposta: leggere `rca_garanzie.aliquota_tasse` per voce, fallback 22,25%.
- Aliquota provinciale: precompilare automaticamente da `clienti.provincia_residenza` o lasciare sempre a 16% editabile?
