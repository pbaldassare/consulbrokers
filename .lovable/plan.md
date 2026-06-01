# Sottorami "Contributo Forzoso" e "Oneri" su ogni Gruppo Ramo

## Obiettivo
Per ogni record di `gruppi_ramo` esistere sempre 2 righe in `rami`:
- `<CODICE_GRUPPO>-CF` — descrizione **CONTRIBUTO FORZOSO**
- `<CODICE_GRUPPO>-ON` — descrizione **ONERI**

con `aliquota_tasse_ramo = 0`, `aliquota_tasse_ard = 0`, `ssn_attivo = false`, `attivo = true` e — novità — un flag `escludi_provvigioni = true` che indica al motore provvigioni di saltarle.

## Esempio
Stato attuale Ramo `ZD - CORPI`:
```text
ZD  CORPI
 └─ PI - R.C. AUTOVEICOLI            tasse 12,5%   provv. standard
```
Dopo la migrazione:
```text
ZD  CORPI
 ├─ PI - R.C. AUTOVEICOLI            tasse 12,5%   provv. standard
 ├─ ZD-CF - CONTRIBUTO FORZOSO       tasse 0%      escludi_provvigioni = true
 └─ ZD-ON - ONERI                    tasse 0%      escludi_provvigioni = true
```
Stesso pattern applicato a tutti i 12 Gruppi → +24 righe in `rami`. Alla creazione di un nuovo Gruppo (es. domani aggiungo `XX - CYBER`) il trigger crea automaticamente `XX-CF` e `XX-ON`.

## Migration

```sql
-- 1. Flag su rami
ALTER TABLE public.rami
  ADD COLUMN IF NOT EXISTS escludi_provvigioni boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.rami.escludi_provvigioni IS
  'Se true il sottoramo non genera tasse né provvigioni (es. Contributo Forzoso, Oneri).';

-- 2. Seed delle 24 righe per i Gruppi già esistenti
INSERT INTO public.rami
  (codice, descrizione, gruppo_ramo_id, aliquota_tasse_ramo, aliquota_tasse_ard,
   ssn_attivo, attivo, escludi_provvigioni)
SELECT g.codice || '-CF', 'CONTRIBUTO FORZOSO', g.id, 0, 0, false, true, true
FROM public.gruppi_ramo g
ON CONFLICT (codice) DO NOTHING;

INSERT INTO public.rami
  (codice, descrizione, gruppo_ramo_id, aliquota_tasse_ramo, aliquota_tasse_ard,
   ssn_attivo, attivo, escludi_provvigioni)
SELECT g.codice || '-ON', 'ONERI', g.id, 0, 0, false, true, true
FROM public.gruppi_ramo g
ON CONFLICT (codice) DO NOTHING;

-- 3. Trigger AFTER INSERT su gruppi_ramo per i futuri Gruppi
CREATE OR REPLACE FUNCTION public.trg_gruppi_ramo_seed_cf_oneri()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rami
    (codice, descrizione, gruppo_ramo_id, aliquota_tasse_ramo, aliquota_tasse_ard,
     ssn_attivo, attivo, escludi_provvigioni)
  VALUES
    (NEW.codice || '-CF', 'CONTRIBUTO FORZOSO', NEW.id, 0, 0, false, true, true),
    (NEW.codice || '-ON', 'ONERI',              NEW.id, 0, 0, false, true, true)
  ON CONFLICT (codice) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_cf_oneri ON public.gruppi_ramo;
CREATE TRIGGER trg_seed_cf_oneri
AFTER INSERT ON public.gruppi_ramo
FOR EACH ROW EXECUTE FUNCTION public.trg_gruppi_ramo_seed_cf_oneri();
```

Nessuna policy/grant nuova: `rami` esiste già con i suoi grants.

## Frontend (minimo, niente cambi di logica oltre il rispetto del flag)

1. `src/hooks/useRamiLookup.ts` — `RamoOption` espone anche `escludi_provvigioni`; `select` aggiornato.
2. `src/pages/ImmissionePolizzaPage.tsx` (`PremiGaranziaCardShell`): quando l'utente sceglie un sottoramo con `escludi_provvigioni=true`, le celle Tasse/Aliquota della riga vengono forzate a `0` e disabilitate (read-only) — il netto inserito resta tale, lordo = netto.
3. `src/lib/resolveProvvigione.ts` (o equivalente motore provvigioni titolo): early-return `{ percentuale: 0, importo: 0 }` se `rami.escludi_provvigioni` è true sul `titoli.ramo_id`.
4. `src/pages/TabelleBasePage.tsx` → tab **Rami**: nuova colonna/toggle "Esclusa provv." per visibilità admin; nessuna modifica massiva dalle UI (i 24 record di seed restano editabili come gli altri).

## Memoria
Aggiungo `mem://insurance/sottorami-cf-oneri-default` con: codici `<GRUPPO>-CF`/`<GRUPPO>-ON`, flag `escludi_provvigioni`, trigger `trg_seed_cf_oneri`, regola UI tasse=0 forzato.

## Out of scope
- Inserimento righe a 0% nelle matrici provvigioni (`compagnia_rapporto_rami`, `produttore_provvigioni_per_ramo`, ecc.): non serve, il flag basta a saltare il calcolo.
- Variazione dei codici esistenti.
- Modifiche al catalogo `rca_garanzie`.
