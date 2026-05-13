# Search bar per ogni Tabella di Base

## Obiettivo
Aggiungere a ciascuna tab di `/tabelle-base` un input "Cerca…" che filtra le righe della tabella in tempo reale (case-insensitive) sui campi testuali principali (codice, descrizione/nome, e altri campi visibili come tipo soggetto, gruppo ramo descrizione, ecc.).

## Tabs interessate (16 sezioni in `src/pages/TabelleBasePage.tsx`)
Gruppi Ramo, Rami, Usi RCA, Catalogo Garanzie, Gruppi Statistici, Gruppi Finanziari, Tipi Mandatario, Tipi Rinnovo, Indotti, Attività, Settori, Contratti, Fasce Fatturato, Fasce Dipendenti, Tipo Documento, Causali Cassa/Banca.

## Pattern unico (applicato a ogni section component)
1. Aggiungere `const [search, setSearch] = useState("")` nello state della section.
2. Inserire sopra alla `<Table>` una riga con `<Input placeholder="Cerca…" value={search} onChange={...} className="max-w-xs" />` (con icona `Search` lucide a sinistra opzionale), accanto al pulsante "Nuovo …" già presente.
3. Calcolare `filtered = items.filter(i => match(search, i))` dove `match` confronta lowercase con tutti i campi rilevanti della riga (codice, descrizione, nome, eventuali label join). Se `search` è vuoto, ritorna tutti.
4. Rendere `filtered` invece di `items` nella `<TableBody>`. Il messaggio "Nessun elemento" diventa "Nessun risultato per la ricerca" quando `search` è valorizzato.

Nessun cambio di stato URL, nessuna paginazione, nessun debounce (le tabelle base sono piccole — max ~200 righe per Rami).

## File toccati
- `src/pages/TabelleBasePage.tsx` (unico file).

## Validazione
- Aprire tab Rami, digitare `cri` → resta solo `EC — CRISTALLI` e simili.
- Aprire tab Tipo Documento, digitare numero/codice → filtra correttamente.
- Pulire l'input → riappare l'elenco intero.
- Cambio tab → ogni tab ha il proprio input indipendente (state locale per section).
