## Obiettivo

Gestire **Specialist** come anagrafica interna completa (stesso form dei Produttori) e portare i campi **RUI strutturati (Sezione, Numero, Data iscrizione)** sia su Specialist che su Produttori.

Decisioni utente:
- **Specialist = solo profilo arricchito**: nessuna nuova entità in `anagrafiche_professionali`. La gestione resta sulla tabella `profiles` (che già contiene tutti i campi necessari: codice contabile, RUI strutturato, IBAN, percentuali, indirizzo).
- **Data iscrizione RUI = DATE vera** ovunque, con date picker.

---

## 1. Database (1 sola migration)

`anagrafiche_professionali.iscrizione_rui` oggi è `text` (placeholder dd/mm/yyyy). Va portato a `date` per uniformità con `profiles.data_iscrizione_rui`.

```sql
-- Step 1: nuova colonna date
ALTER TABLE public.anagrafiche_professionali 
  ADD COLUMN data_iscrizione_rui date;

-- Step 2: backfill (192 record, tutti già in formato ISO o timestamp ISO)
UPDATE public.anagrafiche_professionali
   SET data_iscrizione_rui = (iscrizione_rui::timestamp)::date
 WHERE iscrizione_rui IS NOT NULL AND iscrizione_rui <> '';

-- Step 3: la colonna text resta (legacy, usata in DocPrecontrattualePage come stringa) 
-- ma il form scriverà solo data_iscrizione_rui. Sincronizzo via trigger per non rompere i lettori legacy.
CREATE OR REPLACE FUNCTION public.sync_iscrizione_rui_text()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.data_iscrizione_rui IS NOT NULL THEN
    NEW.iscrizione_rui := to_char(NEW.data_iscrizione_rui, 'DD/MM/YYYY');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_iscrizione_rui
BEFORE INSERT OR UPDATE ON public.anagrafiche_professionali
FOR EACH ROW EXECUTE FUNCTION public.sync_iscrizione_rui_text();
```

Nessuna modifica a `profiles` (campi RUI già completi e tipizzati correttamente).

---

## 2. Tab Specialist → form completo (sostituisce la lista read-only)

`src/components/anagrafiche/SpecialistList.tsx` viene **riscritto** per diventare un manager CRUD su `profiles` (filtro `ruolo = 'backoffice'`), modellato sul form Produttori, scrivendo direttamente sulla tabella `profiles`.

Tabella (zebra, come da memory):
- Codice contabile · Cognome / Nome · Sede · Tel / Email · % Provv / Cons / RA · IBAN · Stato (Attivo)

Form (Dialog con tabs come Produttori):
- **Dati**: codice contabile, cognome, nome, email, telefono, fax, codice fiscale, descrizione, sede (Select uffici)
- **Indirizzo**: indirizzo (con `AddressAutocomplete`), CAP, città, provincia
- **RUI**: Nome RUI · **Sezione RUI** · **Numero RUI** · **Data iscrizione RUI** (date picker shadcn con `pointer-events-auto`)
- **Provvigioni**: % base · % consulenza · % RA
- **Banca**: IBAN · Intestatario C/C
- **Note**: textarea + toggle Attivo

Vincoli:
- La creazione di un nuovo Specialist NON crea utenti in `auth.users` (resta competenza di Centro Utenti & Privilegi). Banner informativo in alto: *"Per creare un nuovo Specialist con accesso al sistema usa Centro Utenti & Privilegi. Qui puoi gestire i dati anagrafici degli Specialist esistenti."* + bottone "Vai a Centro Utenti".
- Il pulsante "Nuovo" nel tab Specialist è disabilitato/nascosto: si possono solo modificare anagrafiche di utenti backoffice già esistenti. Si evita così disallineamento profilo↔auth.
- Click su riga apre il Dialog di modifica.

---

## 3. Form Produttori → aggiunta RUI strutturato

In `src/pages/AnagraficheInternePage.tsx`, tab Produttori (`isCorr`):
- Sostituire il singolo campo `RUI` (riga 623) con un blocco RUI nel tab "Dati" (o nuovo sub-blocco):
  - `Nome RUI` · `Sezione RUI` · `Numero RUI` · `Data iscrizione RUI` (date picker)
- Stato form: aggiungere `data_iscrizione_rui` (string ISO) e gestirlo nel save (`upsertMutation`).
- Tabella elenco Produttori: aggiungere colonna compatta "RUI" che mostra `Sez. X · N° Y · dd/mm/yyyy` (riusando il pattern AE righe 447-452).

---

## 4. Form AE / Resp. Sede → date picker per Iscrizione RUI

Stessi campi già presenti (riga 577) ma `Input` testo con placeholder dd/mm/yyyy → sostituito con date picker shadcn legato a `data_iscrizione_rui`. Il campo legacy `iscrizione_rui` viene popolato automaticamente dal trigger DB.

---

## 5. File toccati

| File | Modifica |
|------|----------|
| Migration SQL | colonna `data_iscrizione_rui` + trigger sync su `anagrafiche_professionali` |
| `src/components/anagrafiche/SpecialistList.tsx` | riscrittura completa: CRUD su `profiles` con tabs e date picker RUI |
| `src/pages/AnagraficheInternePage.tsx` | form Produttori: blocco RUI strutturato + date picker; AE/Resp.Sede: date picker per data; tabella Produttori: colonna RUI; tipi form e save aggiornati |
| `src/pages/DocPrecontrattualePage.tsx` | nessuna modifica (continua a leggere `iscrizione_rui` text, mantenuto in sync dal trigger) |
| `mem://ui/terminology-conventions.md` | nota: Specialist gestiti come profili arricchiti, non come anagrafiche professionali |

---

## Note tecniche

- Date picker: pattern shadcn standard con `Popover` + `Calendar` e `className="p-3 pointer-events-auto"` (richiesto per funzionare dentro Dialog).
- Persistenza: `data_iscrizione_rui` salvato come `YYYY-MM-DD` o `null`.
- Backward compat: `iscrizione_rui` (text) continua a esistere e viene aggiornato dal trigger DB ad ogni insert/update; i lettori legacy (es. precontrattuale) restano funzionanti.
- Nessun impatto su `compagnie.iscrizione_rui_sez/num` (entità diversa, già strutturata).
- Nessuna nuova RLS: `profiles` ha già policy esistenti; il tab Specialist scriverà via stesso ruolo dell'utente loggato (admin / responsabile_sede già autorizzati a UPDATE su profiles).