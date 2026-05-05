## Aggiungere "Area CFO" come pulsante nella sidebar

Attualmente la pagina **Area CFO** esiste (`/area-cfo`, file `src/pages/AreaCFO.tsx`) ed è registrata in `src/routes/sistema.tsx` con accesso ai ruoli `admin` e `cfo`, ma non è raggiungibile dalla sidebar: si può arrivarci solo via Sitemap o URL diretto.

### Cosa fare

In `src/components/AppSidebar.tsx`, aggiungere una nuova voce di tipo `single` nell'array `sidebarEntries`, posizionata subito sotto "Home" / "Assistente IA" (alta visibilità, coerente con un cruscotto direzionale).

Voce proposta:

```ts
{
  type: "single",
  item: {
    label: "Area CFO",
    path: "/area-cfo",
    icon: LineChart,            // import da lucide-react
    permissionKey: "dashboard", // tutti hanno questa perm; filtriamo via hideForRoles
    hideForRoles: [
      "ufficio", "contabilita", "produttore", "backoffice",
      "corrispondente", "responsabile_sede", "account_executive",
      "specialist", "executive", "cliente", "prospect"
    ],
  },
}
```

In questo modo il pulsante è visibile **solo ad `admin` e `cfo`**, allineato al `RoleGuard` della rotta.

### Dettagli tecnici

- Aggiungere `LineChart` (o `TrendingUp` già importato; preferibile `LineChart` per distinguerla da Provvigioni Maturate) tra gli import lucide in cima al file.
- Nessuna modifica a routing, permessi DB o RoleGuard: la rotta esiste già.
- Nessun impatto sugli altri utenti: la voce viene filtrata da `isVisible` tramite `hideForRoles`.

### Verifica

- Login come `admin` o `cfo`: la voce "Area CFO" appare in sidebar, click porta a `/area-cfo`.
- Login con altri ruoli: la voce non compare.
