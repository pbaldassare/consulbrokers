
## Obiettivo

Quando confermi l'immissione polizza, la **scheda dettaglio titolo** deve mostrare gli stessi campi e la stessa grafica del form di immissione (le card "Composizione Premio Firma/Quietanza", frazionamento testuale, Ramo+Sottoramo coordinati), non più le vecchie sezioni "Importi" con `premio_netto / addizionali / tasse / lordo` editabili a mano e i numeri 1/2/3 sul frazionamento. E le operazioni (Messa a Cassa, Sospensione, Rinnovo, Storno, Appendici) devono restare funzionanti partendo dalla nuova vista.

## Cosa cambia in `src/pages/TitoloDetail.tsx`

### 1. Sezione "Importi" — semplificare drasticamente
Oggi (righe ~2579–2750) c'è un editor inline che duplica i totali (Netto Firma / Addizionali / Tasse / Lordo / Provvigioni / Netto Quietanza / Addizionali Q. / Tasse Q. / Provvigioni Q.). Questi valori sono ora **derivati** dalle righe in `premi_garanzia_polizza` (mirroring DB Firma → Quietanza già attivo) e dalle card `VociRcaCard`.

Nuova sezione "Importi" ridotta a:
- **Riepilogo totali read-only** (Netto/Tasse/Lordo Firma + idem Quietanza) calcolati dalle righe garanzia.
- **Valuta / Cambio** (modificabili).
- **Flag**: Indicizzata, Rimborso, No Calcolo Tasse, Pag. Diretto Agenzia, Emissione Fee, Formato Elettronico (allineati all'immissione).
- Split provvigioni Firma/Quietanza già presente — invariato.
- Eliminare il blocco editor con `editingImporti` / `startEditImporti` / `saveImportiMutation` per i campi premio: i premi si modificano **solo** dalle card Composizione (già implementato con debounced UPDATE).

I campi DB `premio_netto / addizionali / tasse / premio_lordo / premio_netto_quietanza / addizionali_quietanza / tasse_quietanza` continuano ad essere scritti in automatico dalle card / mirror trigger — nessuna modifica al DB.

### 2. Sezione "Periodo" — pulizia
- Rimuovere la `FieldRow "Rate"` numerica dalla vista read-only (riga ~2123 area): ora è derivata dal frazionamento testuale e ridondante.
- In edit mode rimuovere l'input "Rate" libero; mostrare solo il `Select` Frazionamento (Mensile/Trimestrale/Quadrimestrale/Semestrale/Annuale/Poliennale) — il `rate` viene calcolato via `frazionamentoToRate()` al salvataggio (già fatto a riga 754).
- Verificare che la vista read-only usi `derivaFrazionamentoDaRate` come fallback per polizze legacy (già a riga 2123, OK).

### 3. Ramo / Sottoramo
La modifica contratto in TitoloDetail usa già `RamoSottoramoSelect` legacy (vedi memoria `ramo-sottoramo-coordinated-selection`). Allinearla al pattern di immissione **non è obbligatorio** per questa richiesta; lo lasciamo invariato per non toccare la logica di salvataggio sottoramo-per-riga (richiederebbe refactor delle card già funzionanti). Aggiungere però una **nota visibile** sotto la card Composizione: "Il Sottoramo si imposta riga per riga nelle card Premio".

### 4. Card "FatturaPA" / "Cont. Generale" residue
Audit rapido di TitoloDetail e TitoloTabs alla ricerca di sezioni residue legacy (FatturaPA, Fido Credito, Tipo Sommario, etc.). Se trovate, rimuovere coerentemente con `mem://navigation/legacy-pages-removed`.

## Cosa NON cambia
- Schema DB (nessuna migration).
- Mirror Firma → Quietanza (`sync_quietanza_da_firma`).
- Operazioni polizza: Messa a Cassa, Sospensione/Riattivazione, Rinnovo, Storno, Appendici — restano collegate ai bottoni esistenti nell'header del dettaglio.
- `ImmissionePolizzaPage` — già nuova, nessuna modifica.

## File toccati
- `src/pages/TitoloDetail.tsx` — refactor sezione Importi + pulizia Periodo (riduzione ~200 righe).
- `src/components/titolo/TitoloTabs.tsx` — solo se contiene tab/card legacy (da verificare in fase build).
- `mem://insurance/titolo-detail-allineato-immissione` (nuovo) — fissa il principio "TitoloDetail rispecchia ImmissionePolizzaPage; i premi si editano solo dalle card Composizione".

## Esempio concreto del risultato (cosa vedrai dopo Conferma)

Polizza appena salvata, ramo ZQ — R.C.A.:

```text
[Periodo]                                     [✏︎ Modifica]
Decorrenza  01/06/2026     Scadenza  01/06/2027
Frazionamento  Semestrale  Tacito Rinnovo  Sì
Mora 30 gg  Disdetta 2 mesi

[Importi]                                     (read-only riepilogo)
Firma     Netto € 350,00  Tasse € 73,50  Lordo € 423,50
Quietanza Netto € 350,00  Tasse € 73,50  Lordo € 423,50
Valuta EUR · Indicizzata ☐ · Rimborso ☐ · No Calc. Tasse ☐ …

[Composizione Premio — Firma]   (editabile, card teal)
PI · R.C. AUTOVEICOLI         Netto 300,00  IPT 12,5%  SSN 10,5%  Lordo 369,00
RV01 · Furto/Incendio         Netto  50,00  Tasse 13,5%          Lordo  56,75
[+ Aggiungi voce]

[Composizione Premio — Quietanza]  (card amber, mirror automatico)
…stesse righe, modificabili → flag "personalizzata"

[Provvigioni — Commerciale]  Sede 100% — 40% (€ 134,40)
[Split per produttore]       INTERFIDI 40% · Sede 60%
```

Operazioni accessibili dall'header: **Messa a Cassa · Sospendi · Rinnova · Storna · Appendici** (invariate).
