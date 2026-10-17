# Integrazione — riferimento CBnet

## App.tsx — route

```tsx
import PubblicazioniChangelogPage from "./pages/PubblicazioniChangelogPage";

// Dentro le route protette (MainLayout):
<Route
  path="/pubblicazioni-changelog"
  element={
    <RoleGuard allowedRoles={["admin"]}>
      <PubblicazioniChangelogPage />
    </RoleGuard>
  }
/>
```

La pagina **inoltre** controlla `isRootAdminEmail(profile?.email)` e mostra “Sezione riservata” agli altri admin.

## MainLayout.tsx — popup globale

```tsx
import ChangelogPopup from "./ChangelogPopup";

export function MainLayout() {
  return (
    <>
      {/* ... sidebar, outlet ... */}
      <ChangelogPopup />
    </>
  );
}
```

## AppSidebar.tsx — voce menu (esempio)

```tsx
import { Megaphone } from "lucide-react";

{
  type: "single",
  item: {
    label: "Pubblicazioni Changelog",
    path: "/pubblicazioni-changelog",
    icon: Megaphone,
    permissionKey: "dashboard",
    adminOnly: true,
    rootOnly: true, // solo admin@consul.it in CBnet
  },
}
```

## Query keys (invalidazione)

| Key | Uso |
|-----|-----|
| `["changelog-editor"]` | Lista bozze/pubblicati (pagina admin) |
| `["changelog-da-mostrare", userId, anteprima]` | Popup utente |

Dopo publish/salva: invalidare entrambe.

## Modello dati

| Campo | Tipo | Note |
|-------|------|------|
| `cambiamenti` | `text[]` | Un elemento = blocco markdown principale |
| `bug_in_carico` | `text[]` | Idem |
| `problemi_noti` | `text[]` | Idem |
| `pubblicato_at` | `timestamptz` null | null = bozza (una bozza “corrente” in UI) |

## Adattamento RLS senza root admin

In `20261009110000_changelog.sql`, sostituire:

```sql
ALTER POLICY "Admin gestisce changelog" ...
  USING ((SELECT public.is_root_admin(auth.uid())))
```

con ad esempio:

```sql
USING ((SELECT public.has_role(auth.uid(), 'admin'::app_role)))
```

e allineare `PubblicazioniChangelogPage` rimuovendo il guard `isRootAdminEmail` se non serve.
