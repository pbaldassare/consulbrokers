## Obiettivo

La **Regolazione Premio** non è un'appendice "leggera": è a tutti gli effetti un nuovo titolo `RG` con la stessa ricchezza di una polizza emessa (ramo/sottoramo, garanzie, premio per riga, netto/accessori/tasse/SSN, provvigioni, periodo/frazionamento, ecc.). Va quindi gestita riusando **`ImmissionePolizzaPage`** in modalità "regolazione", collegata alla polizza madre e a una specifica **quietanza di riferimento**.

## Cosa cambia per l'utente

1. **Da Gestione Polizze** (modale "Esegui Appendice"): selezionando `Tipo = Regolazione`, premendo "Crea appendice" NON si salva la riga in `appendici_polizza`, ma si naviga a `/portafoglio/immissione` in modalità regolazione (con polizza e quietanza già impostate).
2. **Da TitoloDetail**: il bottone "Regolazione Premio" non apre più `RegolazionePremioDialog` (form a 5 campi), ma naviga alla stessa pagina in modalità regolazione, con la quietanza corrente preselezionata.
3. La pagina mostra in alto un **banner ambra** "Regolazione della polizza N° … — quietanza di riferimento …" con `SearchableSelect` per cambiare la quietanza tra tutte le rate della polizza madre.
4. Le altre tipologie (Modifica, Appendice, Proroga) restano sul modale leggero attuale.

## Comportamento del form Immissione in modalità regolazione

- **Pre-popolamento dalla polizza madre**: cliente, compagnia, rapporto compagnia, ramo/sottoramo, prodotto_nome, AE, split commerciali, sede, frazionamento (di default identico alla madre, modificabile).
- **Campi bloccati**: cliente, compagnia/rapporto, polizza madre (non si possono cambiare — è regolazione di QUESTA polizza).
- **Campi editabili**: tutti gli importi (premio/netto/accessori/tasse/SSN/provvigioni per riga garanzia), periodo di competenza della regolazione, date.
- **Importi negativi ammessi** (a credito cliente): la pagina già supporta valori negativi.
- **Numero titolo**: stesso `numero_polizza` della madre, nuova `riga`, `tipo_movimento = 'RG'`, `sostituisce_polizza = NULL` (non sostituisce nulla), `stato = 'attivo'`, `da_incassare`.
- **Quietanze future**: NON vengono toccate (regola esistente da `policy-storno-regolazione-rules`).
- **Snapshot** in `titoli_regolazioni` con `titolo_id` = nuovo titolo RG, `titolo_madre_id` = polizza madre, **`quietanza_riferimento_id`** = rata selezionata, periodo, importi consolidati, eventuale documento.
- **Movimento `RG`** in `movimenti_polizza` sul titolo madre.
- **Allegato opzionale** (lettera compagnia) caricato come documento del titolo RG.

## Schema dati

Aggiunta colonna **`titoli_regolazioni.quietanza_riferimento_id uuid REFERENCES titoli(id)`** (nullable per retro-compatibilità). Indice su `(titolo_madre_id, quietanza_riferimento_id)`.

Nessuna altra modifica DB: `titoli` ha già `tipo_movimento`, `riga`, e tutti i campi tecnici/economici necessari; `titoli_regolazioni` esiste già.

## Componenti coinvolti

```text
src/pages/ImmissionePolizzaPage.tsx
  └─ legge query params: ?mode=regolazione&titoloMadreId=…&quietanzaRefId=…
  └─ se mode=regolazione:
       - hook useRegolazioneContext(titoloMadreId): carica madre + tutte rate
       - banner ambra in alto con SearchableSelect quietanze
       - precompila stato form da titolo madre
       - lock su cliente/compagnia/rapporto/numero polizza
       - submit: insert titoli (RG) + insert titoli_regolazioni + insert movimenti_polizza (RG)

src/components/polizze/azioni/AppendiceDialog.tsx
  └─ on submit, se tipo === 'regolazione':
       - NON inserisce in appendici_polizza
       - naviga a /portafoglio/immissione?mode=regolazione&titoloMadreId=<id>
       - chiude dialog

src/pages/TitoloDetail.tsx
  └─ bottone "Regolazione Premio":
       - non apre più RegolazionePremioDialog
       - naviga a /portafoglio/immissione?mode=regolazione&titoloMadreId=<thisId>&quietanzaRefId=<thisId>
  └─ RegolazionePremioDialog rimosso dall'import (componente non più usato — file mantenuto per ora, eliminato in cleanup successivo se confermato)

src/components/polizze/RegolazioneBanner.tsx  [NUOVO]
  └─ banner ambra con: "Regolazione polizza N°… (cliente…)" + SearchableSelect quietanze + bottone "Esci dalla regolazione"
```

## Migrazione SQL

```sql
ALTER TABLE public.titoli_regolazioni
  ADD COLUMN IF NOT EXISTS quietanza_riferimento_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_titoli_regolazioni_quietanza_ref
  ON public.titoli_regolazioni(quietanza_riferimento_id);
```

(nessun nuovo grant: tabella esistente, RLS già configurata)

## Memoria di progetto

Aggiornare `mem://insurance/policy-storno-regolazione-rules` per riflettere che la Regolazione ora passa da `ImmissionePolizzaPage` in `mode=regolazione` con quietanza di riferimento obbligatoria, e che `RegolazionePremioDialog` è deprecato.

## Fuori scopo

- Nessun cambio a Storno, Sostituzione, Sospensione, altre appendici.
- Nessun cambio alle quietanze future della polizza madre.
- Nessuna modifica al calcolo provvigioni (resta come da `resolveProvvigione`).
