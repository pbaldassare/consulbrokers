## Obiettivo
Semplificare la pagina `Compagnie / Agenzie` rimuovendo il tab ridondante "Import Provvigioni IA", aggiungere un elenco riepilogativo "Agenzie e provvigioni attive" e sistemare gli spacing problematici della toolbar.

## 1. Rimozione tab "Import Provvigioni IA"
- In `src/pages/CompagnieList.tsx`:
  - Rimuovere il `TabsTrigger value="import-provvigioni"` e il relativo `TabsContent`.
  - Rimuovere l'import `ImportProvvigioniTab` (non più usato).
  - Aggiornare la `TabsList` a 3 tab: Compagnie Assicurative · Agenzie · Provvigioni.
- L'import IA resta comunque disponibile **dentro** il tab Provvigioni tramite il pulsante "Import IA" già presente in `ProvvigioniRapportiTab` (apre `aiOpen`), quindi nessuna funzionalità viene persa.

## 2. Nuovo pannello "Agenzie con provvigioni attive"
Nel tab **Provvigioni** (`ProvvigioniRapportiTab.tsx`), sopra alla matrice rami/sottorami, aggiungere una sezione collassabile (default chiusa) `Elenco rapporti attivi (N)` che mostra una tabella compatta con:

- Compagnia (gruppo) · Rapporto (nome + tipo) · Sede/Agenzia · Default ramo configurati / totali · Sottorami configurati / totali · % default globale · Azioni (Apri / Copia da / Export).
- Sorgenti: stessa query `all-compagnia-rapporti` già caricata + aggregato da `compagnia_rapporto_rami` (count configurati per rapporto). Una singola query aggregata `select compagnia_rapporto_id, count(*)` evita N+1.
- Click sulla riga → imposta `rapportoId` (riusa lo stato già esistente, niente nuova logica) e scrolla alla matrice.
- Filtro testo e filtro stato (`Tutti / Configurati / Mancanti`) riusano gli stessi setter già esistenti.

Vantaggio: l'utente vede a colpo d'occhio quali agenzie hanno provvigioni già impostate e quali no, senza dover scorrere il select uno per uno.

## 3. Fix spacing della toolbar Provvigioni
Dallo screenshot si vedono i seguenti problemi sopra "Cerca Ramo o Sottoramo…":
- Il badge "Tipo Agenzia" si sovrappone al select rapporto (collisione testo lungo + badge assoluto).
- Bottoni `‹ ›`, `Incolla CSV`, `Copia da altro`, `Import IA` troppo stretti, vanno a capo male a 1257px.
- Spaziatura verticale fra "Rapporto Agenzia ↔ Compagnia", select e riga azioni incoerente.

Interventi mirati in `ProvvigioniRapportiTab.tsx` (solo CSS / layout, niente logica):
- Sostituire la riga unica con un `grid` responsive: prima riga = label + tipo + export; seconda riga = `[‹] [SearchableSelect flex-1] [›]`; terza riga = azioni (`Incolla CSV`, `Copia da altro`, `Import IA`) raggruppate a destra con `flex-wrap gap-2`.
- Spostare il badge "Tipo Agenzia" **dentro** l'etichetta del select (badge inline accanto al nome del rapporto) invece di posizionarlo sopra.
- Allineare il pannello `Catena di risoluzione` e `Default globali` con `space-y-3` coerente; rimuovere `mt-4` ridondanti.
- Toolbar filtri (Tutti/Configurati/Mancanti/Solo default + contatori + Espandi/Collassa): convertire in `flex flex-wrap items-center justify-between gap-3` con i contatori in `text-xs text-muted-foreground` su una singola riga ben spaziata.

## Out of scope
- Nessuna modifica al DB.
- Nessuna modifica alla logica di calcolo provvigioni o ai trigger.
- `ImportProvvigioniTab.tsx` resta nel codebase (non rimuoviamo il file, solo l'accesso dal tab) nel caso serva riattivarlo.

## File toccati
- `src/pages/CompagnieList.tsx` — rimozione tab + import
- `src/components/compagnie/ProvvigioniRapportiTab.tsx` — nuovo pannello elenco + restyling toolbar
