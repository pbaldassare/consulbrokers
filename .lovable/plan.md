
## Diagnosi

L'utente `ufficio` (Segreteria) sul dettaglio titolo `/titoli/d046ffeb...` apre il dialog "Conferma Messa a Cassa" e cliccando "Conferma Incasso" l'operazione fallisce. Stesso comportamento atteso per altre operazioni (Sospensione, Riattivazione, Annullamento, Regolazione, ecc.).

### Causa probabile
Abbiamo dato al ruolo `ufficio` solo i permessi **SELECT** globali con la migration precedente. Le operazioni di "messa a cassa" e affini eseguono **UPDATE/INSERT** su:
- `titoli` (cambio stato → `incassato`, set `data_messa_cassa`)
- `movimenti_contabili` (insert riga di cassa)
- `appendici_polizza` (sospensione/riattivazione)
- `pagamenti_provvigioni`, `note_restituzione`, ecc.

Le policy RLS per UPDATE/INSERT su queste tabelle sono probabilmente limitate ad `admin` o filtrate per `ufficio_id = profile.ufficio_id`. Quindi il ruolo `ufficio` (Napoli) non può scrivere su titoli di altre sedi → l'operazione fallisce silenziosamente o con errore RLS.

## Investigazione (faccio appena approvi)

1. Eseguo la "Messa a Cassa" lato client e leggo:
   - `code--read_console_logs` / `network_requests` per vedere errore esatto (RLS? edge function?)
   - `supabase--read_query` su `pg_policies` per `titoli`, `movimenti_contabili`, `appendici_polizza`, `pagamenti_provvigioni`, `note_restituzione`, `rimessa_premi`, `sinistri`, `trattative` → vedo policy INSERT/UPDATE/DELETE per ruolo `ufficio`
   - Verifico se la "messa a cassa" passa per una edge function (es. `gestione-rimessa`, `messa-a-cassa`) o è un update diretto dal client

2. Identifico tutte le tabelle dove `ufficio` ha SELECT ma non ha INSERT/UPDATE/DELETE (o le ha ristrette per `ufficio_id`).

## Fix

### Step 1 — Migration RLS write per ruolo `ufficio`

Aggiungo policy `INSERT/UPDATE/DELETE` per ruolo `ufficio` sulle tabelle operative, con scope **globale** (coerente con la SELECT globale che già ha):

```sql
-- Pattern per ogni tabella interessata
CREATE POLICY "Ufficio can insert <tab>" ON public.<tab>
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'ufficio'));

CREATE POLICY "Ufficio can update <tab>" ON public.<tab>
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'ufficio'));

CREATE POLICY "Ufficio can delete <tab>" ON public.<tab>
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'ufficio'));
```

**Tabelle target** (lista finale dopo analisi pg_policies):
- `titoli` (messa a cassa, sospensione, annullamento, regolazione)
- `movimenti_contabili` (registrazione incasso)
- `appendici_polizza` (appendici di sospensione/riattivazione)
- `pagamenti_provvigioni`, `pagamento_dettaglio`
- `note_restituzione`, `nota_restituzione_dettaglio`
- `rimessa_premi`, `rimessa_dettaglio`
- `sinistri`, `trattative` e tabelle figlie (`movimenti_sinistro`, `documenti_sinistro`, `trattativa_*`)
- `clienti`, `prospect`, `nominativi_cliente`, `contatti_cliente`, `referenti_cliente`
- `documenti_cliente`, `documenti_titolo`, `documenti_trattativa`, `documenti_sinistro`
- `log_attivita`, `notifiche`, `messaggi_chat`

**Esclusioni** (riservate ad admin):
- `profiles` (gestione utenti — solo admin)
- `user_roles` 
- `permessi_*`
- `impostazioni_sistema`
- `matrice_provvigioni` / tabelle di config
- `gruppi_compagnia`, `compagnie`, `rami`, `prodotti`, `uffici`, `lookup_*` (anagrafiche di sistema)

### Step 2 — Verifica edge functions
Se la "messa a cassa" passa per una edge function con service role, RLS non è un problema lì. Controllo il codice del bottone "Conferma Incasso" in `TitoloDetail.tsx` per capire il flow esatto.

### Step 3 — Verifica post-fix
Logout/login segreteria, riprovo "Metti a Cassa" sul titolo `d046ffeb...` e confermo successo.

### File coinvolti
- 🆕 Nuova migration SQL con le policy write per ruolo `ufficio`
- (Eventuale) edit edge function se manca controllo ruolo
- Nessuna modifica frontend

### Nota write scope
Confermo l'approccio: **ufficio = read+write globali** (come admin), tranne configurazione sistema/utenti/anagrafiche di base. Coerente con la SELECT globale già concessa e con il ruolo "Segreteria centrale".
