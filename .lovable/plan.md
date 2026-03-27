

## Piano: Aggiungere le tabelle di lookup nelle Tabelle di Base

### Situazione attuale
La pagina Tabelle di Base (`TabelleBasePage.tsx`) ha un componente generico `SimpleLookupTab` che gestisce CRUD per tabelle con struttura `codice / descrizione / attivo`. Attualmente gestisce: Gruppi Ramo, Rami, Gruppi Statistici, Gruppi Compagnia, Gruppi Finanziari, Tipi Mandatario, Tipi Rinnovo, Filiali.

Le 7 tabelle di lookup create (lookup_zone, lookup_indotti, lookup_attivita, lookup_settori, lookup_contratti, lookup_fasce_fatturato, lookup_fasce_dipendenti) hanno la stessa struttura `codice / descrizione / attivo` (le fasce hanno anche `ordine`).

### Cosa fare

**1. `src/pages/TabelleBasePage.tsx`** — unico file da modificare

Aggiungere 7 voci a `tabConfig`:

| Tab | Tabella DB | Label |
|---|---|---|
| Zone | lookup_zone | Zone |
| Indotti | lookup_indotti | Indotti |
| Attivita | lookup_attivita | Attivita |
| Settori | lookup_settori | Settori |
| Contratti | lookup_contratti | Contratti |
| Fasce Fatturato | lookup_fasce_fatturato | Fasce Fatturato |
| Fasce Dipendenti | lookup_fasce_dipendenti | Fasce Dipendenti |

Per le fasce (fatturato e dipendenti), creare un componente `OrderedLookupTab` simile a `SimpleLookupTab` ma con un campo **Ordine** (numerico) nel dialog e ordinamento per `ordine` invece che per `codice`. Questo permette di definire l'ordine di visualizzazione delle fasce nei dropdown.

Le altre 5 tabelle usano direttamente `SimpleLookupTab` senza modifiche.

### Nessuna modifica DB
Le tabelle esistono gia con RLS abilitata. Si tratta solo di aggiungere le tab nella UI.

