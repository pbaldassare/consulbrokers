

## Piano: Separare Polizze Attive e Carico Mese, rimuovere Storico

### Cosa cambia

La pagina unica con 3 tab viene sostituita da **2 pagine distinte** accessibili dalla sidebar. Lo "Storico" viene rimosso (recuperabile da scheda cliente e dettaglio polizza).

### Nuova struttura sidebar Portafoglio

```
▸ Portafoglio
    Clienti
    Polizze Attive          ← /portafoglio/attive (nuova)
    Carico del Mese         ← /portafoglio/carico (nuova)
    Gestione Polizze
    Estrazioni e Stampe
    Collettive / Libri Matricola
    Rimessa Premi
```

### Pagine

1. **Polizze Attive** (`/portafoglio/attive`): Card contatore + tabella paginata con filtri (compagnia, ramo, ricerca). Query: `stato = 'attivo' AND garanzia_a >= oggi`.

2. **Carico del Mese** (`/portafoglio/carico`): Selettore mese/anno + card contatore + tabella paginata con filtri. Query: `data_scadenza` nel mese selezionato. Focus su conferma/rinnovo.

3. **Rimuovere** la vecchia `PortafoglioPolizzePage.tsx` con le 3 tab e la route `/portafoglio` generica (redirect a `/portafoglio/attive`).

### File coinvolti

| File | Azione |
|------|--------|
| `src/pages/PortafoglioAttivePage.tsx` | Nuova pagina Polizze Attive |
| `src/pages/PortafoglioCaricoPage.tsx` | Nuova pagina Carico del Mese |
| `src/pages/PortafoglioPolizzePage.tsx` | Eliminare |
| `src/routes/portafoglio.tsx` | Aggiornare route: `/portafoglio` redirect, nuove route attive/carico |
| `src/components/AppSidebar.tsx` | Sostituire "Portafoglio Polizze" con "Polizze Attive" e "Carico del Mese" |

