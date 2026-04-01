

## Piano: Tabella polizze stile "Scheda Cliente" DOCX

### Cosa cambia

Trasformare la pagina "Le tue Polizze" da card verticali a una **tabella professionale** che replica lo schema del documento DOCX di Consulbrokers:

| Colonna | Campo DB |
|---------|----------|
| Mandato / Compagnia | `compagnie.nome` + `produttore_nome` (o `tipo_mandatario`) |
| Prodotto | `rami.descrizione` o `prodotto_nome` o `descrizione_polizza` |
| Numero Polizza / Targa | `numero_titolo` + `targa_telaio` |
| Data scadenza | `data_scadenza` |
| Fraz. | `periodicita` |
| Premio Annuo Lordo | `premio_lordo` |

In fondo alla tabella: **riga totale** con somma premi lordi.

### Dettagli implementazione

**File:** `src/pages/cliente/ClientePolizze.tsx` — riscrittura completa

- Header con logo/titolo "ELENCO POSIZIONI ASSICURATIVE ATTIVE"
- Tabella HTML con header colorato (teal/brand)
- Ogni riga cliccabile → link al dettaglio polizza
- Badge stato sulla riga (colore per attivo/scaduto/sospeso)
- Riga footer con **Totale premio annuo lordo** in grassetto
- Query aggiornata per fetchare anche `produttore_nome`, `targa_telaio`, `prodotto_nome`
- Responsive: su mobile la tabella diventa scrollabile orizzontalmente
- Mantiene indicatore scadenza (giorni mancanti) come badge nella colonna data

### Nessuna modifica DB necessaria
Tutti i campi esistono già nella tabella `titoli`.

### File coinvolti

| File | Azione |
|------|--------|
| `src/pages/cliente/ClientePolizze.tsx` | Riscrittura da card a tabella stile DOCX |

