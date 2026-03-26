

## Piano: Spostare Compagnie, Categorie e Prodotti sotto Tabelle di Sistema

### Cosa cambia

Le voci **Compagnie**, **Categorie** e **Prodotti** vengono spostate dal gruppo "Archivi" al gruppo "Sistema", accanto a "Tabelle di Base". Sono tabelle di configurazione gestite dall'admin, non dati operativi.

### Modifiche

| File | Azione |
|---|---|
| **`src/components/AppSidebar.tsx`** | Rimuovere Compagnie, Categorie, Prodotti dal gruppo Archivi (righe 99-101). Aggiungerle nel gruppo Sistema dopo "Tabelle di Base" (riga 221) |
| **`src/routes/archivi.tsx`** | Rimuovere le 3 rotte (`/compagnie`, `/categorie`, `/prodotti`) e i relativi import |
| **`src/routes/sistema.tsx`** | Aggiungere le 3 rotte con RoleGuard admin + import dei componenti |

Nessuna modifica a DB, componenti pagina o breadcrumb. Solo riorganizzazione navigazione e rotte.

