

## Piano: Filtro "Escludi scadenze mese corrente" in Polizze Attive

### Cosa cambia
Aggiunta di un toggle (Switch) nella barra filtri che, quando attivo, esclude le polizze con `data_scadenza` nel mese corrente (aprile 2026). Di default il toggle sarà **attivo** (escludi scadenze del mese), così la lista mostra solo polizze che non sono anche nel carico del mese.

### Logica filtro
Quando il toggle è attivo, aggiungere alle query:
- Calcolare primo e ultimo giorno del mese corrente
- Filtrare con `.not("data_scadenza", "gte", primoDelMese).not("data_scadenza", "lte", ultimoDelMese)` oppure equivalente `.or(data_scadenza.lt.YYYY-MM-01,data_scadenza.gt.YYYY-MM-30)`

### UI
Accanto ai filtri esistenti (search, compagnia, ramo), un componente Switch + Label:
```
[✓] Escludi scadenze del mese
```

### File coinvolto
- `src/pages/PortafoglioAttivePage.tsx` — nuovo stato `escludiMeseCorrente`, Switch UI, filtro query

