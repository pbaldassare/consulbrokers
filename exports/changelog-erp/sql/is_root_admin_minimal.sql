-- Minimo per policy scrittura changelog (CBnet: solo admin@consul.it).
-- Adattare l'email prima di applicare su un altro ambiente.

CREATE OR REPLACE FUNCTION public.is_root_admin(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_uid
      AND lower(btrim(email)) = 'admin@consul.it'
  );
$$;

REVOKE ALL ON FUNCTION public.is_root_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_root_admin(uuid) TO authenticated;
