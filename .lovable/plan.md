## Problema

La pagina `/portafoglio/carico` (e analogamente Attive/Storico, ovunque sia montato `MessaCassaDialog`) crasha con:

```
TypeError: Cannot read properties of undefined (reading 'id')
```

bloccando l'intera sezione Portafoglio con l'AppErrorBoundary "Si è verificato un errore nella sezione Portafoglio".

## Causa

In `src/components/portafoglio/MessaCassaDialog.tsx` riga **619**:

```tsx
{!isMulti && (
  <div className="...">
    {renderCompensazioniPanel(titoli[0].id)}
  </div>
)}
```

`isMulti = titoli.length > 1`, quindi con `titoli = []` (stato iniziale nelle pagine Carico/Attive/Storico: `const [cassaDialogTitoli, setCassaDialogTitoli] = useState([])`) la condizione `!isMulti` è `true`, ma `titoli[0]` è `undefined` → accesso a `.id` lancia il TypeError.

La JSX viene valutata dal componente padre a ogni render anche quando il `<Dialog open={false}>` non monta i figli nel DOM: l'espressione `titoli[0].id` viene comunque calcolata.

Stesso pattern, ma già protetto, alla riga 568: `titoli[0]?.numero_titolo || titoli[0]?.id?.slice(0, 8)`.

## Fix

Aggiungere la guardia `titoli.length > 0` (o `titoli[0]`) alla condizione del pannello compensazioni single-titolo:

```tsx
{!isMulti && titoli[0] && (
  <div className="rounded-md border border-amber-400/50 ...">
    {renderCompensazioniPanel(titoli[0].id)}
  </div>
)}
```

Modifica isolata a una sola riga di `MessaCassaDialog.tsx`, nessun altro file impattato. Comportamento UX invariato: quando il dialog si apre con un titolo selezionato (`titoli.length === 1`), il pannello renderizza come prima; quando il dialog è chiuso con array vuoto, non crasha più.

## Verifica

- Ricaricare `/portafoglio/carico`, `/portafoglio/attive`, `/portafoglio/storico` → niente più AppErrorBoundary.
- Aprire la messa a cassa di una singola polizza → pannello Compensazioni visibile e funzionante.
- Aprire la messa a cassa multipla → accordion per titolo (ramo `isMulti`) invariato.
