

## Piano: Rimuovere Manutenzione e Impostazioni da Sistema + Aggiornare Sitemap

### Cosa cambia

1. **Sidebar (`src/components/AppSidebar.tsx`)**: Rimuovere le voci "Impostazioni" e "Manutenzione" dal gruppo Sistema (righe 185 e 188)

2. **Sitemap (`src/pages/SitemapPage.tsx`)**: Aggiornare la sezione "Sistema" rimuovendo "Impostazioni" e "Manutenzione". Aggiornare la sezione "Archivi" rinominandola in "Anagrafiche Utenti" e aggiungendo "Crea Utente", "Utenti di Rete" e "Gestione Sedi". Spostare "Crea Utente" e "Gestione Utenti" e "Gestione Sedi" dalla sezione Sistema alla nuova sezione Anagrafiche Utenti.

### Risultato sidebar Sistema

```
▸ Sistema
    Anomalie Sistema
    Backup & Export
    Tabelle di Base
    Compagnie
    Template Email
    Sitemap
```

### Risultato sitemap aggiornata

- Sezione "Archivi" → rinominata "Anagrafiche Utenti" con: Gestione Utenti, Anagrafiche Professionali, Crea Utente, Utenti di Rete, Gestione Sedi
- Sezione "Sistema" senza: Impostazioni, Manutenzione, Crea Utente, Gestione Utenti, Gestione Sedi

### File coinvolti

| File | Azione |
|------|--------|
| `src/components/AppSidebar.tsx` | Rimuovere "Impostazioni" e "Manutenzione" dal gruppo Sistema |
| `src/pages/SitemapPage.tsx` | Aggiornare sezioni per riflettere la nuova struttura sidebar |

