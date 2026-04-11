

## Piano: Spostare Documentale come voce separata nella sidebar

### Cosa cambia

1. **Rimuovere** la riga `{ label: "Documentale", path: "/portafoglio/documentale", icon: HardDrive }` dal gruppo "Portafoglio" (riga 126)
2. **Aggiungere** una nuova voce `single` chiamata "Archivio Documentale" con icona `HardDrive` e path `/portafoglio/documentale` subito dopo il gruppo "Portafoglio" (o in posizione logica tra i gruppi)

### File coinvolto

| File | Azione |
|------|--------|
| `src/components/AppSidebar.tsx` | Rimuovere "Documentale" dal gruppo Portafoglio, aggiungere entry single "Archivio Documentale" |

