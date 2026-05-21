## Obiettivo
Rendere la matrice `Provvigioni Compagnie/Ramo` più usabile quando un rapporto ha molti Rami abilitati. Logica e modello dati restano invariati: lavoriamo solo su UI/UX in `ProvvigioniRapportiTab.tsx` e `ProvvigioniCompagnieRamoPage.tsx`.

## Cosa cambia (UX)

### 1. Raggruppamento Rami collassabile
Ogni Ramo (gruppo) diventa una card/accordion espandibile, non più righe piatte in tabella unica.
- Header sempre visibile: codice + descrizione Ramo, badge "default ramo %", contatore `X/Y sottorami configurati`, mini-azioni inline.
- Body (collassato di default se >5 sottorami): tabella sottorami.
- Toggle globale "Espandi tutti / Collassa tutti".

### 2. Bulk-apply su gruppo Ramo
Nell'header del Ramo, due nuove azioni:
- **Applica % a tutti i sottorami** — input + bottone: scrive la stessa % a tutti i sottorami abilitati del Ramo.
- **Resetta sottorami** — rimuove tutti gli override del Ramo (lasciando solo il default ramo → eredita).
Entrambe con popup di conferma.

### 3. Filtri e ricerca sulla matrice
Toolbar sopra la matrice:
- Search box (filtra per codice/descrizione Ramo o Sottoramo).
- Filtro stato: `Tutti | Configurati | Mancanti (eredita) | Solo default ramo`.
- Counter live "12 Rami · 47 sottorami · 18 configurati".

### 4. Toolbar sticky + selezione rapporto migliorata
- La barra con `Rapporto`, `Tipo`, `Incolla CSV / Copia / IA / Export` diventa sticky in top.
- Nel selettore Rapporto: raggruppamento per Compagnia madre (option groups) e badge tipo a destra.
- Aggiunta scorciatoia "Rapporto precedente / successivo" (frecce) per scorrere senza riaprire la select.

### 5. Default tipo rapporto sempre visibile (mini banner)
Quando un Ramo non ha né default né sottorami configurati, mostriamo inline la % che verrebbe ereditata dal `provvigioni_default_tipo` (livello 4) come hint grigio, così l'utente vede subito "se non scrivi nulla qui, applico X%".

### 6. Persist UI state
`localStorage` per: ultimo rapporto selezionato, stato espanso/collassato per gruppo, filtri attivi. Così riaprendo la pagina si ritrova il contesto.

### 7. Microinterazioni
- Salvataggio inline su blur già esiste → aggiungere flash verde 600ms sulla riga salvata.
- Su mobile/viewport stretto: la matrice diventa lista di card (no scroll orizzontale).
- Tooltip su badge `eredita` che mostra il livello della catena di risoluzione (1-5) applicato.

## Cosa NON cambia
- Schema DB, mutazioni, edge functions, helper `resolveProvvigione.ts`.
- Catena di risoluzione a 5 livelli.
- Logica Incolla CSV / Copia da altro / Import IA.
- Componente Default tipo rapporto (resta in accordion, ma spostato sotto la toolbar).

## File toccati
- `src/components/compagnie/ProvvigioniRapportiTab.tsx` — refactor render della matrice in `RamoBlock` collassabile, nuova toolbar filtri, bulk actions, sticky.
- `src/pages/ProvvigioniCompagnieRamoPage.tsx` — wrapper invariato, eventuale layout sticky-friendly.

## Domande aperte
1. **Default collapse**: collassare tutti i Rami di default, o solo quelli senza override?
2. **Bulk-apply**: vuoi che sovrascriva anche i sottorami già configurati, o solo quelli vuoti (con toggle)?
3. **Mobile/card view**: priorità o nice-to-have?
