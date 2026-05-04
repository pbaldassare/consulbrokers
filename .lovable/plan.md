## Obiettivo

1. Creare **GUARRACINO GAETANO** e **Gestione Milano** come veri profili Specialist (ruolo `backoffice`) con login.
2. Rilegare i 16 titoli di aprile 2026 al profilo via `titoli.specialist` (UUID) e ripulire il testo libero.
3. Mostrarti le polizze con **scadenza** in aprile 2026.

## Step 1 — Creare SEDE MILANO

Attualmente in DB esistono solo: SEDE CATANIA, SEDE SAN DONA' DI PIAVE, Ufficio di Napoli. "Gestione Milano" è uno specialist Milano → serve la sede.

Inserisco `uffici`:
- **SEDE MILANO** (città Milano, provincia MI)

Per **GUARRACINO GAETANO** assegno **SEDE CATANIA** (le sue polizze di aprile sono in area sud/Catania). Se preferisci altra sede dimmelo.

## Step 2 — Provisioning utenti via edge function `create-user`

Email fake (dominio interno) + password `Leone123!`:

| Nome | Email | Sede | Ruolo |
|------|-------|------|-------|
| GUARRACINO GAETANO | `guarracino.gaetano@consulbrokers.local` | SEDE CATANIA | backoffice |
| Gestione Milano | `gestione.milano@consulbrokers.local` | SEDE MILANO | backoffice |

La function crea `auth.users` + `profiles` con `ruolo='backoffice'` e `ufficio_id` corretto.

## Step 3 — Rilegare i 16 titoli di aprile 2026

La colonna è `titoli.specialist` (text con il nome). La sostituisco con l'**UUID del profilo** appena creato:

```sql
UPDATE titoli SET specialist = '<uuid-guarracino>'
 WHERE data_scadenza BETWEEN '2026-04-01' AND '2026-04-30'
   AND specialist = 'GUARRACINO GAETANO';

UPDATE titoli SET specialist = '<uuid-gestione-milano>'
 WHERE data_scadenza BETWEEN '2026-04-01' AND '2026-04-30'
   AND specialist = 'Gestione Milano';
```

Nota: `titoli.specialist` è `text` ma l'app la legge come riferimento al profilo (convenzione attuale del progetto). Se vuoi, in un secondo momento, posso convertirla in colonna `uuid` con FK a `profiles`.

## Step 4 — Polizze con scadenza aprile 2026

Già verificato: **16 titoli**, totale premio lordo €89.951,50. Te le mostro nella vista **Portafoglio › Carico** (rotta corrente `/portafoglio/carico`) filtrando per `data_scadenza` in aprile 2026, oppure ti genero un report on-demand. Confermo che la lista coincide con quella appena importata.

## Domande aperte (rispondi solo se non sei d'accordo)

- Sede di **GUARRACINO** = SEDE CATANIA ✔ (default proposto)
- Email fake `*.consulbrokers.local` ✔
- Password `Leone123!` ✔

Se OK approva e procedo.