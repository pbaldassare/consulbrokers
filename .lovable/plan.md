## Obiettivo
Sulla pagina della **polizza madre** (titolo con rate successive, `riga=0` + esistono successori) l'incasso NON deve essere possibile. L'incasso si fa solo aprendo la singola **quietanza/rata** dalla lista "Quietanze di questa polizza".

## Cosa cambia (solo UI in `src/pages/TitoloDetail.tsx`)

1. **Rilevamento "è madre con rate"**
   Già disponibile via la query che popola "Quietanze di questa polizza (N)". Definisco `isMadreConRate = quietanzeSuccessive.length > 0` (oppure il flag già esistente usato per il banner azzurro "Polizza madre — questa polizza ha N rate successive").

2. **Sezione "Messa a Cassa" + bottoni "Incassa" / "Garantito"**
   - Se `isMadreConRate === true` → **nascondo** completamente il blocco "Messa a Cassa" (le 3 date) e i due bottoni `Incassa` / `Garantito`.
   - Al loro posto mostro un piccolo callout informativo:
     > "L'incasso si effettua sulla singola **quietanza/rata**. Apri la rata da incassare dalla lista *Quietanze di questa polizza* qui sopra."
     con un bottone **"Vai alla prima rata da incassare"** che fa `navigate(`/titoli/${primaRataDaIncassare.id}`)` (prima quietanza con `stato='attivo'` e `!data_messa_cassa`). Se non esiste, il bottone è disabilitato.

3. **Badge "Da incassare" in alto a destra del blocco**
   - Rimosso sulla madre (non è incassabile).

4. **Operazioni che restano sulla madre** (invariate)
   Sospensione, Riattivazione, Sostituzione, Estinzione, Appendici, Storno, Regolazione, Precontrattuale, Scansione AI, Annullamento, Reinvia notifica → tutte rimangono perché sono operazioni a livello contratto.

5. **Pagine singola rata (successori, riga>0)**
   Nessun cambiamento: continuano a mostrare Messa a Cassa + Incassa/Garantito come oggi.

6. **Caso polizza non poliennale a rata unica** (nessuna rata successiva)
   `isMadreConRate === false` → comportamento attuale invariato (Incassa/Garantito visibili sulla madre, che coincide con la rata unica).

## File toccati
- **Modificato**: `src/pages/TitoloDetail.tsx` (solo presentazione: nasconde blocco Messa a Cassa + bottoni quando madre-con-rate, aggiunge callout + CTA "Vai alla prima rata da incassare").

## Cosa NON cambia
- Schema DB, trigger, RPC, contabilità, provvigioni, flussi di incasso.
- Logica di calcolo `data_messa_cassa` / `data_incasso`.
- Tutte le altre pagine (Carico, Attive, Storico, ecc.).
