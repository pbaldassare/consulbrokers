## Problema

Creando una nuova **Agenzia** con Compagnia madre (es. `DL ASSISERVICE` → `CATTOLICA`) appare l'errore:
> *Un'agenzia non può avere un rapporto N:N con la propria Compagnia di appartenenza*

## Causa

Due trigger DB si pestano i piedi:

1. `tg_compagnie_auto_rapporto_principale` (AFTER INSERT su `compagnie`) crea automaticamente il **rapporto principale** (`is_principale = true`) con `compagnia_id = NEW.id` e `gruppo_compagnia_id = NEW.gruppo_compagnia_id`.
2. `trg_block_self_referential_rapporto` (BEFORE INSERT su `compagnia_rapporti`) blocca qualunque riga in cui `compagnia.gruppo_compagnia_id = NEW.gruppo_compagnia_id` — pensato per impedire **rapporti N:N** plurimandatari "autoreferenziali", ma colpisce anche il rapporto principale legittimo.

Risultato: ogni nuova agenzia con compagnia madre fallisce.

## Fix

Migrazione SQL: aggiornare `trg_block_self_referential_rapporto` perché salti il controllo quando `NEW.is_principale = true` (il rapporto principale è per definizione 1:1 con la propria Compagnia madre e non è un N:N).

```sql
CREATE OR REPLACE FUNCTION public.trg_block_self_referential_rapporto()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gruppo uuid;
BEGIN
  -- Il rapporto principale (1:1 con la compagnia madre) è legittimo: skip
  IF COALESCE(NEW.is_principale, false) = true THEN
    RETURN NEW;
  END IF;
  IF NEW.compagnia_id IS NULL OR NEW.gruppo_compagnia_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT gruppo_compagnia_id INTO v_gruppo FROM public.compagnie WHERE id = NEW.compagnia_id;
  IF v_gruppo IS NOT NULL AND v_gruppo = NEW.gruppo_compagnia_id THEN
    RAISE EXCEPTION 'Un''agenzia non può avere un rapporto N:N con la propria Compagnia di appartenenza';
  END IF;
  RETURN NEW;
END;
$$;
```

Nessuna modifica frontend necessaria. Il controllo anti-autoreferenziale resta attivo per i veri rapporti N:N plurimandatari.
