

## Piano: Separare Prospect e Trattative come voci singole nella sidebar

### Cosa cambia

Attualmente "Anagrafiche Clienti" (che punta a `/prospect`) è dentro il gruppo ARCHIVI, e "Trattative" è dentro PORTAFOGLIO. L'utente vuole che **Prospect** e **Trattative** siano due voci separate e indipendenti nella sidebar (non dentro gruppi).

### Interventi su `src/components/AppSidebar.tsx`

1. **Aggiungere due voci `type: "single"`** nella lista `sidebarEntries`:
   - `{ label: "Prospect", path: "/prospect", icon: Users, permissionKey: "dashboard" }` 
   - `{ label: "Trattative", path: "/trattative", icon: ArrowRightLeft, permissionKey: "titoli" }`
   
   Posizionate tra HOME e ARCHIVI (o subito dopo ARCHIVI, a seconda della preferenza).

2. **Rimuovere** "Anagrafiche Clienti" (`/prospect`) dal gruppo ARCHIVI.

3. **Rimuovere** "Trattative" (`/trattative`) dal gruppo PORTAFOGLIO.

### File coinvolti
- **Modificato**: `src/components/AppSidebar.tsx`

