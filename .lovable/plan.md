

## Piano: Rendere editabile la sezione Commerciale nel dettaglio polizza + auto-match produttore

### Situazione attuale
- `commerciale_id` su `titoli` ha FK verso `profiles`, ma i veri produttori commerciali sono in `anagrafiche_professionali` (senza account utente)
- I dati reali usano `produttore_nome` (testo) per identificare il commerciale (es. "AMATO MARCELLINO", "SCIORIO NICOLA")
- `anagrafiche_professionali` ha `percentuale_base` (la % di provvigione del commerciale) per ogni produttore
- Tutte le 723 polizze incassate hanno `commerciale_id = NULL` e `percentuale_commerciale = 100`

### Cosa fare

**1. Migrazione DB: aggiungere `anagrafica_commerciale_id` a `titoli`**
- Nuova colonna `anagrafica_commerciale_id UUID REFERENCES anagrafiche_professionali(id)` — permette di linkare il produttore commerciale reale senza toccare il FK esistente verso `profiles`
- Non rimuoviamo `commerciale_id` per retrocompatibilità

**2. Backfill automatico via UPDATE**
- Matchare `titoli.produttore_nome` con `anagrafiche_professionali.ragione_sociale` per popolare `anagrafica_commerciale_id`
- Impostare `percentuale_commerciale` dalla `percentuale_base` dell'anagrafica (dove > 0)
- Polizze con `produttore_nome = 'Consulbrokers Digital Srl'` restano con % 100 (nessun commerciale)

**3. Rendere editabile la sezione "Commerciale & Provvigioni" in TitoloDetail**
- Aggiungere un pulsante "Modifica" nella sezione
- SearchableSelect per scegliere il commerciale da `anagrafiche_professionali` (tipo corrispondente/AE)
- Input per `percentuale_commerciale` (pre-popolato da `percentuale_base` dell'anagrafica selezionata)
- Pulsante "Salva" che aggiorna `anagrafica_commerciale_id` e `percentuale_commerciale` sul titolo

**4. Aggiornare Edge Function `calcola-provvigioni`**
- Se `anagrafica_commerciale_id` è valorizzato, usare quello per identificare il destinatario commerciale
- Lo split resta: `provvigioni_quietanza * percentuale_commerciale / 100` per il commerciale, il resto per Consul

**5. Ricalcolo provvigioni per polizze già incassate**
- Dopo il backfill, ricalcolare le provvigioni per le polizze che ora hanno un commerciale assegnato
- Eliminare le vecchie righe Consul al 100% e generare lo split corretto

### File coinvolti
- **Migrazione**: aggiunta `anagrafica_commerciale_id` a `titoli`
- **Data update**: backfill `anagrafica_commerciale_id` e `percentuale_commerciale` tramite match su `produttore_nome`
- **Modifica**: `src/pages/TitoloDetail.tsx` — sezione Commerciale editabile
- **Modifica**: `supabase/functions/calcola-provvigioni/index.ts` — supporto `anagrafica_commerciale_id`
- **Script**: ricalcolo provvigioni per polizze esistenti con commerciale assegnato

