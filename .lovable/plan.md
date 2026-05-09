## Obiettivo

Estendere il **linguaggio grafico moderno** già adottato per RCA Auto su `TitoloDetail` (header polizza con Cliente · Sede · Importo Firma, card Importi con voci Firma/Quietanza, scansione AI, card Operazioni e Messa a Cassa riordinate) a **tutti i rami** e a **tutte le pagine del ciclo polizza**, senza eliminare alcun dato esistente.

## Stato attuale (cosa c'è già)

- `TitoloDetail.tsx` — pagina dettaglio con il nuovo look, MA limita le due card `VociRcaCard` (Firma/Quietanza) e il pulsante `ImportPolizzaAiButton` ai soli rami auto/nautica (`isRamoAuto`).
- `VociRcaCard` (1129 righe) e `ImportPolizzaAiButton` (420 righe) sono usati **solo** in `TitoloDetail`.
- Le altre pagine ciclo polizza usano layout legacy:
  - `ImmissionePolizzaPage` (1276 righe) — nuova emissione
  - `RinnoviPolizzaPage`, `AppendiciPolizzaPage`, `DuplicazionePolizzaPage`
  - `SospensionePolizzaPage`, `RiattivazionePolizzaPage`, `StornoPolizzaPage`
  - List view: `PortafoglioCaricoPage`, `PortafoglioAttivePage` (header card delle polizze)

## Piano di lavoro (in fasi, ognuna verificabile)

### Fase 1 — Componenti condivisi riutilizzabili
Estraggo da `TitoloDetail` tre blocchi in nuovi componenti per riuso pulito:

1. `src/components/polizze/PolizzaHeaderCard.tsx`
   Header uniforme: numero polizza, Cliente · Sede · Importo Firma, compagnia/prodotto secondari, badge stato. Props: `titolo` o `formData`.
2. `src/components/polizze/PolizzaImportiCard.tsx`
   Wrapper della sezione Importi che monta `VociRcaCard` Firma + Quietanza affiancate, scansione AI integrata, totali editabili. Funziona per **tutti i rami**, non solo auto.
3. `src/components/polizze/PolizzaOperazioniCard.tsx`
   Card unificata Operazioni + Messa a Cassa (3 date, badge fondi, banner anti-doppio-incasso) già rifinita per RCA, riusabile.

### Fase 2 — Estendere VociRcaCard a tutti i rami
- Rimuovere il gating `isRamoAuto` per la riga "principale": per i rami non-auto la voce principale prende il **nome del ramo** (es. "Premio Incendio", "Premio RCT") al posto di "RCA Auto".
- Mantenere il calcolo IPT/SSN normativo per auto/nautica; per gli altri rami usare la formula accessoria `lordo = netto × (1+aliquota%)` con aliquota dal ramo (`aliquota_tasse_ramo`).
- Garanzie aggiuntive: come oggi, già funzionano cross-ramo.
- `mainLabel` calcolata in base al ramo; nessuna riga obbligatoria non rimovibile per i rami non-auto.

### Fase 3 — Estendere ImportPolizzaAiButton a tutti i rami
- Aggiornare il prompt Gemini per supportare anche rami danni/vita/sanitari (oggi è tarato su RCA).
- Mostrare il pulsante in tutte le pagine polizza, non solo nei rami auto.

### Fase 4 — Adottare i nuovi componenti nelle altre pagine
Sostituire i blocchi legacy con i componenti condivisi, mantenendo intatti i campi/dati salvati:

- `ImmissionePolizzaPage` — header + Importi card + scansione AI (utile per popolare il form da un PDF)
- `RinnoviPolizzaPage` — header + Importi card + scansione AI
- `AppendiciPolizzaPage` — header + Importi card per appendici tariffarie
- `DuplicazionePolizzaPage` — header preview e Importi pre-compilati
- `SospensionePolizzaPage`, `RiattivazionePolizzaPage`, `StornoPolizzaPage` — solo header uniforme + readonly delle Operazioni
- `PortafoglioAttivePage` / `PortafoglioCaricoPage` — uniformare le card di lista al medesimo stile (badge, palette teal, tipografia tabular-nums)

### Fase 5 — Verifica
- Aprire una polizza di ciascun ramo principale (RCA, Incendio, Infortuni, Sanitaria, Vita, RCT) e confermare che header + Importi + Operazioni siano coerenti.
- Verificare che nessun campo esistente in DB venga perso: i nuovi componenti scrivono sulle stesse colonne di oggi.
- Confermare che la scansione AI parta da Immissione/Rinnovi e popoli i form.

## File coinvolti

Nuovi:
- `src/components/polizze/PolizzaHeaderCard.tsx`
- `src/components/polizze/PolizzaImportiCard.tsx`
- `src/components/polizze/PolizzaOperazioniCard.tsx`

Modificati:
- `src/components/polizze/VociRcaCard.tsx` (generalizzazione cross-ramo)
- `src/components/polizze/ImportPolizzaAiButton.tsx` (prompt cross-ramo)
- `src/pages/TitoloDetail.tsx` (sostituisce blocchi inline con i nuovi componenti, rimuove gating `isRamoAuto`)
- `src/pages/ImmissionePolizzaPage.tsx`
- `src/pages/RinnoviPolizzaPage.tsx`
- `src/pages/AppendiciPolizzaPage.tsx`
- `src/pages/DuplicazionePolizzaPage.tsx`
- `src/pages/SospensionePolizzaPage.tsx`
- `src/pages/RiattivazionePolizzaPage.tsx`
- `src/pages/StornoPolizzaPage.tsx`
- `src/pages/PortafoglioAttivePage.tsx`
- `src/pages/PortafoglioCaricoPage.tsx`

## Note importanti

- **Nessuna migration DB**: lavoriamo solo su frontend/presentazione. I componenti scrivono sugli stessi campi `premi_garanzia_polizza`, `titoli`, `titoli_movimenti` di oggi.
- **Nessun dato eliminato**: la generalizzazione di `VociRcaCard` riusa il sync esistente Firma↔Quietanza che già protegge le voci personalizzate.
- Lavoro grosso (≈8.000 righe coinvolte). Lo affronto in fasi separate, ognuna pronta per verifica nel preview prima di procedere alla successiva — così se qualcosa non ti torna fermiamo subito senza toccare il resto.
