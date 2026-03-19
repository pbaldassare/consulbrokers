

## Piano: Creare E/C Clienti, E/C Compagnia, E/C Produttori sotto Contabilita

### Situazione attuale
- Le 3 rotte `/contabilita/ec-clienti`, `/contabilita/ec-compagnia`, `/contabilita/ec-produttori` sono tutte PlaceholderPage
- Esiste gia un E/C Clienti sotto Estrazioni (`/portafoglio/estrazioni/ec-clienti`) che possiamo usare come base
- Il database ha gia tutte le tabelle necessarie: `titoli`, `clienti`, `compagnie`, `prodotti`, `provvigioni_generate`, `profiles`, `anagrafiche_professionali`

### Cosa creeremo

#### 1. E/C Clienti (`src/pages/contabilita/ECClientiContabPage.tsx`)
Ispirato allo screenshot del legacy — filtri specifici:
- **Cliente**: ricerca per codice/nome (Combobox searchable)
- **Specialista (A/E)**: select da `anagrafiche_professionali` tipo `account_executive`
- **Produttore**: select da `profiles`
- **Competenza dal/al**: date range (scadenza premio)
- **Scadenza Premio dal/al**: date range
- **Non pagati al**: data limite
- **Valuta**: select (default EURO)
- **Situazione**: radio Tutti / Scoperti / Garantiti
- **Pag. diretto Compagnia**: radio Tutti / Si / No
- **Ufficio**: select

Tabella risultati: elenco clienti con premi non pagati, raggruppati per cliente con totali dare/avere/saldo. Click per espandere dettaglio titoli.
KPI cards: N. Clienti, Totale Dare, Totale Avere, Saldo.
Export CSV + Stampa.

#### 2. E/C Compagnia (`src/pages/contabilita/ECCompagniaContabPage.tsx`)
- Filtri: Compagnia (searchable), Periodo, Ufficio, Produttore
- Tabella: compagnia, codice, localita, mail, valuta, lordo, provvigioni, altre operazioni
- Raggruppamento per compagnia con totali premi lordi e provvigioni
- KPI cards: N. Compagnie, Totale Lordo, Totale Provvigioni, Saldo
- Export CSV

#### 3. E/C Produttori (`src/pages/contabilita/ECProduttoriContabPage.tsx`)
Ispirato allo screenshot "Estratto Conto Produttore":
- Filtri: Produttori (Con Estratto Conto / Tutti), ricerca per nome, Data limite incassi
- **Parametri di Stampa**: Descrizione Periodo, Data Estratto Conto, Data Valuta
- Tabella: codice, nome produttore, localita, fax, mail, valuta, lordo, provvigioni, altre operazioni
- Dati da `anagrafiche_professionali` tipo `account_executive` + `corrispondente` JOIN con `titoli` e `provvigioni_generate`
- KPI cards: N. Produttori, Totale Lordo, Totale Provvigioni
- Export CSV (dettaglio + riepilogo)

#### 4. Aggiornare App.tsx
Sostituire i 3 PlaceholderPage con i nuovi componenti.

### Componente filtri
Riutilizzeremo `EstrazioniFilters` esistente dove possibile, ma per E/C Clienti e E/C Produttori i filtri sono piu specifici (radio buttons Situazione, Pag. diretto, parametri di stampa), quindi ogni pagina avra i propri filtri inline usando gli stessi componenti UI (Combobox, Calendar, RadioGroup).

### File coinvolti

| Azione | File |
|--------|------|
| Creare | `src/pages/contabilita/ECClientiContabPage.tsx` |
| Creare | `src/pages/contabilita/ECCompagniaContabPage.tsx` |
| Creare | `src/pages/contabilita/ECProduttoriContabPage.tsx` |
| Modificare | `src/App.tsx` — sostituire 3 PlaceholderPage |

Nessuna migration necessaria — tutti i dati sono gia nel database.

