
## Obiettivo

Nella pagina **Compagnie / Agenzie** → tab **Compagnie**, attualmente la colonna "Agenzie collegate" mostra solo un badge col conteggio (es. ALLIANZ → 20). L'utente vuole poter cliccare su quel badge per vedere **quali sono** le agenzie/sedi collegate a quella compagnia madre.

## Cosa cambia per l'utente

- Il badge numerico nella colonna "Agenzie collegate" diventa **cliccabile** (cursor pointer + hover evidenziato).
- Cliccando si apre un **dialog** intitolato *"Agenzie collegate a {NOME COMPAGNIA}"* con una tabella che elenca:
  - Codice agenzia (es. GC011)
  - Nome / nome sede
  - Comune + provincia
  - Stato (Attiva / Sospesa / Non Operativa)
  - Pulsante "Apri" che porta alla scheda dell'agenzia (apre il dialog di modifica esistente nella tab Agenzie)
- Filtro di ricerca testuale dentro il dialog (utile per gruppi grandi come ALLIANZ con 20 agenzie).
- Click sulla riga della tabella della compagnia continua a funzionare come oggi (apre il dialog di modifica della compagnia madre); il click sul badge ferma la propagazione.
- Se il conteggio è 0, il badge resta non cliccabile (come oggi).

## Modifiche tecniche

**File da modificare**: `src/pages/CompagnieList.tsx`

1. Nuovo state nel componente `CompagnieMadriTab`:
   - `agenzieDialog: { gruppoId: string; gruppoDescrizione: string } | null`

2. Nuovo componente interno `AgenzieCollegateDialog` che:
   - Riceve `gruppoId`, `gruppoDescrizione`, `onClose`
   - Esegue una `useQuery` su `compagnie` filtrando per `gruppo_compagnia_id = gruppoId`, selezionando `id, codice, nome, nome_sede, comune, provincia, stato`, ordinando per `nome`
   - Mostra una `Input` di ricerca + `Table` con le colonne descritte sopra
   - Ogni riga ha un bottone che chiude il dialog ed emette un evento per aprire la scheda agenzia (vedi punto 4)

3. Nel `<TableCell>` della colonna "Agenzie collegate" (riga 863-865):
   - Wrappare il `Badge` in un `<button>` con `onClick={(e) => { e.stopPropagation(); setAgenzieDialog({...}); }}`
   - Disabilitato quando `agenzie_count === 0`
   - Tooltip "Vedi agenzie collegate"

4. Per il bottone "Apri" che porta alla scheda agenzia: dato che le tab Compagnie e Agenzie sono nello stesso file, sollevo lo state in `CompagnieList` (componente padre):
   - Aggiungo prop opzionale `onOpenAgenzia?: (compagniaId: string) => void` a `CompagnieMadriTab`
   - Il padre passa una callback che fa `setActiveTab("agenzie")` e setta uno state `pendingOpenAgenziaId` letto dalla tab Agenzie per aprire automaticamente il dialog di edit.

5. Nessuna modifica al database — i dati esistono già (`compagnie.gruppo_compagnia_id`).

## Note

- Per gruppi grandi (PLURIMANDATARIO con 54 agenzie), la lista è scrollabile con `max-h-[60vh] overflow-auto`.
- Performance: la query è leggera (filtro indicizzato su FK), nessun problema atteso.
