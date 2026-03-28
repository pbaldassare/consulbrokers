

## Piano: Correggere il layout della Mappa delle Sezioni

### Problema
Le card della sitemap hanno un layout orribile: i badge dei ruoli sono affiancati alla descrizione, comprimendo il testo che va a capo parola per parola. Risultato illeggibile.

### Soluzione
Cambiare il layout di ogni voce pagina dentro `SezioneCard`: invece di avere nome+descrizione e badge sulla stessa riga (`flex justify-between`), mettere i badge SOTTO il nome (sulla stessa riga del nome) e la descrizione sotto, in un layout verticale pulito.

Layout per ogni pagina:
```text
┌──────────────────────────────────────────────────┐
│ Nome Pagina  [ADMIN] [UFFICIO] [BACKOFFICE]      │
│ Descrizione breve in testo piccolo attenuato     │
├──────────────────────────────────────────────────┤
│ Nome Pagina 2  [ADMIN] [CFO]                     │
│ Descrizione breve della pagina 2                 │
└──────────────────────────────────────────────────┘
```

### Modifica tecnica
In `SezioneCard` (riga ~330), cambiare il div di ogni pagina da layout `flex justify-between` a layout verticale:
- Prima riga: nome + badge inline (flex wrap)
- Seconda riga: descrizione sotto, full width

### File modificato
- `src/pages/SitemapPage.tsx` — solo il componente `SezioneCard`, righe 329-341

