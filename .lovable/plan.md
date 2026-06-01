## Aggiungere "Assegno" tra i tipi di pagamento

Aggiungo l'opzione **Assegno** al selettore "Tipo Pagamento" usato in messa a cassa, sia nel dialog bulk che nella card Operazioni di TitoloDetail. Il valore salvato a DB sarà `assegno` (stesso pattern di `contanti` / `bonifico`).

### File da modificare

1. `src/components/portafoglio/MessaCassaDialog.tsx` (riga ~150) — aggiungere `<SelectItem value="assegno">Assegno</SelectItem>` dopo Bonifico.
2. `src/pages/TitoloDetail.tsx` (riga ~1835) — stessa aggiunta nel Select del dialog "Conferma Messa a Cassa".

### Database

La colonna `titoli.tipo_pagamento` è testo libero (nessun CHECK constraint, nessun enum). Il valore `'assegno'` viene salvato automaticamente dalle mutation esistenti — nessuna migration necessaria.

### Fuori scope

- Nessun campo aggiuntivo (es. numero assegno, banca emittente).
- Nessuna modifica alla visualizzazione esistente di `tipo_pagamento` (mostra già il valore così com'è).
