## Obiettivo

Sulla pagina **Immissione Polizza** (`/portafoglio/immissione`), la select "Compagnia" deve diventare **"Compagnia / Agenzia di rif."** e mostrare in modo chiaro sia il nome della compagnia (gruppo madre) sia l'agenzia/sede di riferimento, restando comunque un'unica select con ricerca.

## Stato attuale

- La tabella `compagnie` contiene già record che rappresentano la combinazione **Compagnia + Agenzia/Sede** (es. `*ALLIANZ RAS SAN DONA' - GALESSO & PARTNERS SRL`, `*AURORA ASS.NI ODERZO-CADAMURO MARIO`).
- Ogni record ha un `gruppo_compagnia_id` che lo collega al **gruppo madre** (es. ALLIANZ, GENERALI, UNIPOL, AXA).
- La label oggi mostrata è semplicemente `{codice} - {nome}`, senza distinzione visiva tra gruppo madre e agenzia.

## Cosa cambia

### 1. Rinomina label
- "Compagnia" → **"Compagnia / Agenzia di rif."**
- Placeholder: `— Seleziona compagnia / agenzia —`

### 2. Query arricchita
La query `compagnie-list-immissione` viene estesa per includere il nome del gruppo madre:
```
.select("id, nome, codice, gruppo_compagnia, gruppo_compagnia_id")
```

### 3. Resa visiva della SearchableSelect
Per ogni opzione della tendina mostriamo due righe:
- **Riga 1 (principale)**: `{codice} — {nome agenzia/sede}`
- **Riga 2 (secondaria, più piccola e attenuata)**: `Gruppo: {gruppo_compagnia}` (nascosta se il gruppo non è valorizzato o coincide col nome).

Per ottenere questo, modifichiamo `SearchableSelect` (o passiamo opzioni con un campo `description` opzionale) in modo che ogni `CommandItem` possa renderizzare un sottotitolo. Il campo di ricerca continuerà a matchare sia il nome agenzia sia il nome del gruppo (concateniamo entrambi nel `value` del CommandItem usato per la ricerca).

Quando la select è chiusa, il bottone mostrerà solo la riga principale (codice + nome agenzia) per non rompere l'altezza.

### 4. Nessuna modifica al salvataggio
Il valore salvato resta `compagnia_id` (UUID del record selezionato): non serve aggiungere colonne in `titoli`. Tutte le pagine che leggono `compagnia_id` continuano a funzionare.

## File toccati

- `src/components/SearchableSelect.tsx` — aggiunto campo opzionale `description` su `SearchableSelectOption`; il `CommandItem` lo renderizza come seconda riga in `text-xs text-muted-foreground`. Backward compatible (nessun consumer attuale rotto).
- `src/pages/ImmissionePolizzaPage.tsx`:
  - query `compagnie-list-immissione`: aggiungere `gruppo_compagnia` e `gruppo_compagnia_id`;
  - label e placeholder aggiornati;
  - mapping options con `description: c.gruppo_compagnia` quando presente.

## Fuori scope (eventuale follow-up)

- Estendere lo stesso pattern alla pagina **Modifica Polizza** (`TitoloDetail.tsx`) e alla **Duplicazione/Rinnovo**: posso farlo subito dopo, ma lo lascio fuori da questo step per mantenere la modifica chirurgica.

## Domanda di conferma

Procedo così, oppure vuoi che applichi la stessa rinomina + visualizzazione anche su TitoloDetail / Duplicazione / Rinnovo nello stesso giro?
