## Obiettivo

Recepire la regola di dominio:

> Ogni record in `compagnie` di tipo **agenzia / direzione / broker / plurimandataria** rappresenta **già di per sé un rapporto** (il *rapporto principale*). La tabella `compagnia_rapporti` contiene **solo i rapporti aggiuntivi** (plurimandatarie / co-assicurazioni).
> Conseguenza: il conteggio mostrato nella colonna "Rapporti" della tab **Agenzie** deve essere **`compagnia_rapporti.attivi + 1`** (mai 0). Non vanno mai creati record fittizi in `compagnia_rapporti` per rappresentare il rapporto principale.

## Modifiche

### 1) Memoria di progetto
Creare `mem://insurance/rapporto-principale-implicito` con la regola, e referenziarla in `mem://index.md` sotto "Memories".

Bullet di sintesi:
> Rapporto principale implicito — Ogni agenzia/direzione in `compagnie` è già il proprio rapporto principale; il conteggio "Rapporti" UI = `compagnia_rapporti.attivi + 1`. Non duplicare in `compagnia_rapporti`.

### 2) UI — `src/pages/CompagnieList.tsx` (tab Agenzie)
Modificare la cella della colonna "Rapporti" (intorno alla linea 1687-1697) per:
- visualizzare `rc.attivi + 1` (e `(rc.tot + 1)` se ci sono inattivi)
- aggiornare il `title` del bottone in: *"Gestisci rapporti aggiuntivi (oltre al rapporto principale)"*
- mantenere lo stile "default" (riempito) quando `rc.attivi >= 1` (cioè quando esiste almeno un rapporto aggiuntivo oltre al principale)

Nessuna modifica al DB e nessuna migrazione: il +1 è puramente di presentazione.

### 3) Nessun altro touch
- Non modifico `RapportiCompagniaDialog` (gestisce correttamente solo i rapporti aggiuntivi N:N).
- Non modifico l'RPC `get_rapporti_counts_per_compagnia`.
- Lascio invariata la card "Rapporti aggiuntivi (plurimandatarie)" in fondo al dettaglio Compagnia: il testo già dice "aggiuntivi", coerente con la regola.

## Verifica
- Aprire `/compagnie` → tab **Agenzie** → filtrare "vene" → la riga **Generali Venezia** deve mostrare **1** in Rapporti (non 0).
- Per un'agenzia plurimandataria con 2 rapporti aggiuntivi in `compagnia_rapporti`, la colonna deve mostrare **3**.

## File toccati
- `.lovable/memory/insurance/rapporto-principale-implicito.md` (nuovo)
- `.lovable/memory/index.md` (aggiunta bullet)
- `src/pages/CompagnieList.tsx` (cella colonna Rapporti)

## Fuori scope (per giro successivo, su tua richiesta)
- Re-analisi dell'Excel "carico mese giugno napoli" con la nuova regola.
- Dedup clienti *Santa Marina Salina* e *Consulbrokers*.
- Verifica esistenza agenzie *AIB All Insurance Broker* (Lloyd's) e *ASSIB Underwriting* (AIG).
