## Modifiche a `CaricamentoMovBancariPage.tsx`

### 1. Inserimento manuale: aggiungere cliente obbligatorio
Nel form di inserimento manuale aggiungere il campo **Cliente** (obbligatorio) usando `SearchableSelect` con ricerca server-side sui clienti (stesso pattern usato altrove — debounce 350ms, limit 25). Il movimento creato manualmente verrà inserito direttamente con `stato = 'matchato'`, `cliente_id` valorizzato e `ufficio_id` derivato dal cliente, così salta la fase di matching AI e va direttamente a Revisione/Ricongiungimento.

Campi del form (in ordine):
- Cliente (SearchableSelect, **obbligatorio**)
- Data (obbligatorio)
- Importo € (obbligatorio)
- Ordinante (opzionale, prefillato col nome cliente)
- Descrizione
- Note

Validazione: bottone "Aggiungi" disabilitato finché Cliente + Data + Importo > 0 non sono valorizzati.

### 2. Riorganizzazione del layout
Spostare l'inserimento manuale **fuori** dal grande riquadro a due colonne nella tab "Importazione". Nuovo layout:

- **Tab Importazione**: solo card `Upload Excel` a piena larghezza (o larghezza max contenuta).
- **Tab Monitor Real-time**: lasciare la tabella a sinistra e affiancare a destra una **card compatta "+ Inserimento manuale"** con i campi sopra elencati impilati verticalmente. Su mobile la card va sotto la tabella.

```text
Monitor Real-time
┌───────────────────────────────┬──────────────────────┐
│  Tabella movimenti real-time  │  + Inserim. manuale  │
│  (filtri, export, ecc.)       │  Cliente   [▼ cerca] │
│                               │  Data      [______]  │
│                               │  Importo € [______]  │
│                               │  Ordinante [______]  │
│                               │  Descriz.  [______]  │
│                               │  Note      [______]  │
│                               │  [   + Aggiungi   ]  │
└───────────────────────────────┴──────────────────────┘
```

### 3. Note tecniche
- Estrarre il form in un piccolo componente locale `InserimentoManualeCard` per riusarlo nella tab Monitor.
- Dopo l'inserimento: toast di conferma, refresh della tabella Monitor, reset del form.
- Log audit + notifica sede coerenti col flusso esistente (`notificaSedeMovimentoBancario` evento `approvato` opzionale — da decidere; per ora solo log standard "inserimento manuale").
- Nessuna modifica a edge function, schema DB o altre pagine.

### File toccati
- `src/pages/contabilita/CaricamentoMovBancariPage.tsx` (unico file).
