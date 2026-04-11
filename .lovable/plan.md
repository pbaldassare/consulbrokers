

## Piano: Spostare Crea Utente e Gestione Utenti da Sistema ad Anagrafiche Utenti

### Cosa cambia

1. **Rimuovere** dal gruppo "Sistema" le voci:
   - "Crea Utente" (riga 184)
   - "Gestione Utenti" (riga 185)

2. **Aggiungere** al gruppo "Anagrafiche Utenti" (righe 131-133) due nuove sotto-voci:
   - "Crea Utente" → `/crea-utente` (icon: UserPlus)
   - "Utenti di Rete" → `/gestione-utenti` (icon: Users) — rinominata per distinguerla da "Gestione Utenti" già presente

### Risultato nella sidebar

```
▸ Anagrafiche Utenti
    Gestione Utenti       ← /archivi/anagrafiche (esistente)
    Gestione Sedi         ← /gestione-uffici (esistente)
    Crea Utente           ← spostato da Sistema
    Utenti di Rete        ← spostato da Sistema, rinominato
...
▸ Sistema
    Impostazioni
    Anomalie Sistema
    Backup & Export
    ...
```

### File coinvolto

| File | Azione |
|------|--------|
| `src/components/AppSidebar.tsx` | Aggiungere 2 children ad Anagrafiche Utenti; rimuovere 2 voci da Sistema |

