## Obiettivo
Nella tabella **Polizze del cliente** (`ClienteDetail.tsx`, tab "Polizze · Quietanze") aggiungere la colonna **Ramo** (sottoramo) accanto a **Gruppo Ramo**, mostrando il **primo sottoramo selezionato** sulla polizza.

## Contesto
La query polizze (riga ~1510) già carica `ramo:rami!titoli_ramo_id_fkey(id, descrizione, gruppo_ramo:...)`. `titoli.ramo_id` è per design il **primo sottoramo** delle righe garanzia (derivato in fase di immissione), quindi è già il dato richiesto — nessuna nuova query/JOIN necessario.

## Modifiche (solo `src/pages/ClienteDetail.tsx`)

1. **Header tabella** (riga 1138): inserire `<TableHead>Ramo</TableHead>` subito dopo `Gruppo Ramo`.
2. **Riga Quietanze (filtro = quietanze)** (riga 1163): aggiungere `<TableCell>{r.ramo?.descrizione || "—"}</TableCell>` dopo la cella Gruppo Ramo.
3. **Riga Polizza madre** (riga 1202): aggiungere `<TableCell>{head.ramo?.descrizione || "—"}</TableCell>` dopo la cella Gruppo Ramo. Aggiungere variabile locale `const ramo = head.ramo?.descrizione || "—";` accanto a `gruppoRamo`.
4. **Riga Quietanze figlie espanse** (riga 1228): aggiungere `<TableCell className="text-muted-foreground text-xs">{r.ramo?.descrizione || "—"}</TableCell>` dopo la cella Gruppo Ramo.
5. Aggiornare i `colSpan` "Nessuna quietanza" (riga 1150) da `isAdmin ? 9 : 8` a `isAdmin ? 10 : 9`.

## Fuori scopo
- Nessuna modifica al DB / alle query.
- Nessuna modifica a Carico, Storico, Attive, ECClienti o altre liste (eventuale estensione in passaggio separato se richiesto).
