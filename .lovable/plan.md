
# Refusi Compagnie Assicurative / Agenzie + ricerca tab Agenzie

## Convenzione (già stabilita)
- **Compagnia Assicurativa** = riga di `gruppi_compagnia` (es. ALLIANZ, AIG, AMISSIMA…)
- **Agenzia** = riga di `compagnie` (rapporto agenziale, es. "MED000 - Lloyd's Broker")
- Sotto-tab `value="agenzie"` mostra le **Compagnie Assicurative** (gruppi); sotto-tab `value="anagrafica"` mostra le **Agenzie**.

Oggi nel codice ci sono diversi punti in cui un'entità viene chiamata con il nome dell'altra. Inoltre nel tab "Agenzie" il blocco di ricerca esiste ma è poco visibile/poco coerente con quello del tab gemello.

## File interessato
`src/pages/CompagnieList.tsx`

## Modifiche

### A) Tab "Compagnie Assicurative" — `CompagnieMadriTab` (righe ~791–1088)
Tutto ciò che riguarda i record di `gruppi_compagnia` deve dire **Compagnia Assicurativa**, non Agenzia.

- Placeholder ricerca: `"Cerca agenzia..."` → `"Cerca compagnia assicurativa..."`
- Bottone + dialog: `"Nuova Agenzia"` / titolo `"Nuova Agenzia"` / label `"Crea Agenzia"` → `"Nuova Compagnia Assicurativa"` / `"Crea Compagnia Assicurativa"`
- Dialog di modifica (titolo): aggiungere `"Modifica Compagnia Assicurativa"` (oggi non c'è titolo dedicato; usare lo stesso `renderForm`).
- Toast: `"Agenzia creata"`, `"Agenzia aggiornata"`, `"Agenzia eliminata"` → `"Compagnia assicurativa ..."`.
- Messaggi errore duplicato: `"Esiste già una agenzia con questo nome"` → `"Esiste già una compagnia assicurativa con questo nome"`.
- Toast guard PLURIMANDATARIO: `"Agenzia di sistema (PLURIMANDATARIO): non modificabile/eliminabile"` → `"Compagnia assicurativa di sistema ..."`.
- `CardTitle` interno è già `Compagnie Assicurative ({n})` — invariato.

### B) Pagina principale (intestazione, righe ~1221–1246)
- Sottotitolo: `"... — N compagnie totali"` mostra `compagnie.length` (cioè conteggio di `compagnie` = agenzie). Cambiare in `"N agenzie · M compagnie assicurative"` mostrando entrambi i conteggi (`compagnie.length` per Agenzie, `Object.keys(gruppiMap).length` per Compagnie Assicurative).
- Bottone in alto a destra `"Nuova Agenzia"`: lasciarlo, **ma** renderlo contestuale al tab attivo:
  - Su tab `agenzie` (Compagnie Assicurative): nascondere il bottone (l'azione "Nuova Compagnia Assicurativa" è già dentro il sotto-tab).
  - Su tab `anagrafica` (Agenzie): testo `"Nuova Agenzia"` → invariato; apre il `CompagniaFormDialog` come oggi.
  - Sugli altri tab: nascosto.

### C) Tab "Agenzie" — sezione `TabsContent value="anagrafica"` (righe ~1284–1450)
Il blocco di ricerca esiste già (Card con due Input + filtro Plurimandatario + Reset). Per allinearlo al tab Compagnie Assicurative e renderlo immediatamente riconoscibile:

- Spostare la `Card` di ricerca in cima al tab e racchiuderla in un layout uguale a quello del tab gemello (stesso ordine: ricerca a sinistra full-width con icona, "Reset" a destra, "Nuova Agenzia" a destra del Reset).
- Aggiornare label/placeholder per coerenza:
  - Label sopra il primo input: `"Cerca per nome, sede o codice"` (un'unica label).
  - Placeholder primo input: `"Cerca agenzia..."` (mantenuto).
  - Spostare l'input "Codice..." accanto, larghezza fissa, label `"Codice iniziale"`.
- Mantenere il toggle `"Solo Plurimandatario"` con il suo badge.
- Aggiungere il bottone `"Nuova Agenzia"` anche dentro la Card di ricerca (oltre a quello in alto) per coerenza visiva con il tab Compagnie Assicurative.
- `CardTitle` interno: oggi `"Elenco Agenzie ({filteredAnagrafica.length})"` — invariato.

### D) Dialog "Agenzie collegate a una compagnia assicurativa" — `AgenzieCollegateDialog` (righe ~670–788)
- Titolo dialog: `"Agenzie collegate a {gruppoDescrizione}"` — invariato.
- Verifica testo introduttivo/colonne: dove parla di "compagnia madre" usare **Compagnia Assicurativa**; dove elenca i record usare **Agenzia**.

### E) `CompagniaFormDialog` (form di una Agenzia, righe ~424–657)
Solo etichette in cui si confondono i due livelli:
- Titolo già parametrico (`Nuova Agenzia` / `Modifica Agenzia`) — invariato.
- Tab "Dati Anagrafici": il campo che oggi si chiama "Compagnia" (e collega a `gruppi_compagnia`) deve essere etichettato **"Compagnia Assicurativa (gruppo)"** con placeholder `"Seleziona compagnia assicurativa..."`.
- Eventuali label "Agenzia" che si riferiscono in realtà al gruppo: rinominare in "Compagnia Assicurativa".

## Fuori scope
- Nessuna modifica a schema DB (i nomi tabella `compagnie` / `gruppi_compagnia` restano).
- Nessuna modifica al dialog AI di importazione polizza (`ImportNuovaPolizzaAIDialog`), già allineato.
- Nessuna modifica a sidebar / breadcrumb / route (la voce di menu resta "Compagnie / Agenzie").

## QA manuale
1. Tab "Compagnie Assicurative": creare/modificare/eliminare un gruppo → toast e dialog parlano di "Compagnia Assicurativa".
2. Tab "Agenzie": il blocco ricerca è visibile in cima, identico per ergonomia a quello del tab gemello; filtro per nome, codice e Plurimandatario funzionano.
3. Header pagina: i due conteggi sono coerenti (N agenzie · M compagnie assicurative).
4. Bottone in alto "Nuova Agenzia" appare solo sul tab Agenzie.
