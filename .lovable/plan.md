

## Piano: Collegamento completo Sinistri ↔ Clienti ↔ Polizze ↔ Compagnie nella UI

### Stato attuale

I dati nel database sono **già correttamente collegati**: ogni sinistro ha `cliente_anagrafica_id`, `titolo_id` e `compagnia_id` valorizzati e referenziati. Il problema è che la **UI non sfrutta tutti i collegamenti**:

1. **SinistriList**: la query non include `clienti` — manca il nome cliente nella tabella
2. **Creazione sinistro**: il wizard non passa `cliente_anagrafica_id` all'edge function, quindi i nuovi sinistri creati non avranno il collegamento al cliente CRM
3. **SinistriList**: mancano colonne utili (Tipo, Cliente, Polizza, importi)
4. **Edge function `gestione-sinistri`**: non salva `cliente_anagrafica_id` né `titolo_id` durante la creazione

### Interventi

**1. Edge Function `gestione-sinistri/index.ts`**
- Accettare i campi `tipo_sinistro`, `luogo_sinistro`, `data_evento`, `cliente_anagrafica_id`, `titolo_id` nell'azione `crea`
- Inserirli nella INSERT su `sinistri`

**2. SinistriList.tsx — Query e colonne**
- Aggiungere alla select: `clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente)`, `titoli(numero_titolo)`
- Aggiungere colonne: **Cliente**, **Polizza**, **Tipo Sinistro**
- Permettere ricerca anche per nome cliente

**3. SinistriList.tsx — Wizard creazione (step 2)**
- Estrarre `cliente_anagrafica_id` dalla polizza selezionata (via `titoli.cliente_anagrafica_id`)
- Aggiungere campi: tipo sinistro, luogo, data evento
- Passare tutti i campi all'edge function

**4. SinistriList.tsx — Wizard (step 1) query polizze**
- Includere `cliente_anagrafica_id` nella select dei titoli per poterlo propagare

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| File modificati | `supabase/functions/gestione-sinistri/index.ts`, `src/pages/SinistriList.tsx` |
| Query sinistri | Aggiunta join a `clienti` e `titoli` |
| Wizard | Propagazione `cliente_anagrafica_id` da polizza selezionata |
| Nuovi campi wizard | tipo_sinistro, luogo_sinistro, data_evento |

