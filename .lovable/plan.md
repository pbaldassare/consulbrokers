

## Piano: Sezione "Bandi Pubblici" — Motore di Ricerca

### Obiettivo
Creare una nuova pagina "Bandi Pubblici" accessibile dal menu laterale, con un'interfaccia di ricerca predisposta per integrare API esterne di bandi pubblici (che l'utente fornirà in seguito).

### Modifiche

**1. Nuova pagina `src/pages/BandiPubbliciPage.tsx`**
- Header con titolo "Bandi Pubblici"
- Barra di ricerca con campo testo + filtri:
  - Parola chiave (input testo)
  - Regione / Provincia (select)
  - Importo min/max
  - Stato bando (Aperto / Scaduto / In valutazione)
  - Data pubblicazione da/a
- Pulsante "Cerca"
- Area risultati con Card per ogni bando contenente:
  - Titolo bando
  - Ente committente
  - Importo
  - Scadenza
  - Stato (badge colorato)
  - Link al bando originale
- Stato vuoto iniziale: messaggio "Inserisci i criteri di ricerca per trovare bandi pubblici"
- Predisposta per collegare API esterne (funzioni placeholder pronte)

**2. Route `src/routes/archivi.tsx`**
- Aggiungere route `/bandi-pubblici`

**3. Sidebar `src/components/AppSidebar.tsx`**
- Aggiungere voce "Bandi Pubblici" nel menu (icona `Search` o `Landmark`), come voce singola sotto "Trattative"

**4. `src/App.tsx`**
- Import della nuova route (già coperto da `archiviRoutes`)

### File coinvolti

| File | Azione |
|------|--------|
| `src/pages/BandiPubbliciPage.tsx` | Nuovo — pagina completa con UI ricerca |
| `src/routes/archivi.tsx` | Aggiungere route |
| `src/components/AppSidebar.tsx` | Aggiungere voce menu |

### Note
Nessuna API collegata per ora — la struttura è pronta per ricevere le API che l'utente fornirà. I risultati verranno mostrati solo quando le API saranno integrate.

