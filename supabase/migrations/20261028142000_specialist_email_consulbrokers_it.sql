-- Email specialist: niente @consulbrokers.local; FP/GM come in Excel legacy.

CREATE OR REPLACE FUNCTION public.sync_auth_user_email(p_user_id uuid, p_new_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text := lower(trim(p_new_email));
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'email vuota';
  END IF;
  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE lower(u.email) = v_email AND u.id IS DISTINCT FROM p_user_id
  ) THEN
    RAISE EXCEPTION 'email già in uso: %', v_email;
  END IF;

  UPDATE auth.users SET email = v_email, updated_at = now() WHERE id = p_user_id;
  UPDATE auth.identities
  SET
    provider_id = v_email,
    identity_data = jsonb_set(
      coalesce(identity_data, '{}'::jsonb),
      '{email}',
      to_jsonb(v_email)
    ),
    updated_at = now()
  WHERE user_id = p_user_id AND provider = 'email';
  UPDATE public.profiles SET email = v_email WHERE id = p_user_id;
END;
$$;

-- Paparella: Excel fgpaparella@
SELECT public.sync_auth_user_email(
  'c1c29591-a279-4be5-b5ea-4df9696cf62e'::uuid,
  'fgpaparella@consulbrokers.it'
);

-- Gestione Milano: un solo account gestionemilano@ (backoffice GM), elimina duplicato .local
DO $$
DECLARE
  v_src uuid := 'd7c19fc3-e1c1-4825-a3f2-d0a54bac7ae3';
  v_dst uuid := '6a5614bb-d1e1-4202-afe2-cb2fa61290ee';
  v_perm jsonb;
BEGIN
  SELECT permessi_json INTO v_perm FROM public.profiles WHERE id = v_src;

  UPDATE public.profiles dst
  SET
    ruolo = 'backoffice',
    codice_contabile = 'GM',
    nome = 'Gestione Milano',
    cognome = 'Gestione',
    descrizione = 'Gestione Milano',
    ufficio_id = coalesce((SELECT ufficio_id FROM public.profiles WHERE id = v_src), dst.ufficio_id),
    telefono = coalesce((SELECT telefono FROM public.profiles WHERE id = v_src), dst.telefono),
    permessi_json = coalesce(v_perm, dst.permessi_json),
    attivo = true
  WHERE dst.id = v_dst;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_dst, 'backoffice')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.profilo_sedi (profilo_id, ufficio_id, primaria)
  SELECT v_dst, ps.ufficio_id, ps.primaria
  FROM public.profilo_sedi ps
  WHERE ps.profilo_id = v_src
  ON CONFLICT (profilo_id, ufficio_id) DO NOTHING;

  INSERT INTO public.profilo_sedi (profilo_id, ufficio_id, primaria)
  SELECT v_dst, p.ufficio_id, true
  FROM public.profiles p
  WHERE p.id = v_dst AND p.ufficio_id IS NOT NULL
  ON CONFLICT (profilo_id, ufficio_id) DO NOTHING;

  UPDATE public.codici_commerciali_cliente SET profilo_id = v_dst WHERE profilo_id = v_src;

  DELETE FROM public.user_roles WHERE user_id = v_src;
  DELETE FROM public.profilo_sedi WHERE profilo_id = v_src;
  DELETE FROM public.profiles WHERE id = v_src;
  DELETE FROM auth.users WHERE id = v_src;
END;
$$;

SELECT public.sync_auth_user_email(id, replace(email, '@consulbrokers.local', '@consulbrokers.it'))
FROM auth.users
WHERE email LIKE '%@consulbrokers.local'
  AND id NOT IN ('d7c19fc3-e1c1-4825-a3f2-d0a54bac7ae3'); -- già rimosso

DROP FUNCTION public.sync_auth_user_email(uuid, text);
