

## Piano: Riorganizzare voci Portafoglio e creare gruppo Provvigioni

### Cosa cambia

1. **Rimuovere dal gruppo Portafoglio** le voci:
   - "Regolazioni"
   - "Rientro Documenti"
   - "Import Titoli (Excel)"
   - "Analisi Preventivo RCA"

2. **Aggiungere "Rimessa Premi"** al gruppo Portafoglio (attualmente è single standalone alla riga 197)

3. **Creare nuovo gruppo "Provvigioni"** (collassabile) con due sotto-voci:
   - "Provvigioni Consul" → `/provvigioni-sede`
   - "Pagamenti Provvigioni" → `/pagamenti-provvigioni`

4. **Rimuovere** le voci single standalone "Provvigioni Consul", "Pagamenti Provvigioni" e "Rimessa Premi" (righe 195-197)

### Risultato sidebar

```
▸ Portafoglio
    Clienti
    Ricerca Polizze
    Gestione Polizze
    Estrazioni e Stampe
    Collettive / Libri Matricola
    Rimessa Premi             ← spostata qui
...
▸ Provvigioni                ← nuovo gruppo
    Provvigioni Consul
    Pagamenti Provvigioni
```

### Aggiornamento Sitemap

Riflettere le stesse modifiche nella pagina Sitemap: rimuovere le voci eliminate, aggiungere Rimessa Premi a Portafoglio, creare sezione Provvigioni.

### File coinvolti

| File | Azione |
|------|--------|
| `src/components/AppSidebar.tsx` | Rimuovere 4 voci da Portafoglio, aggiungere Rimessa Premi a Portafoglio, creare gruppo Provvigioni, rimuovere 3 single standalone |
| `src/pages/SitemapPage.tsx` | Aggiornare sezioni per riflettere la nuova struttura |

