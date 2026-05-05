## Modifiche a `src/pages/TitoloDetail.tsx` (sezione TitoloDetail)

### 1. Sezione "Commerciale & Provvigioni" (linee ~2184-2261)
- **Rimuovere** completamente il blocco "Totale Provvigioni (Firma + Quietanza)" (linee 2213-2256), incluso il riepilogo "Dovuto a {commName} / Quota Consulbrokers SPA" e la riga "Differenza Consulbrokers − Commerciale".
- **Rimuovere** anche la griglia che renderizza `renderSplit("Provvigioni alla Firma", …)` e `renderSplit("Provvigioni Quietanza", …)` da questa sezione (linee 2208-2211): vengono spostate sotto le card di premio in "Importi".
- Rimane in "Commerciale & Provvigioni" solo il banner del commerciale (avatar + nome + %), che identifica chi è il commerciale del titolo.

### 2. Sezione "Importi" — modalità view (linee ~2288-2313)
Sotto la card "Premio alla firma odierno" (subito dopo `FieldRow Provvigioni`, linea 2299) inserire la card di split:

```
renderSplit("Provvigioni alla Firma", sF, "teal")
```

Sotto la card "Premio prossima quietanza" (dopo linea 2309) inserire:

```
renderSplit("Provvigioni Quietanza", sQ, "amber")
```

Per farlo:
- Estrarre la logica `splitFor` / `renderSplit` / `commName` / `percComm` / `commercialeIsAdmin` in una funzione/helper definita prima della sezione Importi (oppure calcolarli inline nella view di Importi, riusando le stesse formule attuali).
- Mantenere identico lo stile delle card (border, barra teal/amber, righe con commerciale e Consulbrokers SPA).
- Nascondere la card di split quando il relativo importo provvigione è `null`/`0`, così come avviene oggi.

### 3. Comportamento per RCA Auto
Per le polizze RCA Auto la sezione "Importi" non mostra le card Premio firma/quietanza in view mode (linea 2290 condizionale): in quel caso le card di split provvigioni vengono mostrate comunque, raggruppate in una griglia 2 colonne subito sopra la sezione VociRcaCard, mantenendo coerenza visiva.

### 4. Nessuna modifica a:
- Logica di calcolo provvigioni
- Schema DB
- Form di edit (modalità editing rimane invariata)
- Sezione VociRcaCard
