

## Rinomina gerarchia: Gruppi → Compagnie → Agenzie (3 livelli, livello 3 vuoto per ora)

### Modello dati confermato dall'utente

| Cosa è oggi nel DB | Cosa diventa nella UI |
|---|---|
| `gruppi_compagnia` (134 record) | **Compagnie** (livello 1) |
| `compagnie` (1.374 record) | **Agenzie** (livello 2) |
| (non esiste) | **Agenzie di riferimento** (livello 3) — non popolato per ora |

> Nota: NON rinomino le tabelle DB (rischio di rompere ~68 riferimenti tra codice e edge functions). Rinomino solo le **label UI**, e creo una tabella nuova solo per il livello 3 quando serve. Per ora il livello 3 lo lascio non implementato come da tua richiesta ("le agenzie di riferimento non le abbiamo").

### Stato attuale dati

- **134** "Compagnie" (oggi `gruppi_compagnia`)
- **1.374** "Agenzie" (oggi `compagnie`), di cui:
  - 1.298 collegate a una Compagnia tramite `gruppo_compagnia_id`
  - 76 senza Compagnia padre (orfane — da assegnare manualmente in seguito)

### Soluzione proposta

#### 1. Spostare la gestione "Compagnie" (ex Gruppi) dentro la pagina `/compagnie`

Trasformo `CompagnieList.tsx` in pagina con **2 tab** (Tab 3 prevista ma disabilitata):

```
[ Compagnie ] [ Agenzie ] [ Agenzie di riferimento (prossimamente) ]
```

- **Tab Compagnie** (nuova) → CRUD su `gruppi_compagnia` (codice, descrizione, attivo). Mostra il count di agenzie figlie per ogni compagnia (es. "Generali — 23 agenzie").
- **Tab Agenzie** → la lista attuale di `compagnie` con tutte le 60+ colonne già presenti, **rinominata** "Agenzie". Il select "Gruppo Compagnia" nella form viene rinominato → "Compagnia di appartenenza".
- **Tab Agenzie di riferimento** → tab disabilitata con badge "Prossimamente" (placeholder — quando deciderai il modello dati la abilito).

#### 2. Rimuovere "Gruppi Compagnia" da `/tabelle-base`

In `TabelleBasePage.tsx` riga 1004 elimino l'entry `gruppi_compagnia` dalla lista delle tabelle base, perché ora la gestione è dentro `/compagnie` (no duplicazione).

#### 3. Rinominare le label UI ovunque (NO rinomina tabelle DB)

| Vecchia label UI | Nuova label UI |
|---|---|
| "Compagnie" (sidebar, breadcrumb, titolo pagina) | **"Compagnie / Agenzie"** (titolo) — sidebar resta "Compagnie" come voce di menu, ma la pagina mostra le 2 tab sopra |
| "Gruppi Compagnia" (TabelleBase, form Compagnie) | **"Compagnia"** |
| "Gruppo Compagnia" (campo singolo) | **"Compagnia di appartenenza"** |
| "Compagnia" (in form Agenzia) | **"Agenzia"** |

Ricerca file da toccare per le label (mi limito a UI labels — i nomi colonne DB e variabili JS restano):
- `src/pages/CompagnieList.tsx` (titolo, header tabella, label form, dialog title)
- `src/pages/TabelleBasePage.tsx` (rimozione entry)
- `src/components/AppSidebar.tsx` (verifica voce "Compagnie" — mantengo nome ma cambio destinazione se serve)
- Eventuali label in form polizza dove appare "Compagnia" → resta "Compagnia" (perché `titoli.compagnia_id` punta proprio al record giusto = Agenzia nel nuovo lessico). **ATTENZIONE**: questo è un punto delicato → vedi sotto.

#### 4. ⚠️ Ambiguità da risolvere subito: nelle polizze "Compagnia" cosa diventa?

Oggi `titoli.compagnia_id → compagnie.id`. Nel nuovo lessico questo è un'**Agenzia**, non una Compagnia.

