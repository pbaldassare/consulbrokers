-- La stessa posta non può stare su un account portale (cliente/prospect)
-- e su un account del gestionale. Il provisioning cliente non può
-- trasformare un utente gestionale in cliente.

CREATE OR REPLACE FUNCTION private.email_conflitto_portale_gestionale(
  p_email text,
  p_ruolo text,
  p_escludi uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(btrim(p_email), '') <> ''
     AND coalesce(btrim(p_ruolo), '') <> ''
     AND EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.id IS DISTINCT FROM p_escludi
         AND lower(btrim(p.email)) = lower(btrim(p_email))
         AND p.ruolo IS NOT NULL
         AND (p.ruolo IN ('cliente', 'prospect'))
             IS DISTINCT FROM
             (lower(btrim(p_ruolo)) IN ('cliente', 'prospect'))
     );
$$;

REVOKE ALL ON FUNCTION private.email_conflitto_portale_gestionale(text, text, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.trg_email_portale_gestionale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.ruolo IS NOT NULL
     AND OLD.ruolo NOT IN ('cliente', 'prospect')
     AND NEW.ruolo IN ('cliente', 'prospect')
  THEN
    RAISE EXCEPTION 'Non si può trasformare un account gestionale in cliente o prospect.'
      USING ERRCODE = '23514';
  END IF;

  IF private.email_conflitto_portale_gestionale(NEW.email, NEW.ruolo, NEW.id) THEN
    RAISE EXCEPTION 'Questa mail è già usata da un account cliente/prospect o del gestionale. I due tipi non possono condividere la stessa posta.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.trg_email_portale_gestionale() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_profiles_email_portale_gestionale ON public.profiles;
CREATE TRIGGER trg_profiles_email_portale_gestionale
  BEFORE INSERT OR UPDATE OF email, ruolo ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.trg_email_portale_gestionale();
