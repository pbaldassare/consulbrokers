# Gestione Polizze — Restyle & semplificazione

Ho capito. Tre modifiche mirate alla pagina `src/pages/GestionePolizzePage.tsx`, solo UI/presentation.

## 1. Card operazioni più piccole
- Grid passa da 4 colonne larghe a **6 colonne** su desktop (`grid-cols-2 md:grid-cols-3 lg:grid-cols-6`)
- Padding card ridotto: `p-3` invece di `p-5`
- Icona piccola (`h-4 w-4`) inline con titolo (`text-sm font-medium`)
- Descrizione su 1 riga `text-xs text-muted-foreground truncate` (tooltip per testo completo)
- Altezza uniforme ~80px, badge "admin" come piccolo dot in alto a destra

## 2. Nuova card "CIG Temporanei"
- Aggiunta nel set operazioni (13ª card)
- Icona `Hash` o `FileWarning`
- Label "CIG Temporanei", descrizione "Polizze con numero provvisorio"
- Al click: pre-imposta filtro `cig_temporaneo IS NOT NULL` sui risultati e mostra colonna dedicata
- Riusa la stessa sezione Risultati esistente; nessun nuovo dialog (apre direttamente la lista)
- Azione per riga: link a `/titoli/:id` per assegnare il numero definitivo

Campo DB già presente: `titoli.cig_temporaneo` (verificato).

## 3. Filtri ridotti
Sezione "2. Filtra polizza" mostra **solo**:
- **Cliente** (`SearchableSelect` esistente)
- **N° polizza** (input testo con debounce 350ms)

Rimossi dalla sezione filtri:
- Compagnia
- Stato
- Scad. dal / Scad. al

Questi torneranno poi come filtri secondari sopra la tabella Risultati (non in questo step, come richiesto).

## File toccati
- `src/pages/GestionePolizzePage.tsx` — restyle grid card, nuova entry CIG Temporanei nell'array operazioni, rimozione campi filtro extra, logica filtro `cig_temporaneo IS NOT NULL` quando operazione = `cig-temporanei`

Nessuna modifica DB, RLS, edge function, o ad altri componenti.
