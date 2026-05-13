## Obiettivo
Nascondere i campi **% Provvigione** e **Società/Brand** dalle sezioni **Account Executive** e **Produttore** in tutta la UI cliente. Le provvigioni si gestiscono altrove (anagrafica Produttore + tabella titoli), quindi esporli sull'anagrafica cliente è inutile e fuorviante.

## Modifiche

### 1) `src/components/clienti/NuovoClienteDialog.tsx`
- Sezione **Account Executive** (~righe 1053–1073): rimuovere i due `<div>` "% Provvigione" e "Società/Brand". Resta solo "Profilo".
- Sezione **Produttore** (~righe 1112–1140): rimuovere i due `<div>` "% Provvigione" e "Società/Brand". Restano "Profilo" + flag "Mandato attivo" + campi mandato condizionali.
- Aggiornare il commento della sezione Produttore.
- Nei payload di salvataggio (~riga 429): forzare `percentuale: 0` e `societa_brand: null` per AE e Produttore Sede.

### 2) `src/pages/ClienteDetail.tsx` — componente `CodiceCommercialeRow`
- Aggiungere prop `hidePercentualeBrand?: boolean`.
- Passarla `true` per i ruoli **Account Executive** e **Produttore Sede**.
- Quando `true`, non renderizzare i due `<div>` "% Provvigione" (riga ~512–515) e "Società/Brand" (riga ~516–519). Il salvataggio invia comunque i valori correnti dello state (default 0 / null) — nessuna perdita dati per chi li aveva già impostati.

## Fuori scope
- Nessuna migration DB: le colonne `percentuale` e `societa_brand` su `commerciali_cliente` restano.
- Nessuna modifica alle pagine Produttore (`anagrafiche_professionali`) né al modulo provvigioni per ramo.
- `renderCorrispondenteFields` (NuovoClienteDialog) non viene toccato — non risulta usato in queste due sezioni.
