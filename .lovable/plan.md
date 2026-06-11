## Libreria CGA — Catalogo condiviso dei dati generici estratti

### Principio chiave (separazione dei dati)

L'analisi AI di un PDF di CGA produce **due famiglie di dati**, che restano separate:

| Tipo | Tabella | Cosa contiene | Visibilità |
|---|---|---|---|
| **Generici** (prodotto/compagnia) | `prodotti_cga` (+ `prodotti_garanzie`, `prodotti_condizioni`) | Massimali standard, franchigie, scoperti, garanzie, esclusioni, definizioni, condizioni generali | **Condivisa** tra tutti gli utenti autenticati — non legata al cliente |
| **Personali** (polizza/cliente) | `polizza_cga`, `polizza_garanzie_personali` | Contraente, assicurato, beneficiari, importi reali, appendici specifiche, oggetto assicurato | **Solo cliente proprietario + utenti con privilegi commerciali su quel cliente** (RLS esistente via `get_my_cliente_ids()` / visibilità commerciale — già in vigore, non si tocca) |

La nuova sezione mostra **SOLO la parte generica**. I dati personali restano dove sono già, protetti dalla RLS esistente sulla scheda cliente/polizza.

### Cosa costruiamo

Nuova **tab "Libreria CGA"** dentro `/documentale`, accanto alle tab esistenti.

#### Vista lista (tabella filtrabile)

Colonne:
- Compagnia
- Ramo / Gruppo Ramo
- Prodotto (nome)
- Ultima analisi (data)
- Versioni (badge numerico se >1)
- Azioni (Apri dettaglio)

Filtri in alto (debounce 350ms, paginazione server 25/pagina):
- Compagnia (`SearchableSelect` da `compagnie`)
- Ramo / Sottoramo (componente `RamoSottoramoSelect` già esistente)
- Ricerca testuale su nome prodotto
- Range data analisi

Deduplica: una riga per coppia **(compagnia_id, prodotto_nome, ramo)** mostrando solo la **versione più recente** di `prodotti_cga`; badge `vN` con cronologia accessibile dal dettaglio.

#### Vista dettaglio (drawer/dialog a sezioni)

Apertura su riga → pannello strutturato, **senza JSON raw**, organizzato in sezioni accordion:

1. **Intestazione** — Compagnia, Prodotto, Ramo, data analisi, n° versione corrente, link al PDF sorgente in storage
2. **Massimali** — tabella garanzia/massimale/sotto-limiti
3. **Franchigie e scoperti** — tabella garanzia/franchigia/scoperto/minimo
4. **Garanzie standard** — elenco da `prodotti_garanzie`
5. **Esclusioni** — elenco testuale
6. **Condizioni particolari** — da `prodotti_condizioni`
7. **Definizioni** — glossario
8. **Cronologia versioni** — lista versioni precedenti con data e operatore; click → confronto/visualizzazione della vecchia versione

Ogni sezione gestisce graziosamente i campi vuoti (non mostra blocchi vuoti).

### Implementazione tecnica

**Frontend (nessuna nuova migration richiesta)** — i dati sono già in `prodotti_cga`, `prodotti_garanzie`, `prodotti_condizioni`:

- `src/pages/Documentale.tsx` (o equivalente) → aggiungere nuova tab "Libreria CGA"
- `src/components/documentale/LibreriaCgaSection.tsx` → contenitore principale + filtri + tabella
- `src/components/documentale/LibreriaCgaTable.tsx` → tabella zebra con paginazione server-side
- `src/components/documentale/LibreriaCgaDetailDialog.tsx` → dialog dettaglio a sezioni accordion
- `src/components/documentale/LibreriaCgaVersioniDialog.tsx` → cronologia versioni
- `src/hooks/useLibreriaCga.ts` → query paginata con filtri (Compagnia/Ramo/Prodotto/Data) — usa `useServerPagination`, raggruppa per (compagnia_id, prodotto_nome) e ritorna l'ultima versione + count versioni
- `src/hooks/useCgaVersioni.ts` → query versioni storiche per una coppia (compagnia_id, prodotto_nome)
- `src/hooks/useCgaDettaglio.ts` → carica una singola riga `prodotti_cga` con join su `prodotti_garanzie` e `prodotti_condizioni`

**RLS** — le tabelle hanno già policy. Verificare che `prodotti_cga`, `prodotti_garanzie`, `prodotti_condizioni` siano leggibili da `authenticated` (sono dati condivisi, non per-cliente). Se manca la SELECT per `authenticated`, aggiungerla con una piccola migration.

**Niente AI, niente edge functions nuove** — leggiamo solo dati già salvati dalle analisi precedenti.

### Cosa NON cambia

- `polizza_cga` e `polizza_garanzie_personali` non vengono toccate né mostrate qui
- Le RLS commerciali esistenti restano invariate
- L'edge function `parse-cga` non viene modificata
- I dialog `AnalizzaPolizzaCgaDialog` e la sezione `PolizzeCgaSection` nella scheda cliente restano come sono
