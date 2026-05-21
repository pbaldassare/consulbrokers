## Problema

Nel modal Import IA l’anteprima è costruita in verticale dentro un `DialogContent` con altezza non controllata. Con viewport come quello attuale, la tabella con `SearchableSelect`, badge, messaggi e footer può risultare compressa, tagliata o difficile da scorrere. Inoltre l’anteprima mostra poco: separa male stato file, risposta IA e righe realmente importabili.

## Piano di correzione

1. **Riorganizzare il modal Import IA**
   - Rendere il dialog largo ma responsive: massimo circa 96vw e altezza massima 88vh.
   - Strutturarlo in header fisso, corpo scrollabile e footer fisso.
   - Evitare che il footer “Salva / Annulla” finisca fuori schermo.

2. **Creare un’area anteprima più leggibile**
   - In alto: pannello compatto con file caricato, stato analisi, warning/errore.
   - Sotto: contatori chiari “righe estratte”, “salvabili”, “da rivedere”.
   - Se non ci sono dati, mostrare uno stato vuoto ordinato invece di una tabella o messaggi sparsi.

3. **Sistemare la tabella dati estratti**
   - Mettere la tabella in un contenitore con scroll verticale e orizzontale controllato.
   - Rendere sticky l’intestazione della tabella.
   - Ridurre padding e larghezze delle colonne per viewport medio/piccolo.
   - Fare in modo che i `SearchableSelect` non allarghino o rompano la griglia.

4. **Aggiungere preview documento quando utile**
   - Per PDF: usare il componente `PdfPreview` già presente, mostrando una preview laterale o collassabile.
   - Per immagini: mostrare un’anteprima dell’immagine caricata.
   - La preview documento non deve rubare spazio alla tabella: sarà scrollabile e limitata in altezza.

5. **Verifica finale**
   - Controllare il modal a 955x599 e desktop.
   - Verificare che caricamento, warning, errore e tabella con righe siano tutti leggibili senza sovrapposizioni.
   - Controllare che non compaiano più layout instabili legati allo scroll del modal.