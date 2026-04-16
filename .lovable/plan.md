

## Piano: Nascondere la pagina Gestione Polizze

### Modifiche

**1. `src/components/AppSidebar.tsx`** — Rimuovere la voce "Gestione Polizze" dall'array dei menu items del Portafoglio (riga 114).

**2. `src/routes/portafoglio.tsx`** — Rimuovere la route `/portafoglio/gestione-polizze` e l'import di `GestionePolizzePage`. Le sotto-pagine (immissione, appendici, ecc.) restano accessibili direttamente tramite le loro route individuali.

Le pagine figlio (Immissione, Appendici, Duplicazione, ecc.) rimangono tutte funzionanti e raggiungibili dalle loro route dirette.

