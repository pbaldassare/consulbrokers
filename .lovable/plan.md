
## Diagnosi

L'utente `ufficio` (Segreteria) vede in dashboard 4 KPI tarati sul concetto di "tuo ufficio":
- Clienti Ufficio (551)
- Incassi Recenti (€ 0)
- Sinistri Aperti (3)
- Scadenze (989)

Vuole una dashboard più sensata per il ruolo Sede/Segreteria centrale:
- ❌ rimuovere "Clienti Ufficio" (elenco/conteggio per ufficio)
- ❌ rimuovere "Sinistri Aperti"
- ✅ mantenere/valorizzare "Scadenze del mese"
- ✅ mantenere/valorizzare "Incassi fatti"

## Da verificare prima di toccare codice

Devo leggere:
- `src/pages/Dashboard.tsx` (struttura KPI e grafici)
- `src/hooks/useDashboardData.ts` (query Supabase)

Per capire se la dashboard è unica per tutti i ruoli o già differenziata, e come sono calcolati i KPI attuali (filtro `ufficio_id`? globale?). Visto che ora con RLS globale read l'utente ufficio vede tutto, "Clienti Ufficio: 551" probabilmente è il totale globale (non filtrato per sede) — quindi la label è già fuorviante.

## Piano di modifica

### Dashboard per ruolo `ufficio` (Segreteria/Sede)

Nuova composizione KPI (4 card):
1. **Scadenze del mese** — titoli con `data_scadenza` nel mese corrente (count + importo totale premi)
2. **Incassi del mese** — somma `premio_lordo` dei titoli con `stato = 'incassato'` e `data_messa_cassa` nel mese corrente
3. **Titoli in carico (mese)** — count titoli del Carico del Mese (decorrenza nel mese corrente)
4. **Rimesse da inviare** — count titoli incassati non ancora rimessi alla compagnia

Grafici:
- **Mantengo**: "Incassi Mensili Ufficio" → rinomino "Incassi Mensili" (è globale ora, non per ufficio) — ultimi 6 mesi
- **Sostituisco**: "Sinistri per Stato" → **"Scadenze prossimi 30 giorni per Compagnia"** (bar chart) o **"Scadenze settimanali"** (per pianificare il lavoro di sede)

### Strategia implementativa

Due opzioni:

**(A) Dashboard differenziata per ruolo** — in `Dashboard.tsx` rilevo `profile.ruolo === 'ufficio'` e renderizzo set KPI diverso. Più pulito, scalabile per altri ruoli.

**(B) Modifica unica per tutti** — cambio i KPI per chiunque non sia admin. Più semplice ma impatta anche altri ruoli (executive, produttore).

Vado con **(A)** — meno invasiva e già allineata al pattern esistente (admin ha già una vista privilegiata).

### File toccati
- `src/pages/Dashboard.tsx` — branch condizionale per ruolo `ufficio` con nuovi KPI/grafici
- `src/hooks/useDashboardData.ts` — aggiungo query per: scadenze mese corrente, incassi mese corrente, carico mese, rimesse pending. Espongo nuovo oggetto `ufficioStats`.
- Header dashboard: cambio sottotitolo per ruolo ufficio (es. "Vista Sede — operatività mensile")

### Domanda bloccante (1 sola)

Confermi i 4 KPI proposti per la Sede?
1. Scadenze del mese (count + €)
2. Incassi del mese (€)
3. Carico del mese (count + €)
4. Rimesse da inviare alla compagnia (count + €)

Oppure preferisci una combinazione diversa (es. sostituire "Rimesse" con "Provvigioni maturate mese" o "Trattative aperte")?