Due opzioni — devo chiederti **dopo l'approvazione del piano** per non bloccare l'implementazione iniziale:

- **Opzione A (consigliata, no migrazione dati)**: nelle polizze e ovunque ci sia `compagnia_id`, la label UI diventa "Agenzia" (perché punta al record "Agenzia"). Mostro in più una colonna derivata "Compagnia" leggendo `compagnie.gruppo_compagnia_id → gruppi_compagnia.descrizione`.
- **Opzione B (migrazione massiva)**: cambio `titoli.compagnia_id` per puntare a `gruppi_compagnia.id`. Sconsigliato: tocca tutto il sistema (sinistri, provvigioni, rimesse, flussi compagnie, rendiconti, AI, ~30+ file). Rischio molto alto.

**Per questo step iniziale propongo Opzione A**: nessuna migrazione DB, solo rename label e nuovi tab.

### File modificati in questo step

1. **`src/pages/CompagnieList.tsx`** — wrapping con `<Tabs>`, aggiunta tab "Compagnie" (CRUD su `gruppi_compagnia` con count agenzie figlie), rinomina label "Gruppo Compagnia" → "Compagnia di appartenenza" nella form Agenzia, titolo pagina "Compagnie e Agenzie", aggiunta tab disabilitata "Agenzie di riferimento".
2. **`src/pages/TabelleBasePage.tsx`** — rimozione riga 1004 (`gruppi_compagnia` non più qui).
3. **`src/components/AppSidebar.tsx`** — rinomina voce menu "Compagnie" → "Compagnie / Agenzie" (link resta `/compagnie`).
4. (eventuale) **breadcrumb** in `PageBreadcrumb.tsx` se c'è una mappatura statica del titolo `/compagnie`.

### Cosa NON tocco in questo step

- ❌ Tabelle DB (nessuna migrazione, nessun rename di colonne).
- ❌ Edge functions (`import-compagnie`, `calcola-provvigioni`, ecc.) — continuano a usare `compagnie` e `gruppi_compagnia` con i nomi attuali.
- ❌ Logica polizze, sinistri, provvigioni — restano funzionanti identiche, solo le label UI cambiano dove specificato.
- ❌ Nuova tabella per "Agenzie di riferimento" (tab placeholder con badge "Prossimamente" — la creiamo in uno step successivo quando definirai il modello).
- ❌ I 76 record di `compagnie` orfani (senza `gruppo_compagnia_id`): restano così, ma li evidenzio nella tab "Agenzie" con un badge "Senza compagnia" + filtro rapido per assegnarli.

### Verifica

1. `/compagnie` → vedo 3 tab: **Compagnie** (134 record con count agenzie), **Agenzie** (1.374 record con tutte le colonne attuali), **Agenzie di riferimento** (disabilitata, badge "Prossimamente").
2. Tab Compagnie: posso creare/modificare/eliminare un record `gruppi_compagnia` con CRUD completo. Eliminazione bloccata se ha agenzie collegate (mostro warning "Ha N agenzie collegate, riassegnale prima").
3. Tab Agenzie: la form di edit mostra il select "Compagnia di appartenenza" (non più "Gruppo Compagnia").
4. `/tabelle-base` → entry "Gruppi Compagnia" sparita dalla lista.
5. Sidebar: voce "Compagnie / Agenzie" punta a `/compagnie`.
6. Polizze, provvigioni, rimesse, sinistri: tutto continua a funzionare identico (Opzione A, zero migrazione).

### Prossimi step (dopo approvazione di QUESTO piano e implementazione)

- **Step 2**: ti chiederò come vuoi modellare le "Agenzie di riferimento" (1 agenzia → N riferimenti? oppure 1 compagnia → N riferimenti?), e creo la nuova tabella + tab attiva.
- **Step 3**: pulizia dei 76 record orfani (assegnazione manuale tramite UI dedicata o import bulk).

