
L'utente vuole un elenco completo di tutti gli account/record "demo" presenti nel database, prima di procedere con la cancellazione. Devo analizzare il DB ed elencarli.

## Piano: Audit completo dei dati DEMO nel database

### Cosa farò
Eseguo query SELECT (read-only) su tutte le tabelle principali per identificare record demo, cercando pattern come:
- email `%@demo-agenzia.it` o `%demo%`
- codice/nome con prefisso `DEMO-%` o contenente `demo`
- campi `note` o `descrizione` con marker demo

### Tabelle da analizzare
1. **`profiles`** + **`auth.users`** — utenti demo (admin, cfo, ufficio, produttori)
2. **`anagrafiche_professionali`** — già pulite Liquidatori/Periti/Legali, verifico altri tipi (medici, carrozzerie, ecc.)
3. **`clienti`** — clienti demo
4. **`compagnie`** — compagnie demo
5. **`titoli`** — polizze demo
6. **`sinistri`** — sinistri demo
7. **`prospect`** — prospect demo
8. **`trattative`** — trattative demo
9. **`uffici`** — sedi demo
10. **`fornitori`** — fornitori demo

### Output che ti consegnerò
Un elenco strutturato per categoria con:
- conteggio totale per tabella
- esempi di codici/email identificati
- raccomandazione su cosa cancellare (e in che ordine, per rispettare le FK)

### Dopo il report
Quando vedrai l'elenco potrai dirmi:
- "cancella tutto" → migrazione globale
- "cancella solo X, Y, Z" → migrazione selettiva
- "lascia stare i clienti perché alcuni sono reali" → escludo

### File coinvolti in questa fase
Nessuno. Solo SELECT in sola lettura. Nessuna migrazione finché non approvi l'elenco.
