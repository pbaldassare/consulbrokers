… (riferito a `src/pages/cliente/ClienteDocumenti.tsx` — solo frontend)

## Obiettivo
Trasformare la pagina "Documentazione Ente" del portale cliente da lista piatta a vista organizzata, ricca e accattivante, con i documenti raggruppati per **Polizza** e per **Tipo di condizione/documento**, mantenendo i documenti generali dell'ente in una sezione dedicata.

## Layout nuovo

```text
┌─ Header ──────────────────────────────────────────────┐
│ Documentazione Ente            [⬆ Carica documento]  │
│ Sottotitolo + breadcrumb compatto                     │
└───────────────────────────────────────────────────────┘
┌─ KPI strip (4 card piccole, gradient teal) ──────────┐
│ Totale doc · Polizze documentate · CGA · Caricati da te
└───────────────────────────────────────────────────────┘
┌─ Toolbar ─────────────────────────────────────────────┐
│ [Cerca…]  [Tipo doc ▾]  [Polizza ▾]  [Vista: ▣ Card / ☰ Lista]  [Reset] │
└───────────────────────────────────────────────────────┘

┌─ TAB: "Per Polizza" │ "Documenti Ente" │ "Tutti" ────┐

▸ TAB "Per Polizza" → Accordion per ogni polizza:
   ┌────────────────────────────────────────────┐
   │ 🛡 POLIZZA ALL RISKS — N° M15888042       │
   │    Compagnia · Ramo · Stato (badge)        │
   │    📎 6 documenti  │ ultimo: 11/06/2026   │
   │ ▾  ────────────────────────────────────── │
   │   ▸ Capitolato / CGA          (2)          │
   │     • G00304257_Capitolato.pdf  [👁][⬇]   │
   │   ▸ Polizza firmata           (1)          │
   │   ▸ Quietanze                 (1)          │
   │   ▸ Altri documenti           (2)          │
   └────────────────────────────────────────────┘

▸ TAB "Documenti Ente" → cards generiche non legate a polizza
   (visure, statuti, deleghe, privacy…)

▸ TAB "Tutti" → la lista zebrata attuale ma migliorata
```

## Logica dati (solo frontend)
- Carica come oggi `documenti` filtrati su `entita_tipo='cliente' AND entita_id IN get_my_cliente_ids()`.
- In parallelo carica i documenti collegati alle polizze del cliente:
  - `titoli` del cliente → `documenti` con `entita_tipo='titolo' AND entita_id IN (...)`.
  - `polizza_cga` del cliente (stato approvato) → `documenti` con `entita_tipo='polizza_cga' AND entita_id IN (...)`.
- Unisce tutto in un'unica struttura `{ doc, polizza?, tipo, group }`.
- Mappa `categoria` → **tipo documento normalizzato** con label + icona + colore:
  - `cga_polizza`, `capitolato` → "Condizioni / CGA" 📘
  - `polizza_firmata`, `polizza_def` → "Polizza firmata" ✍️
  - `quietanza` → "Quietanze" 💳
  - `appendice` → "Appendici" 📎
  - `privacy`, `informativa` → "Privacy" 🔒
  - default → "Altri documenti" 📄
- Determina la polizza di appartenenza tramite:
  1. `entita_tipo='titolo'` → join in memoria con `titoli` (numero/compagnia/ramo).
  2. `entita_tipo='polizza_cga'` → join con `polizza_cga` (numero/oggetto).
  3. Pattern nel `nome_file` (es. `POLIZZA_<NUM>_…`) come fallback.

## Componenti UI (shadcn esistenti)
- `Tabs` (Per Polizza / Documenti Ente / Tutti).
- `Accordion` per polizza con header ricco (icona scudo teal, numero, badge ramo/stato, contatore documenti, data ultimo aggiornamento).
- Sotto-raggruppamento per "tipo documento" con piccoli pill colorati.
- Card documento: icona tipo (colorata per categoria), nome file truncato con tooltip, badge "Caricato da te"/"Visibile", data relativa ("2 giorni fa") + assoluta in tooltip, azioni `Anteprima` / `Scarica` / `Elimina` (solo se caricato da cliente).
- Toggle vista **Griglia/Lista** (persistito in `localStorage`).
- Empty state illustrato (icona grande teal, CTA "Carica il primo documento").

## Estetica
- Palette teal/dark petrol coerente (già in uso).
- KPI: card con sfondo `bg-gradient-to-br from-teal-50 to-white border-teal-100`, numero grande, label muted, mini-icona.
- Header polizza: striscia teal sottile a sinistra, hover lift leggero.
- Riga doc: zebra + hover `bg-teal-50/40`, icona tipo in cerchio colorato.
- Date: formato relativo + assoluto in tooltip via `date-fns/formatDistanceToNow`.

## Funzionalità extra
- **Ricerca** estesa a nome file, categoria, numero polizza, compagnia.
- **Filtro Tipo doc** alimentato dalla mappa normalizzata (non più stringhe grezze).
- **Filtro Polizza** con `SearchableSelect` (numero + compagnia).
- **Ordinamento** all'interno di ogni gruppo: per data discendente di default.
- **Conteggio** per tab e per gruppo.
- Persistenza vista (griglia/lista) e tab attivo in `localStorage`.

## File toccati
- `src/pages/cliente/ClienteDocumenti.tsx` (riscrittura UI + fetch esteso a documenti polizza, solo lettura).
- Eventuale piccolo helper `src/lib/clienteDocumentiTypes.ts` per la mappa categoria→tipo normalizzato (etichetta, icona, colore).

Nessuna modifica DB/RLS/edge functions. Nessun cambio a permessi: i documenti polizza sono già letti dai clienti via RLS esistente sul portale.
