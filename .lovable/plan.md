## Obiettivo
Nella sezione **Contratto**:
1. Rimuovere il campo **Targa/Telaio** (già presente nel blocco Veicolo).
2. Trasformare il campo **Vincolo** da testo libero a flag **Sì/No** (default **No**), persistito su DB.

## Modifiche DB
Aggiungere nuova colonna boolean dedicata, evitando di rompere eventuali dati testuali esistenti in `titoli.vincolo`:

```sql
ALTER TABLE public.titoli
  ADD COLUMN vincolo_attivo boolean NOT NULL DEFAULT false;

-- Migrazione soft: marca true le righe che oggi hanno vincolo testuale non vuoto
UPDATE public.titoli
   SET vincolo_attivo = true
 WHERE vincolo IS NOT NULL AND btrim(vincolo) <> '';
```

La colonna legacy `vincolo` (text) resta in DB per storico ma non più mostrata né editata dall'UI.

## Modifiche UI (`src/pages/TitoloDetail.tsx`)

### View mode Contratto (riga ~1742-1743)
- Sostituire `<FieldRow label="Vincolo" value={fmt(t.vincolo)} />` con `<FieldRow label="Vincolo" value={(t as any).vincolo_attivo ? "Sì" : "No"} />`
- Rimuovere `<FieldRow label="Targa/Telaio" value={fmt(t.targa_telaio)} />`

### Edit mode Contratto (righe ~1840-1856)
- Sostituire l'`Input` Vincolo con uno `Switch` (componente già usato altrove) etichettato "Vincolo"
- Rimuovere il blocco di edit Targa/Telaio
- Aggiornare `contrattoForm`: `vincolo: ""` → `vincolo_attivo: false`; rimuovere `targa_telaio`
- Aggiornare init da `titolo` (riga ~482-483)
- Aggiornare salvataggio (righe ~502, 517-518): includere `vincolo_attivo`, rimuovere `vincolo` e `targa_telaio` dalla mutation Contratto

### Tipi Supabase
Verranno rigenerati automaticamente dopo la migrazione.

## Vincoli rispettati
- Targa/Telaio resta editabile dal blocco Veicolo (sezione RCA, già presente alle righe 2698/2754).
- Nessun dato esistente eliminato (colonna legacy mantenuta).
- Default `false` come richiesto.