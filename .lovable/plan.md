

## Piano: Forzare il refresh della pagina Carico del Mese

### Diagnosi
Il codice sorgente di `PortafoglioCaricoPage.tsx` contiene già tutte le modifiche richieste (checkbox, filtro stato, colorazione gialla, bulk actions). I dati si caricano correttamente dal database (16 polizze per aprile 2026). Il problema è che il browser sta mostrando una versione cached/vecchia della pagina.

### Intervento
Nessuna modifica al codice necessaria. Il file è già corretto. Serve solo forzare un rebuild/refresh:

1. **Aggiungere un commento innocuo** al file `PortafoglioCaricoPage.tsx` per triggerare il hot-reload di Vite
2. Verificare che il preview si aggiorni con la nuova UI

### Risultato atteso
La pagina mostrerà: checkbox di selezione, filtro "Stato incasso", pulsanti bulk "Metti a Cassa" / "Annulla Incasso", righe gialle per gli incassati.

