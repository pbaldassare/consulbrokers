## Allineare sezione Contratto in TitoloDetail alla pagina di Immissione

L'utente ha ragione: la card **Contratto** in TitoloDetail (sia read-only sia in modifica) è disallineata da `ImmissionePolizzaPage`. Stessa sezione, stesso `PolizzaSection`, ma campi, layout, dimensioni input e logica non coincidono.

### Drift rilevato

| Aspetto | Immissione (riferimento) | TitoloDetail oggi |
|---|---|---|
| Compagnia vs Agenzia | **Due select separate** (Compagnia Assicurativa + Agenzia di Riferimento) con auto-link broker/pluri | Una sola select combinata "Agenzia / Agenzia di rif." |
| Rapporto Agenzia | Visibile solo per broker/plurimandataria, badge readonly se unico, select se 2+ | Sempre visibile, con stile diverso |
| Ramo / Sottoramo | `RamoSottoramoSelect gruppoOnly` (sottoramo si sceglie nelle righe garanzia) | `RamoSottoramoSelect` con anche sottoramo |
| Dimensione input | `h-8 text-xs` ovunque | Default (più grandi, font diverso) |
| Vincolo | `SearchableSelect` (Nessuno/Ipoteca/Leasing/Pegno/Cessione/Altro) salvato in `titoli.vincolo` | `Switch` Sì/No su `vincolo_attivo` |
| Specialist | **Rimosso** dal Contratto (vive in Sede) | Ancora presente in Contratto |
| CIG/Rif. | Mostrato solo per Ente, con flag CIG temporaneo e validazione | Mostrato per Ente, senza flag temp |
| Hint precompilazione | Banner teal "Compagnia/Agenzia precompilate" | Assente |
| N° Polizza | Editabile con validazione | Solo readonly testo |
| Prefilled hint, prompts | Presenti | Assenti |

Read-only (immagine 2): la modalità lettura impacchetta Compagnia, Agenzia, Codice Rapporto in 4 colonne strette → testo va a capo e la divisione tra "Compagnia" e "Agenzia di rif." sparisce visivamente.

### Modifiche (un solo file: `src/pages/TitoloDetail.tsx`)

1. **Stato edit Contratto** (`contrattoForm`):
   - Aggiungere `gruppo_compagnia_id: string | null` (Compagnia Assicurativa madre).
   - Aggiungere `vincolo: string` (testuale, sostituisce uso del solo Switch).

2. **Hook + data**:
   - Aggiungere `useQuery` per `gruppi_compagnia` (id, nome, codice) — solo se `editingContratto`.
   - Cambiare `compagnieOpts` per restituire anche `tipo`, `gruppo_compagnia_id`, così da poter filtrare come in Immissione.
   - Calcolare `rapportiMap` (per broker/pluri → set di gruppi disponibili) come in Immissione.

3. **Edit UI** (sostituisce lines 1996-2129):
   - Griglia `grid-cols-1 md:grid-cols-2 gap-3`.
   - **Compagnia Assicurativa** (`SearchableSelect` su gruppi) + **Agenzia di Riferimento** (`SearchableSelect` su compagnie filtrate), con la **stessa logica** di Immissione (auto-set compagnia madre quando l'agenzia è di tipo `agenzia/direzione`; reset rapporto al cambio).
   - **Rapporto Agenzia** mostrato solo per broker/plurimandataria, con stesse 3 varianti (zero / uno solo / multi-select).
   - **RamoSottoramoSelect** con sottoramo (TitoloDetail edita il titolo, non le righe garanzia → resta utile sottoramo qui).
   - **Prodotto** (Input testo libero), **Vincolo** (SearchableSelect 6 opzioni), **CIG/Rif.** (solo Ente, identico a Immissione con flag CIG temporaneo).
   - **Descrizione** (Textarea full-width).
   - Tutti gli input usano `h-8 text-xs` o equivalenti di Immissione.
   - **Rimuovere campi non coerenti** dalla card Contratto: `Specialist`, `Produttore`, `Sede`, `Numero Polizza`, `Cliente` (questi vivono in altre card: Sede e Cliente). Rimangono mostrati in **read-only** (sotto), ma non più editabili da qui — già esiste l'edit dedicato in Cliente & Sede / sezioni vicine.

4. **Read-only UI** (1956-1994):
   - Cambiare grid in `grid-cols-1 md:grid-cols-3` con campi più larghi → niente più wrapping di "RAS RISCHI ASSICURATIVI SRL HDI" su 5 righe.
   - Mostrare in ordine: Compagnia | Agenzia di rif. | Rapporto · Codice — Ramo | Sottoramo | Prodotto — N° Polizza | Cliente (link) | CIG (se Ente) — Vincolo | Descrizione (full-width).
   - Usare lo stesso componente `FieldRow` corrente per coerenza tipografica con le altre sezioni.

5. **Save mutation** (`saveContrattoMutation`):
   - Aggiungere al payload `vincolo` (testo) e mantenere `vincolo_attivo = vincolo !== "" && vincolo !== "nessuno"` per retro-compat.
   - Validazione: come Immissione, se broker/pluri e 2+ rapporti, richiedere selezione.
   - Rimuovere dal payload `specialist`, `produttore_nome`, `ufficio_id` (non più editabili da qui).

### Cosa **non cambia**

- `PolizzaSection` resta il wrapper (già condiviso).
- Le altre card (Periodo, Importi, Regolazione, Commerciale & Provvigioni…) non vengono toccate.
- Nessun cambio DB: usiamo colonne già esistenti (`vincolo` esiste già accanto a `vincolo_attivo`).
- Lock UI quando polizza messa a cassa / stornata resta invariato.

### Verifica

1. Aprire la polizza `0332438253` (id `9d081206…`) → Contratto in read-only deve mostrare HDI / AMISNA su righe larghe, no wrapping.
2. Click "Modifica" → due select Compagnia + Agenzia identiche a Immissione, con stessi placeholder e font; Vincolo come dropdown.
3. Cambiare Compagnia → Agenzia si filtra; salvare → torna in read-only allineato.
4. Provvigioni: una volta selezionato il **Rapporto** corretto in edit e salvato, le card di split mostrano gli importi (era questo il vero blocco delle provvigioni mancanti sulla polizza in oggetto).
