## Obiettivo
Rimuovere dalla sezione "Regolazione" di `TitoloDetail` i 5 **campi legacy** (Periodicità, Tipo Scadenza, GG Presentazione, Tipo Lettera, Libro Matricola), mantenendo solo la **card promemoria** (Switch + Data presunta + Fattore + Note).

## Scope: solo UI di TitoloDetail
Le colonne DB (`periodicita`, `tipo_scadenza`, `giorni_presentazione`, `tipo_lettera_regolazione`, `libro_matricola`) **restano in `titoli`** perché ancora lette/scritte da:
- `src/pages/ImmissionePolizzaPage.tsx` (immissione nuova polizza)
- `src/pages/DocPrecontrattualePage.tsx` (PDF precontrattuale)
- `src/pages/PortafoglioDetail.tsx`
- `src/pages/cliente/ClientePolizzaDetail.tsx`, `ClientePolizze.tsx` (portale cliente)
- `src/components/titolo/sections/TitoloDataPersistenceInfo.tsx`

Toccare queste altre pagine è fuori scope. Nessuna migrazione DB.

## Modifiche in `src/pages/TitoloDetail.tsx`

1. **Vista read-only** (righe ~2391–2412): rimuovo `FieldRow` per Periodicità, Tipo Scadenza, GG Presentazione, Tipo Lettera, Libro Matricola. Resta: Regolazione (Sì/No), Data presunta, Fattore, blocco Note.
2. **Modalità modifica** (righe ~2460–2515): rimuovo l'intero blocco grid `<div className="grid grid-cols-2 md:grid-cols-3 gap-4">` coi 5 campi legacy.
3. **State `regForm`** (riga ~300): rimuovo `periodicita`, `tipo_scadenza`, `giorni_presentazione`, `tipo_lettera_regolazione`, `libro_matricola`.
4. **Reset/hydrate del form** (righe ~475–483): rimuovo le 5 chiavi corrispondenti.
5. **`saveRegMutation`** (righe ~495–504): rimuovo dal payload `update()` le 5 colonne legacy (non vengono più scritte da questa sezione).
6. **Import puliti**: rimuovo eventuali `tipoLetteraOpts`, `tipoScadenzaOpts`, `periodicitaOpts`, `RadioGroup`, `RadioGroupItem` se non più referenziati altrove nel file.

## Memoria
Aggiorno `.lovable/memory/insurance/regolazione-reminder-flag.md`:
- nuova nota: "In `TitoloDetail` la sezione Regolazione mostra solo i campi promemoria (Data presunta, Fattore, Note). I campi legacy `periodicita`, `tipo_scadenza`, `giorni_presentazione`, `tipo_lettera_regolazione`, `libro_matricola` restano in DB e in `ImmissionePolizza`/`Precontrattuale`/portale cliente, ma non sono più editabili qui."

## Non incluso
- Drop colonne legacy in DB
- Modifiche a `ImmissionePolizzaPage`, `DocPrecontrattualePage`, `PortafoglioDetail`, portale cliente, `TitoloDataPersistenceInfo`
- Test E2E nuovi (i test esistenti 4c–4f non interagiscono coi campi rimossi e restano verdi)

Vuoi che rimuova **anche** i campi legacy dalle altre pagine (Immissione, Precontrattuale, portale cliente) o droppi le colonne DB? Default: no, solo TitoloDetail.
