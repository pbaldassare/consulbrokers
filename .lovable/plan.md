

## Piano: Riorganizzare sidebar — rimuovere Archivi, spostare Clienti e Anagrafiche

### Cosa cambia

1. **Eliminare** il gruppo "Archivi" (righe 102-112)
2. **Spostare "Clienti"** dentro il gruppo "Portafoglio" come prima voce
3. **Rinominare "Anagrafiche"** in "Anagrafiche Utenti" e metterla come voce `single` separata (standalone, non in un gruppo)

### Risultato nella sidebar

```
Home
Prospect
▸ Trattative
Bandi Pubblici
Chat
▸ Portafoglio
   Clienti          ← spostato qui
   Ricerca Polizze
   Gestione Polizze
   ...
Archivio Documentale
Anagrafiche Utenti   ← voce singola, rinominata
▸ Sinistri
...
```

### File coinvolto

| File | Azione |
|------|--------|
| `src/components/AppSidebar.tsx` | Rimuovere gruppo Archivi, aggiungere `{ label: "Clienti", ... }` come primo child di Portafoglio, aggiungere entry single "Anagrafiche Utenti" dopo Archivio Documentale |

