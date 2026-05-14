## Tabella "Polizze del cliente" — colonne riviste

File unico: `src/pages/ClienteDetail.tsx` (componente `PolizzeClienteTable` + query `polizze_cliente`).

### Nuove colonne
| # | Colonna | Sorgente |
|---|---------|----------|
| 1 | (chevron) | toggle rate |
| 2 | N. Polizza | `numero_titolo` |
| 3 | Tipo | badge "Polizza" / "Rata N" |
| 4 | **Gruppo Ramo** *(nuovo)* | `ramo.gruppo_ramo.descrizione` |
| 5 | **Agenzia** *(rimappato)* | `compagnia_diretta.nome` (titoli.compagnia_id → compagnie) |
| 6 | Premio € | `premio_lordo` |
| 7 | Incassato € | `importo_incassato` |
| 8 | **Stato** *(arricchito)* | combinazione ruolo + stato (vedi sotto) |
| 9 | Data Incasso | `data_incasso` |

Rimosse: **Prodotto**, **Rate** (`1 + N`).

### Logica colonna "Stato"
Render con un badge unico:
- Riga **madre** → `Polizza` + variante colore in base a `stato` (`attivo` default, `incassato` success, `stornato` destructive, `scaduto`/`sospeso` warning).
- Riga figlia → se è la prima rata della polizza annuale o successive: badge `Quietanza N` (es. "Quietanza 2"); se invece la chain è poliennale/rate infrannuali: `Rata N`. Per ora distinzione semplice: tutte le figlie = `Quietanza N` (allineato con [Auto-quietanza su messa a cassa]). Variante colore sempre dallo `stato`.

### Modifiche query `polizze_cliente`
Aggiungere relazioni:
```
ramo:rami!titoli_ramo_id_fkey(id, descrizione, gruppo_ramo:gruppi_ramo!rami_gruppo_ramo_id_fkey(id, descrizione)),
compagnia_diretta:compagnie!titoli_compagnia_id_fkey(id, nome)
```
Rimuovere `prodotti(nome_prodotto, compagnie(nome))` (non più mostrato; se serve in altri punti si lascia, ma qui non serve — verifico riferimenti prima di rimuovere).

### Fuori scopo
- Nessun cambio a `groupTitoliByPolizza`, navigazione, altre tab.
- Nessuna migration DB.

### Domanda di chiarimento
Per le righe figlie, etichetta **"Quietanza N"** sempre, o vuoi distinguere `Rata` (frazionamento mensile/trimestrale/semestrale) da `Quietanza` (rinnovo annuale)? Per ora propongo "Quietanza N" uniforme.