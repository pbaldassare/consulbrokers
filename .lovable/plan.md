# Sdoppiare la composizione RCA in due card: Firma e Quietanza

Vogliamo che dentro la sezione **Importi**, sotto le card "Premio firma odierna" e "Premio prossima quietanza", compaiano **due card gemelle** di composizione RCA:

- **Composizione Premio RCA — Firma** → alimenta `premio_netto / tasse / premio_lordo`.
- **Composizione Premio RCA — Quietanza** → alimenta `premio_netto_quietanza / tasse_quietanza / addizionali_quietanza`.

La **Quietanza** parte come copia identica della **Firma** (stesse garanzie, stessi netti, stesse aliquote, stessa imposta provinciale), e ogni volta che si aggiunge/rimuove una voce o si cambia un netto sulla Firma, la Quietanza viene **risincronizzata in automatico** se non è stata toccata a mano. Resta comunque **editabile**: l'utente può modificare i valori della Quietanza (es. nuovo netto al rinnovo) e da quel momento quella voce viene marcata come "personalizzata" e non viene più sovrascritta.

## 1. DB — distinguere Firma vs Quietanza

Migrazione su `premi_garanzia_polizza`:

- Aggiungere colonna `tipo_premio text not null default 'firma'` con check `in ('firma','quietanza')`.
- Aggiungere colonna `quietanza_personalizzata boolean not null default false` (true = non risincronizzare più questa riga dalla Firma).
- Aggiungere colonna `voce_origine_id uuid references premi_garanzia_polizza(id) on delete set null` (link riga Quietanza → riga Firma corrispondente, per la sincronizzazione e per gestire add/remove).
- Aggiornare l'unique index esistente su `is_rca_principale` per includere `tipo_premio`: una riga RCA principale per `(titolo_id, tipo_premio)`.
- Backfill: tutte le righe esistenti restano `tipo_premio='firma'`.
- Trigger / funzione `sync_quietanza_da_firma(titolo_id)`:
  - Per ogni riga Firma senza gemella Quietanza, crea la gemella copiando `garanzia, codice_garanzia, firma, aliquota_tasse_pct, is_rca_principale, imposta_provinciale, ssn, lordo_calcolato, ordine`, settando `tipo_premio='quietanza'` e `voce_origine_id` = id riga firma.
  - Per ogni gemella Quietanza con `quietanza_personalizzata=false`, riallinea i campi alla riga Firma origine.
  - Rimuove le righe Quietanza orfane (quando la Firma è stata cancellata).
- Trigger `AFTER INSERT/UPDATE/DELETE` su `premi_garanzia_polizza WHERE tipo_premio='firma'` che chiama `sync_quietanza_da_firma`.

## 2. Componente — `VociRcaCard` parametrizzato

In `src/components/polizze/VociRcaCard.tsx` aggiungere prop:

- `tipoPremio: 'firma' | 'quietanza'` (default `'firma'`).
- `titolo: string` per intestazione (es. "Composizione Premio RCA — Firma").
- Filtrare la query `premi_garanzia_polizza` per `eq('tipo_premio', tipoPremio)`.
- Su INSERT/UPDATE/DELETE includere sempre `tipo_premio`.
- In modalità `quietanza`:
  - Mostrare badge "Sincronizzato dalla Firma" quando `quietanza_personalizzata=false`, "Personalizzato" quando true.
  - All'edit di un valore (netto/aliquota) o all'aggiunta/rimozione manuale di una voce: settare `quietanza_personalizzata=true` su quella riga.
  - Aggiungere bottone **"Risincronizza dalla Firma"** in header che resetta `quietanza_personalizzata=false` su tutte le righe e invoca `sync_quietanza_da_firma(titolo_id)` via RPC.
- Esporre `onTotaliChange` come già fatto.

## 3. `TitoloDetail.tsx` — montare le due card

Nella `SectionCollapsible` "Importi", quando `isRamoAuto`:

- Sotto la card "Premio firma odierna" → `<VociRcaCard tipoPremio="firma" onTotaliChange={...} />` che aggiorna `titoli.premio_netto / tasse / premio_lordo` (logica già presente).
- Sotto la card "Premio prossima quietanza" → `<VociRcaCard tipoPremio="quietanza" onTotaliChange={...} />` che aggiorna `titoli.premio_netto_quietanza`, `tasse_quietanza`, `addizionali_quietanza` (mappare lordo - netto sulle tasse; SSN+IPT entrano nelle tasse). Stesso debounce 800ms.
- Rimuovere il blocco singolo `VociRcaCard` attuale aggiunto in fondo alla sezione.
- Aggiornare il banner informativo: "Per le polizze RCA Auto le voci della Firma alimentano gli importi alla firma; la Quietanza viene rispecchiata in automatico ed è modificabile per ogni rinnovo."

## 4. UX comportamentale

- Aggiungo voce sulla **Firma** → trigger DB crea automaticamente la gemella sulla **Quietanza** e l'utente la vede comparire (refetch della query Quietanza tramite invalidate condiviso `["voci-rca", titoloId, *]`).
- Cambio netto sulla **Firma** → la Quietanza non personalizzata si aggiorna; quelle personalizzate restano.
- Rimuovo voce sulla **Firma** → la gemella sulla Quietanza viene rimossa (a meno che sia personalizzata: in tal caso lasciamo la riga ma senza link, con badge "Orfana").
- Cambio netto sulla **Quietanza** → quella riga diventa personalizzata, con piccolo indicatore visivo (puntino arancione + tooltip).
- Bottone "Reset Quietanza" in header card Quietanza → conferma via `AlertDialog` e ripristina mirroring totale.

## File toccati

- `supabase/migrations/<timestamp>_rca_quietanza_split.sql` — nuova migrazione (colonne, indice, funzione, trigger, backfill).
- `src/components/polizze/VociRcaCard.tsx` — prop `tipoPremio`, filtro query, gestione `quietanza_personalizzata`, bottone reset.
- `src/pages/TitoloDetail.tsx` — montare 2 card distinte sotto Firma/Quietanza, secondo handler `onTotaliChange` per i campi quietanza, rimuovere il singolo blocco esistente.
- `src/integrations/supabase/types.ts` — rigenerato dalla migrazione.
- `.lovable/memory/insurance/rca-voci-composizione-premio.md` — aggiornare la memoria con la struttura Firma/Quietanza e la logica di mirroring.

## Note tecniche

- Manteniamo i campi `titoli.*_quietanza` come fonte di verità contabile per le scadenze future.
- Il mirroring via trigger DB garantisce coerenza anche per modifiche fatte da altre UI/import.
- L'unique index aggiornato impedisce duplicati di RCA principale per tipo.
- Audit trail già attivo continua a tracciare entrambe le tipologie.
