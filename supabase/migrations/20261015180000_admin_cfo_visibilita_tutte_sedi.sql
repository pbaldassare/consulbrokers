-- Admin/CFO: visibilità «tutte le sedi» in permessi_json; niente righe profilo_sedi restrittive.
UPDATE public.profiles p
SET permessi_json = COALESCE(p.permessi_json, '{}'::jsonb) || jsonb_build_object('_visibility', 'all')
WHERE p.ruolo IN ('admin', 'cfo')
  AND (
    p.permessi_json IS NULL
    OR p.permessi_json->>'_visibility' IS DISTINCT FROM 'all'
  );

DELETE FROM public.profilo_sedi ps
WHERE ps.profilo_id IN (
  SELECT id FROM public.profiles WHERE ruolo IN ('admin', 'cfo')
);
