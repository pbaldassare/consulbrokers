

## Piano: Spostare Gestione Sedi sotto Anagrafiche Utenti nella sidebar

### Cosa cambia

La voce "Gestione Sedi" viene rimossa dal gruppo "Sistema" e aggiunta come sotto-voce di un nuovo gruppo "Anagrafiche Utenti". La voce singola "Anagrafiche Utenti" diventa un gruppo collassabile con due children.

### Modifiche in `src/components/AppSidebar.tsx`

1. **Rimuovere** la riga `{ label: "Gestione Sedi", path: "/gestione-uffici", icon: Building2 }` dal gruppo "Sistema" (riga 183)

2. **Convertire** la voce single "Anagrafiche Utenti" (righe 125-128) in un **gruppo collassabile** con due sotto-voci:
   - "Gestione Utenti" → `/archivi/anagrafiche` (icon: Briefcase)
   - "Gestione Sedi" → `/gestione-uffici` (icon: Building2)

### Risultato nella sidebar

```
...
Archivio Documentale
▸ Anagrafiche Utenti
    Gestione Utenti
    Gestione Sedi
▸ Sinistri
...
▸ Sistema
    Impostazioni
    Crea Utente
    Gestione Utenti   ← rimane qui (è diverso)
    ...
    (senza "Gestione Sedi")
```

### Dipendenze preservate
La pagina `GestioneUfficiPage` resta invariata con tutti i suoi collegamenti (conteggi utenti, clienti, anagrafiche professionali per ufficio). La route `/gestione-uffici` resta in `src/routes/sistema.tsx` — cambia solo la posizione nel menu.

### File coinvolto

| File | Azione |
|------|--------|
| `src/components/AppSidebar.tsx` | Convertire single "Anagrafiche Utenti" in group con 2 children; rimuovere "Gestione Sedi" da gruppo Sistema |

