## Obiettivo

In `ImmissionePolizzaPage`, quando si seleziona un Cliente che ha già almeno una polizza, precompilare automaticamente **Compagnia**, **Agenzia/Rapporto** (e per coerenza **Gruppo Compagnia**) con i valori dell'ultima polizza salvata per quel cliente. L'utente resta libero di cambiarli; al salvataggio della nuova polizza i valori diventano automaticamente la nuova "preferenza" (perché la prossima volta si leggerà di nuovo l'ultima polizza).

## Approccio (no schema changes)

Niente nuove colonne / tabella preferenze: la "preferenza" è semplicemente l'ultima polizza del cliente. Si rilegge ogni volta da `titoli` ordinato per `created_at desc limit 1`.

Vantaggi: zero migrazioni, nessun rischio di disallineamento, si aggiorna "in automatico" ad ogni salvataggio come richiesto.

## Modifiche

**File: `src/pages/ImmissionePolizzaPage.tsx`**

1. Aggiungere un `useEffect` che si attiva al cambio di `selectedClienteId` (e solo quando i campi compagnia/rapporto sono ancora vuoti — non sovrascrivere scelte già fatte dall'utente né dati ereditati da una trattativa/rinnovo).
2. Query:
   ```ts
   supabase.from("titoli")
     .select("compagnia_id, compagnia_rapporto_id")
     .eq("cliente_id", selectedClienteId)
     .not("compagnia_id", "is", null)
     .order("created_at", { ascending: false })
     .limit(1).maybeSingle()
   ```
3. Se trovato:
   - `setSelectedCompagniaId(row.compagnia_id)`
   - Recupero `gruppo_compagnia_id` e `tipo` da `compagnie` (riuso pattern già presente nel file ai righi ~1820–1830) e `setSelectedGruppoCompagniaId(...)` quando agenzia/direzione.
   - `setSelectedRapportoId(row.compagnia_rapporto_id)` se presente (broker/plurimandataria).
4. Mostrare un piccolo hint sotto al campo Compagnia: "Precompilato dall'ultima polizza di questo cliente — modificabile" (badge teal, dismissable o solo finché i valori non vengono cambiati).

## Comportamento atteso

- Primo titolo del cliente → campi vuoti come oggi.
- Dal secondo in poi → Compagnia + Agenzia/Rapporto precompilati con i valori dell'ultima polizza salvata.
- L'utente può cambiarli liberamente; al `save` la nuova polizza diventa l'ultima e quindi la nuova preferenza per i successivi inserimenti.
- Nessun impatto su Rinnovi/Sostituzioni (lì i dati arrivano dal titolo origine; la prefill da "ultima polizza" non scatta perché i campi sono già valorizzati).

## Verifica

1. Cliente con 1+ polizza → apri `/immissione-polizza`, seleziona cliente → Compagnia/Agenzia compaiono automaticamente.
2. Cambiare manualmente la compagnia → salva → riapri immissione per lo stesso cliente → ora la "preferenza" è la nuova compagnia.
3. Cliente senza polizze → campi vuoti come oggi.

## Fuori scope

- Nessuna nuova tabella/colonna di preferenze.
- Nessuna modifica a `TitoloDetail` (la prefill ha senso solo in nuovo inserimento).
- Nessuna modifica a Rinnovo (eredita dal titolo origine, prioritario).
