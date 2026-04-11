

## Piano: Spostare Prospect sotto il gruppo Trattative

### Cosa cambia

1. **Rimuovere** la voce standalone "Prospect" (riga 86)
2. **Aggiungere** "Prospect" come primo child del gruppo "Trattative" (prima di "Lista Trattative")

### Risultato sidebar

```
▸ Trattative
    Prospect              ← spostato qui
    Lista Trattative
    Calendario
    Storico
```

### File coinvolto

| File | Azione |
|------|--------|
| `src/components/AppSidebar.tsx` | Rimuovere single Prospect, aggiungere come primo child di Trattative |

