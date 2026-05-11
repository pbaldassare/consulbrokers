## Obiettivo
Allineare le aliquote tasse dei `rami` del catalogo con la tabella Excel fornita (27 categorie di prodotto → percentuale imposta).

## Mapping proposto (xlsx → rami)

Raggruppo per aliquota e mappo per parole chiave nella `descrizione`:

| Aliquota xlsx | Rami DB target (match per descrizione) |
|---|---|
| **22.25%** | ALL RISK*, ALL PATRIMONIO, AVIATION, CYBER*, D&O, ELETTRONICA, FURTO, INCENDIO*, LEASING, MOSTRE, RC CAPOFAMIGLIA, RC INQUINAMENTO, RC PATRIMONIALE, RCT/O, RC*, RISCHIO MONTAGGIO, CATASTROFALI |
| **21.25%** | TUTELA LEGALE |
| **13.5%** | KASKO (incluso A.R.D / DRA) |
| **12.5%** | ASSISTENZA*, CAUZIONI*, INFORTUNI CONDUCENTE |
| **4.38%** | INFORTUNI CUMULATIVA CON RC ENTE |
| **2.5%** | INFORTUNI CUMULATIVA SENZA RC, MALATTIA, VITA, ANIMALI DOMESTICI |
| **26.5%** | RCA (solo per province VE/TV — vedi nota sotto) |

## Modalità di applicazione

1. **Migration SQL** che aggiorna `rami.aliquota_tasse_ramo` e `aliquota_tasse_ard` con `UPDATE … WHERE descrizione ILIKE …` per ciascun gruppo.
2. **Anteprima**: prima eseguo una `SELECT` per mostrarti la lista dei rami che verranno modificati con vecchio/nuovo valore, così puoi confermare prima dello scrivere la migration definitiva.
3. **Rami non mappati**: lascio invariati e li elenco a fine processo per revisione manuale.

## Punti che richiedono una tua decisione (te li chiedo prima di partire)

- **RCA 26.5% province VE/TV**: oggi `aliquota_tasse_ramo` è un singolo numero per ramo, non per provincia. Tre opzioni:
  - (a) lascio RCA al valore attuale (12.5% nazionale) e gestisco le province ad alta aliquota tramite override sul titolo;
  - (b) imposto 26.5% di default su tutti i rami RCA (rischioso, sovrastima per le altre province);
  - (c) aggiungo una nuova tabella `aliquote_tasse_provincia` e la consulto in calcolo (richiede sviluppo).
- **A.R.D.**: aggiorno anche `aliquota_tasse_ard` allo stesso valore della categoria, oppure solo `aliquota_tasse_ramo`?
- **Rami non presenti in xlsx** (es. AUTENTICA FIRMA, AVIAZIONE CORPI, ecc.): li lascio invariati, ok?

## Out of scope
- Logica di calcolo tasse nelle pagine titolo (resta invariata, legge solo il nuovo valore).
- Modifiche a UI Tabelle di Base.

Dopo la tua conferma sui 3 punti decisionali, eseguo: SELECT di anteprima → migration di UPDATE → report finale dei rami non aggiornati.
