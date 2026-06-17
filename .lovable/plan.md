## Obiettivo

La Regolazione (titolo RG) **non è una quietanza** e non deve apparire come polizza o rata "di pari livello". Deve:
1. essere chiaramente etichettata come **Regolazione** ovunque (header del titolo, liste, filtri);
2. essere **nidificata sotto la quietanza** a cui è stata agganciata in Carico, Polizze Attive, Storico e Gestione Polizze;
3. avere la **propria messa a cassa** (già presente) ma con una toolbar Operazioni ridotta alle sole azioni sensate;
4. mostrare un **link diretto alla quietanza madre** dal dettaglio del titolo RG.

I dati già esistono: `titoli.is_regolazione` e `titoli.regolazione_quietanza_id` (FK alla quietanza fonte). Non servono cambi schema.

---

## 1. Etichetta e header del titolo RG

File: `src/components/titolo/sections/TitoloHeaderBar.tsx`

- Quando `titolo.is_regolazione === true`:
  - Sostituire il badge "Polizza originale" con un badge **`Regolazione`** (variant distintivo, es. arancione/ambra).
  - Sotto il numero titolo, aggiungere una riga "Regolazione di **{numero polizza madre} · Rata {n}** ({periodo})" con link cliccabile alla quietanza madre (`/titoli/{regolazione_quietanza_id}`).
  - Non mostrare la riga "Quietanza · dal … al …" tipica delle rate.
- Mostrare il periodo coperto dalla regolazione (data effetto → data scadenza dell'appendice) come info secondaria.

## 2. Toolbar Operazioni ridotta sul titolo RG

File: `src/pages/TitoloDetail.tsx` (o il componente `OperazioniBar` dove sono renderizzati i bottoni).

- Se `titolo.is_regolazione === true`: mostrare **solo** Messa a Cassa (Incassa/Garantito), Storno e Annullamento.
- Nascondere: Sospensione, Riattivazione, Sostituzione, Estinzione, Appendici, Regolazione, Precontrattuale, Scansione AI, Reinvia notifica.
- Aggiungere un piccolo banner informativo sopra la toolbar: "Questo titolo è una Regolazione collegata alla Rata X della polizza ...".

## 3. Nidificazione nelle liste di portafoglio

Riguarda i listati che oggi pescano da `titoli` o da `v_portafoglio_*`. Verificare e patchare le pagine/queries di:

- `src/pages/GestionePolizzePage.tsx`
- `src/pages/portafoglio/CaricoMesePage.tsx` (o analoghe – Carico)
- Polizze Attive
- Storico Polizze

Pattern di nidificazione (lato client, senza toccare il DB):

```text
[+]  Polizza 123456 (madre)
       └─ Rata 1 · 01/01 → 31/03 · 1.000 €
            └─ [Regolazione] RG1 · 1.222 € · Da incassare
       └─ Rata 2 · 01/04 → 30/06 · 1.000 €
       └─ Rata 3 …
```

Implementazione:
- Recuperare nella stessa query anche i titoli con `is_regolazione=true` per i `regolazione_quietanza_id` presenti nella pagina corrente (un secondo `select` mirato, oppure include nella query principale e raggruppamento client-side per `regolazione_quietanza_id`).
- Le RG NON compaiono come righe di primo livello: solo come figlie espandibili sotto la rata di riferimento, con icona di rientro e badge "Regolazione".
- Le colonne mostrate per la RG sono le sue (premio lordo, stato, messa a cassa, azioni). Conserva ordinamento per data garanzia / messa a cassa.
- In Storico la RG segue lo stato della quietanza (rimane figlia anche se la quietanza è incassata/chiusa).

## 4. Filtro "Tipo" e badge nelle tabelle

- Nei filtri Tipo già presenti (Polizza/Quietanza, vedi memoria "Polizza vs Quietanza filtering" basata su `sostituisce_polizza`) aggiungere **Regolazione** come opzione esplicita, mappata su `is_regolazione=true`.
- Nelle colonne tipo/badge: badge "Regolazione" arancione, sostituisce il badge Polizza/Quietanza per le righe RG.

## 5. Pagina di dettaglio della quietanza madre

File: `src/pages/TitoloDetail.tsx` (versione quando il titolo NON è regolazione)

- Aggiungere un pannello/sezione "Regolazioni collegate" che elenca tutti i `titoli` con `regolazione_quietanza_id = id`, con numero, importo, stato e link al dettaglio.
- Mostrare un counter nelle azioni rapide (es. "Regolazioni: 1").

## 6. Coerenza dialog Regolazione

File: `src/components/polizze/azioni/AppendiceDialog.tsx`

- Nessun cambio funzionale: continua a creare appendice + RG via `crea_titolo_da_regolazione`.
- Nel SearchableSelect quietanze: assicurarsi di **escludere** la polizza madre quando `sostituisce_polizza` è null e non ci sono rate (caso "polizza unica"): in quel caso la regolazione si aggancia comunque alla "rata 1" che coincide con la madre — comportamento già corretto, ma serve un testo esplicativo nel popup.

## 7. Nessuna migrazione schema

Tutti i campi necessari esistono (`is_regolazione`, `regolazione_quietanza_id`, FK al titolo madre via `numero_titolo`). Solo modifiche frontend.

---

## Dettagli tecnici

- **Nidificazione lato client**: usare un singolo `useMemo` per costruire `Map<quietanzaId, Regolazione[]>` da affiancare alla riga padre nella tabella. Riga RG è renderizzata con `pl-8` + icona `CornerDownRight`.
- **Stato espansione**: salvare in `useState<Set<string>>` le rate espanse; di default tutte le rate che hanno almeno una RG sono espanse.
- **Etichetta dettaglio**: helper `getTitoloKind(t) => "polizza" | "quietanza" | "regolazione"` per evitare condizioni sparse.
- **Performance**: la query extra per le RG accetta gli stessi filtri di periodo della query principale; nessun N+1.
- **Test manuale**:
  1. Apri un titolo madre, crea una regolazione su Rata 1 → controlla che in Gestione Polizze la RG appaia come figlia di Rata 1.
  2. Apri il titolo RG → header con badge "Regolazione" e link alla Rata 1.
  3. Verifica toolbar: solo Messa a Cassa, Storno, Annullamento.
  4. Esegui Messa a Cassa sulla RG → stato passa a "incassato" indipendentemente dalla rata.
  5. Apri il titolo madre Rata 1 → sezione "Regolazioni collegate" mostra la RG.

## Fuori scope (per ora)

- Spostare la RG sotto la polizza madre invece che sotto la quietanza (richiede impostazione utente).
- Stampe / export aggiornati con la struttura nidificata: da gestire in un'iterazione successiva.
- Permessi differenziati sul titolo RG (oggi seguono quelli della tabella `titoli`).
