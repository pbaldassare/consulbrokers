# Polizza vs Quietanze — organizzazione UI

Oggi nella tabella "Polizze del cliente" appaiono righe duplicate (es. 4554333 due volte) perché il trigger genera una **quietanza successiva** che è un nuovo record `titoli` con `sostituisce_polizza` valorizzato. L'utente non distingue cosa è polizza madre e cosa è rata.

## Modello dati (già esistente, non si tocca)

- `titoli.sostituisce_polizza` (text) → se NULL: **polizza originale** (madre). Se valorizzato: **quietanza successiva** (rata) che sostituisce un titolo precedente.
- `titoli.garanzia_da / garanzia_a` → periodo di copertura della singola rata.
- Una "polizza" (concetto utente) = catena di titoli con stesso `numero_titolo`, ordinata per `garanzia_da`.

## Modifiche UI (nessuna modifica DB)

### 1. ClienteDetail → tab "Polizze del cliente"
Raggruppare per `numero_titolo`. Mostrare **una riga per polizza madre** (la più recente attiva o l'originale) con:
- colonna "Rate" che mostra il count di quietanze (es. `1/4`, `2/4`)
- riga espandibile (chevron) che apre le quietanze figlie (sub-table indentata)
- badge `Polizza` vs `Quietanza` per chiarezza
- la madre resta cliccabile → `/titoli/{id-madre}`; ogni rata cliccabile → `/titoli/{id-rata}`

### 2. TitoloDetail (header)
Sopra il numero polizza, aggiungere un breadcrumb-rata:
- Se `sostituisce_polizza IS NULL`: badge **"Polizza originale"** + lista cronologica delle quietanze successive (link rapidi).
- Se `sostituisce_polizza` valorizzato: badge **"Quietanza N (dal gg/mm/aaaa al gg/mm/aaaa)"** + link "← Vai alla polizza originale" e navigazione "← Rata precedente / Rata successiva →".

Aggiungere una piccola sezione "Storico rate" (collassabile) con tabella: N°, Periodo, Stato, Premio, Data incasso.

### 3. Portafoglio (Attive / Carico del Mese / Storico)
- Aggiungere colonna **"Tipo"** con badge: `Polizza` (madre) / `Rata N` (quietanza).
- Filtro toggle in toolbar: `[Tutto] [Solo polizze] [Solo rate]` (default: Tutto).

### 4. Convenzioni terminologiche (memory)
- **Polizza** = titolo madre (`sostituisce_polizza IS NULL`)
- **Quietanza** / **Rata** = titolo successivo (`sostituisce_polizza` valorizzato)
Aggiornare `mem://insurance/auto-quietanza-su-messa-cassa.md` con questa distinzione e le convenzioni UI sopra.

## Dettagli tecnici

- Helper condiviso `src/lib/quietanze.ts`:
  - `groupTitoliByPolizza(titoli)` → `{ madre, rate[] }[]`
  - `getRataIndex(titolo, catena)` → numero progressivo
  - `isQuietanza(titolo)` → boolean
- Query in `ClienteDetail`: aggiungere `sostituisce_polizza, garanzia_da, garanzia_a` al select esistente di `polizze`, poi raggruppare lato client.
- Nessuna modifica al backend / edge functions / migration.

## Out of scope
- Modifica trigger DB (già fatto nel turno precedente).
- Aggregazione provvigioni (resta per-titolo).
- Pagina "Storico rate" stand-alone (per ora solo sezione dentro TitoloDetail).
