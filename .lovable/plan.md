

## Analisi

Nello screenshot, su `/archivi/clienti/746aed8c-67fc-435e-9e88-70991ea03097` (cliente "Lo Giudice Emilia Concetta" - Privato) il tab **Polizze** mostra `(0)` e "Nessuna polizza collegata", anche se il cliente ha sicuramente polizze.

## Cosa verifico prima del fix

1. **Schema collegamento polizza→cliente**: in `titoli` la chiave è `cliente_id` o `cliente_anagrafica_id`? (su `SinistriClienteTab.tsx` vedo `cliente_anagrafica_id` per i sinistri — sospetto che le polizze invece usino `cliente_id` ma il tab Polizze stia filtrando con la chiave sbagliata).
2. **Codice del tab Polizze del Cliente** dentro `src/pages/ClienteDetail.tsx`: con quale colonna fa la query, e su quale ID del cliente.
3. **Query DB diretta** (read-only) per il cliente `746aed8c-67fc-435e-9e88-70991ea03097`:
   - Conta polizze in `titoli` per ogni possibile FK (`cliente_id`, `cliente_anagrafica_id`, `contraente_id`, ecc.)
   - Verifica se le polizze sono legate via `numero_polizza` ad una polizza che a sua volta ha l'ID corretto

## Cause più probabili

- **A) Mismatch nome colonna FK** (più probabile): il tab filtra su `cliente_id` ma le polizze sono state salvate con `cliente_anagrafica_id`, o viceversa.
- **B) ID sbagliato passato**: il tab usa `id` della pagina ma le polizze sono linkate ad un altro id (es. `anagrafica_id` separato dalla riga `clienti`).
- **C) Filtro per stato troppo stretto** (es. solo `attivo`) che esclude tutto.
- **D) RLS**: l'utente loggato non vede le polizze di quel cliente per policy. Improbabile dato che è "Responsabile Ufficio" (admin), ma da escludere.

## Fix previsto

Una volta identificata la causa, modifica mirata in **`src/pages/ClienteDetail.tsx`** (tab Polizze):
- Correggere il nome della colonna FK nella query, oppure
- Allargare il filtro (rimuovere stato hardcoded), oppure
- In caso di ambiguità schema, usare un OR su entrambe le possibili FK: `.or('cliente_id.eq.X,cliente_anagrafica_id.eq.X')`.

In parallelo, **stesso fix sul contatore badge** del tab `Polizze (0)` per evitare che la pagina mostri 0 mentre la tabella mostra righe.

## File toccati

- `src/pages/ClienteDetail.tsx` (~5-15 righe nella query del tab Polizze e nel relativo conteggio)

## Cosa NON faccio

- Niente modifiche RLS / schema / migrazioni (a meno che la diagnosi DB non riveli che le polizze sono effettivamente orfane — in quel caso ti chiedo conferma prima)
- Niente modifiche ad altri tab (Sinistri, Documenti, Trattative)
- Niente modifiche al portale cliente (`/cliente/polizze`) che è separato

## Verifica post-fix

1. Apro `/archivi/clienti/746aed8c-…` → il badge mostra il numero reale di polizze
2. Le polizze appaiono in tabella con numero, compagnia, premio, stato
3. Click su una polizza → naviga al dettaglio titolo
4. Provo su un altro cliente (Privato e Azienda) per essere sicuro che funzioni in entrambi i casi

