

## Piano: Estendere la tabella Compagnie con tutti i campi dal foglio Excel

### Campi estratti dal file Excel

Dal file `Compagnie_20260318145722.xlsx` emergono queste colonne:

| Campo Excel | Campo DB proposto | Tipo |
|---|---|---|
| Codice | `codice` (esiste) | text |
| Nome | `nome` (esiste) | text |
| Nome_segue | `nome_segue` | text |
| Indirizzo | `indirizzo` | text |
| Cap | `cap` | text |
| Comune | `comune` | text |
| Prov | `provincia` | text (2 char) |
| Tel | `telefono` | text |
| Fax | `fax` | text |
| CF | `codice_fiscale` | text |
| PIva | `partita_iva` | text |
| Stato | `stato` | text (Operativo/Non operativo) |
| UltScadPol | `ultima_scadenza_polizza` | date |
| GruppoCompagnia | `gruppo_compagnia` | text |
| TipoMandatario | `tipo_mandatario` | text |
| GruppoStatistico | `gruppo_statistico` | text |
| Mail | `mail` | text |
| Pec | `pec` | text |
| MailEC | `mail_ec` | text (mail estratto conto) |
| MailAvvisi | `mail_avvisi` | text |
| %RA | `percentuale_ra` | numeric (ritenuta acconto) |
| IBAN | `iban` | text |
| IntestatoA | `intestato_a` | text |

### Interventi

1. **Migrazione DB**: `ALTER TABLE compagnie ADD COLUMN` per i 21 nuovi campi. La colonna `attiva` rimane per lo switch UI; `stato` è il campo testuale dal gestionale (Operativo/Non operativo).

2. **Riscrivere `CompagnieList.tsx`**:
   - Il dialog "Nuova Compagnia" diventa un form completo con tutti i campi, organizzati in sezioni (Dati Generali, Sede, Contatti, Dati Fiscali/Bancari, Classificazione).
   - La tabella mostra le colonne principali: Codice, Nome, Gruppo, Comune, Prov, Stato, switch Attiva.
   - Barra di ricerca per filtrare per nome/codice/gruppo.

### File coinvolti
- **Migrazione DB**: aggiunta colonne alla tabella `compagnie`
- **Modificato**: `src/pages/CompagnieList.tsx` (form completo + tabella estesa)

