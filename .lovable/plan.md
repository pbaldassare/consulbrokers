

## Piano: Raggruppare Trattative, Calendario e Storico in un gruppo sidebar

### Cosa cambia

Le tre voci attualmente separate (righe 87-89) — "Trattative", "Calendario", "Storico Trattative" — vengono sostituite con un unico gruppo collassabile "Trattative" con icona `ArrowRightLeft`, contenente le tre sotto-voci.

### Modifica in `src/components/AppSidebar.tsx`

Sostituire le righe 87-89 (tre `single` entries) con una `group` entry:

```typescript
{
  type: "group",
  group: {
    label: "Trattative",
    icon: ArrowRightLeft,
    permissionKey: "titoli",
    children: [
      { label: "Lista Trattative", path: "/trattative", icon: ArrowRightLeft },
      { label: "Calendario", path: "/trattative/calendario", icon: CalendarDays },
      { label: "Storico", path: "/trattative/storico", icon: Archive },
    ],
  },
},
```

### File coinvolti

| File | Azione |
|------|--------|
| `src/components/AppSidebar.tsx` | Raggruppare le 3 voci single in 1 group |

