## Modifiche all'hub Gestione Polizze

In `src/pages/GestionePolizzePage.tsx`, dentro l'array `OPERAZIONI`:

1. **Nascondere la card "Messa a Cassa"** — commentare la riga `{ key: "messa_cassa", ... }` (stesso pattern già usato per Rinnovo). La logica di esecuzione resta in `case "messa_cassa"` per compatibilità con deep-link esistenti, ma la card non viene più mostrata nella griglia.

2. **Aggiungere card "Nuova Polizza"** come prima voce dell'array:
   - `key: "nuova_polizza"`
   - `label: "Nuova Polizza"`
   - `icon: PlusCircle` (da `lucide-react`)
   - `descrizione: "Emetti una nuova polizza"`
   - `statiFiltro: []` (non serve filtrare titoli esistenti)
   - Al click → naviga a `/portafoglio/immissione` senza aprire i pannelli filtri/risultati (gestita come scorciatoia: l'handler `onClick` della card fa `navigate("/portafoglio/immissione")` invece di selezionare l'operazione).

3. **Stile coerente**: la card "Nuova Polizza" usa lo stesso layout delle altre ma con accento teal pieno (call-to-action primaria) per distinguerla dalle azioni contestuali.

Nessuna modifica al routing, ai dialog o al filtro cliente già sistemato.