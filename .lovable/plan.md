## Modifiche a `src/pages/cliente/ClientePolizze.tsx`

### 1) Rimuovere lo stato polizza
- Eliminare la colonna **Stato** dalla tabella (header + cella).
- Eliminare il filtro **Stato** (SearchableSelect + state `stato` + `statiOptions`) e relativa logica in `filtered`/`resetFiltri`/`buildExportRows`.
- Mantenere tutti gli altri filtri (Garanzia, Compagnia, ricerca, scadenze).
- Aggiornare `colSpan` della riga espansa da 10 → 9.

### 2) Annualità (quietanze) nella riga espansa
Sotto il blocco dati attuale, aggiungere una sezione **"Annualità / Quietanze"**:
- Caricamento on-demand quando la riga viene espansa (no fetch globale per non rallentare la lista).
- Query: `titoli` con `sostituisce_polizza = t.id` OR `id = t.id`, ordinati per `durata_da`.
  - Include la polizza madre + tutte le quietanze figlie (modello `polizza-quietanza-split-model`).
- Tabella compatta con colonne: N° Titolo, Decorrenza, Scadenza, Frazionamento/Rata, Premio Lordo, Stato pagamento (badge "Pagata" se `data_messa_cassa` valorizzata, altrimenti "Da pagare").
- Solo per righe `_source === "titoli"` (le CGA non hanno quietanze).

### 3) Documenti inline nella riga espansa
Sotto le annualità, sezione **"Documenti"**:
- Caricamento on-demand contestuale all'espansione.
- Query: `documenti` con `entita_tipo='titolo'` e `entita_id=t.id`.
- Lista con nome file, data caricamento, dimensione e bottone **Scarica** (signed URL via `supabase.storage.from('documenti').createSignedUrl(...)`, stesso pattern usato in `ClientePolizzaDetail.tsx`).
- Stato vuoto: "Nessun documento disponibile".
- Solo per `_source === "titoli"`.

### 4) Pulizia minore
- Rimuovere `statoBadge`, l'import `Badge` resta (usato per "gg" scadenza), `stato` rimosso da export CSV/Excel.
- Il bottone **Apri dettaglio polizza** resta invariato.

## Dettagli tecnici

- Nuovo hook locale per riga espansa: `useEffect` che si attiva quando `expandedId === t.id` e popola due `useState` (`annualita`, `documenti`) con cache per-id in un `Map` (evita refetch al riapri).
- Skeleton di 2-3 righe durante il caricamento delle sezioni.
- Nessuna modifica a RLS / schema: `titoli`, `documenti`, storage `documenti` già accessibili al cliente via `get_my_cliente_ids()` e policy esistenti.

## File toccato
- `src/pages/cliente/ClientePolizze.tsx` (unico file)

Nessuna modifica a `ClientePolizzaDetail.tsx` (che continua a mostrare il dettaglio completo per chi preferisce aprire la pagina).