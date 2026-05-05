## Fix: Netto non si aggiorna in UI dopo edit del Lordo

**Causa**: l'Input "Premio Netto" usa `defaultValue={v.firma}` senza `key` legata al valore. React non ricrea l'input quando `v.firma` cambia (post-update DB), quindi mostra il valore vecchio digitato dall'utente. L'Input "Lordo" invece ha già `key={lordo-${v.id}-${calc.lordo}}`, perciò si aggiorna correttamente.

**Fix in `src/components/polizze/VociRcaCard.tsx`**: aggiungere `key={netto-${v.id}-${v.firma}}` all'Input Netto sia desktop (riga ~430) che mobile (riga ~531). Stesso pattern usato per il Lordo.

Nessun altro cambio: la logica `handleLordoBlur` calcola e salva già `firma` (netto) nel DB; manca solo il refresh dell'UI sul campo Netto.
