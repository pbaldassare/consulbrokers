# Salvataggio Firma con trasferimento esplicito a Quietanza

## Obiettivo
Sostituire il mirroring automatico Firma→Quietanza in `ImmissionePolizzaPage` con un flusso a comando esplicito: l'utente compila le righe garanzia della **Firma**, preme **Salva Firma**, e solo allora le righe + totali vengono **copiate** sulla card **Quietanza**. La Quietanza resta poi liberamente editabile fino al prossimo "Salva Firma".

## Comportamento

1. Card **Premi per Garanzia — Firma**: aggiungere pulsante prominente **"Salva e copia in Quietanza"** in header (accanto a "Aggiungi voce").
2. Click sul pulsante:
   - Snapshot delle righe Firma correnti (sottoramo, codice, descrizione, aliquota, netto, tasse, lordo).
   - Sovrascrive completamente lo stato righe Quietanza con la copia (nuovi `id` locali per evitare collisioni React key).
   - Copia anche i totali derivati (netto, tasse, addizionali, lordo) — in realtà ricalcolati lato Quietanza dalle righe copiate.
   - Toast: "Firma salvata e copiata in Quietanza".
3. Rimuovere ogni `useEffect` che sincronizza Firma→Quietanza in tempo reale (se presente in `ImmissionePolizzaPage`). La Quietanza non si aggiorna più automaticamente quando l'utente edita la Firma.
4. Rimane il pulsante esistente **"Sincronizza da Firma"** sulla card Quietanza (già presente nello screenshot) → diventa equivalente al "Salva e copia": stesso handler.
5. Cambio del **Ramo** continua a resettare entrambe le card (come oggi).

## Scope

- File principale: `src/pages/ImmissionePolizzaPage.tsx` (handler copia + bottone).
- Eventuale prop opzionale `onSaveAndCopy?: () => void` aggiunta a `PremiGaranziaCardShell` per esporre il bottone solo quando passata (così Quietanza non lo mostra).
- Nessuna modifica DB, nessuna modifica al trigger esistente `sync_quietanza_da_firma` (riguarda `TitoloDetail`/polizze esistenti, non la pagina di immissione).

## Fuori scope

- `TitoloDetail` (modifica polizza): mantiene il mirroring DB attuale.
- Schema, RPC, viste: invariati.

## Validazione

- Aprire `/portafoglio/immissione`, selezionare Ramo, aggiungere 2 righe Firma con netto/aliquota → Quietanza resta vuota.
- Click "Salva e copia in Quietanza" → Quietanza mostra le stesse 2 righe con stessi importi.
- Modifica una riga Firma → Quietanza non cambia finché non si ripreme Salva.
- Modifica manuale di una riga Quietanza → resta finché non si ripreme Salva (che la sovrascrive).
- Cambio Ramo → entrambe le card si svuotano.
