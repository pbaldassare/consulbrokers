

## Piano: Inserire ~480 record Anagrafiche Professionali

### Cosa
Una migrazione SQL per popolare la tabella `anagrafiche_professionali` con tutti i dati estratti dai file Excel e screenshot forniti.

### Record da inserire

| Tipo | Fonte | Quantita |
|------|-------|----------|
| Account Executive | Excel | ~186 |
| Corrispondente | Excel | ~267 |
| Liquidatore | Screenshot | ~12 |
| Perito | Screenshot | ~8 |
| Legale | Screenshot | ~5 |

### Come

**1 file: migrazione SQL**

- Aggiunge constraint `UNIQUE (codice, tipo)` se non esiste
- INSERT con tutti i campi mappati dai file Excel (codice, ragione_sociale, telefono, email, RUI, coordinate bancarie, percentuali, indirizzi)
- `ON CONFLICT (codice, tipo) DO NOTHING` per idempotenza
- `attivo = NOT annullato` per i record con flag "A=Ann"
- Per i Liquidatori: `compagnia_id` collegato via subquery sulle compagnie esistenti

### Risultato
~478 record visibili immediatamente nella pagina Anagrafiche Professionali.

