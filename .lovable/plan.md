## Obiettivo
Migliorare la UX del portale cliente su `/cliente/sinistri`:
1. Far funzionare il **caricamento e la lettura dei documenti** allegati a un sinistro (oggi il cliente preme "Carica" ma poi non li vede).
2. Creare una **pagina di dettaglio sinistro** con navigazione **avanti / indietro** tra i sinistri del cliente e back-link alla lista.
3. Aggiungere **collegamenti interni** Polizza ↔ Sinistro (dal dettaglio polizza vedo i sinistri collegati; dal dettaglio sinistro torno alla polizza).

## Causa root del bug upload
La policy RLS `cliente_select_own_documenti` sulla tabella `public.documenti` copre solo `entita_tipo IN ('cliente','titolo')` e **non** `'sinistro'`. Il cliente riesce a fare INSERT (la policy `cliente_insert_documenti` include sinistro) e l'upload va a buon fine sul bucket, ma la successiva SELECT restituisce zero righe — quindi sembra che il caricamento non funzioni. Le policy del bucket `documenti_sinistri` sono già corrette.

## Modifiche

### 1. Migration RLS (`supabase/migrations/...sinistri_cliente_select.sql`)
Sostituire `cliente_select_own_documenti` aggiungendo il ramo `sinistro`:
```sql
DROP POLICY "cliente_select_own_documenti" ON public.documenti;
CREATE POLICY "cliente_select_own_documenti" ON public.documenti
FOR SELECT USING (
  visibile_al_cliente = true AND (
    (entita_tipo='cliente'  AND entita_id IN (SELECT get_my_cliente_ids()))
 OR (entita_tipo='titolo'   AND entita_id IN (SELECT t.id FROM titoli   t WHERE t.cliente_anagrafica_id IN (SELECT get_my_cliente_ids())))
 OR (entita_tipo='sinistro' AND entita_id IN (SELECT s.id FROM sinistri s WHERE s.cliente_anagrafica_id IN (SELECT get_my_cliente_ids())))
  )
);
```

### 2. Nuova pagina dettaglio sinistro
- `src/pages/cliente/ClienteSinistroDetail.tsx`: carica il sinistro per `:id` + lista completa id sinistri del cliente (per prev/next) tramite una sola query react-query (riusa la chiave `cliente-sinistri`).
- Header con bottoni: **← Torna ai sinistri** (link a `/cliente/sinistri`), **‹ Precedente** / **Successivo ›** disabilitati ai bordi.
- Mostra tutti i campi attualmente nel pannello expanded (dinamica, luogo, soggetti, dettaglio economico, note perito) + sezione **Polizza collegata** con link a `/cliente/polizze/{titolo_id}`.
- Embed `<SinistroDocumentiCliente sinistroId={id} />` per upload/lista/anteprima/elimina.
- Nuova route in `src/routes/cliente.tsx`: `/cliente/sinistri/:id`.

### 3. Lista sinistri (`ClienteSinistri.tsx`)
- Mantenere l'expand inline ma aggiungere un bottone **"Apri dettaglio"** nel pannello che naviga a `/cliente/sinistri/{id}`.
- Numero polizza nella colonna "Polizza" cliccabile → `/cliente/polizze/{titolo_id}`.

### 4. Dettaglio polizza (`ClientePolizzaDetail.tsx`)
- Aggiungere card **"Sinistri collegati"**: query `sinistri` filtrata su `titolo_id`, riga cliccabile → `/cliente/sinistri/{id}`.

### 5. (Nessuna modifica edge function necessaria — l'upload è fatto direttamente con il client supabase, la fix è solo RLS.)

## Verifica
1. Login come cliente Comune di Varese su `/cliente/sinistri`.
2. Espandere SIN-VA-2026-006 → caricare un PDF: deve comparire nella lista con badge "tuo", scaricabile, eliminabile.
3. Cliccare **Apri dettaglio** → vedere `/cliente/sinistri/{id}` con bottoni Precedente/Successivo che scorrono i 5+ sinistri.
4. Dal dettaglio sinistro: link "Polizza N. xxx" → `/cliente/polizze/{titolo_id}`.
5. Dal dettaglio polizza: card "Sinistri collegati" elenca il sinistro e lo apre.
