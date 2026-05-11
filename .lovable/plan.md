## Problema
Nella pagina `/compagnie` ci sono due tab con la stessa etichetta "Agenzie":
- Tab 1 (icona Layers) → in realtà mostra i **gruppi compagnia madre** (Generali, Allianz, AIG…)  
- Tab 2 (icona Building2) → mostra l'anagrafica delle agenzie/rapporti

Anche titolo e sottotitolo della pagina dicono "Agenzie / Agenzie — N agenzie totali", confondendo i due concetti.

## Correzioni in `src/pages/CompagnieList.tsx`

1. **Tab 1 "Agenzie" (Layers) → "Compagnie Assicurative"**  
   - Riga 1266: label tab → `Compagnie Assicurative`  
   - Riga 978: header card → `Compagnie Assicurative ({filtered.length})`  
   - Riga 990: colonna `Agenzie collegate` resta (sono le agenzie figlie del gruppo)

2. **Tab 2 "Agenzie" (Building2) → resta "Agenzie"**  
   - Riga 1269: invariato  
   - Riga 1319: header `Elenco Agenzie` invariato

3. **Titolo pagina e sottotitolo (righe 1225-1229)**  
   - H1: `Compagnie Assicurative / Agenzie`  
   - Sottotitolo: `Gestione compagnie assicurative, agenzie e provvigioni`  
   - Il contatore `{compagnie.length}` resta ma con etichetta `compagnie totali`

4. **Etichette correlate**  
   - Riga 717 dialog: `Agenzie collegate a <gruppo>` resta (corretto: agenzie figlie di una compagnia madre)  
   - Commento riga 659 aggiornato a `Tab Compagnie Assicurative`

## Note
- Solo modifiche di label/UI: nessun cambiamento a query, schema o logica.  
- Nessun impatto su altre pagine (CompagnieList è isolata).