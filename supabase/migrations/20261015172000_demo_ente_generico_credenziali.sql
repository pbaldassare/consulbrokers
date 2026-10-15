-- Demo ente: credenziali e anagrafica generiche (no riferimenti Roma/comune nel login)
-- Login: demo.ente@consulbrokers.it / Leone123! — provisioning: edge seed-comune-roma-demo

DO $$
DECLARE
  v_cliente uuid := 'e8f4a2b0-7c3d-4e1f-9a6b-2d4e8f1c0b5a';
BEGIN
  UPDATE public.clienti SET
    ragione_sociale = 'Demo Ente Pubblico',
    email = 'demo.ente@consulbrokers.it',
    pec = 'demo.ente@pec.demo.it',
    indirizzo_sede = 'Via Esempio 1',
    cap_sede = '00100',
    citta_sede = 'Demo',
    provincia_sede = 'DM',
    codice_ricerca = 'ENTE_DEMO',
    note = '[DEMO] Cliente fittizio ente pubblico — area riservata e assistente AI per presentazioni.',
    attivo = true,
    area_riservata_tipo = 'completa',
    updated_at = now()
  WHERE id = v_cliente;

  UPDATE public.nominativi_cliente SET
    email = 'demo.ente@consulbrokers.it'
  WHERE cliente_id = v_cliente AND email ILIKE '%demo.comune.roma%';

  UPDATE public.polizza_cga SET
    contraente_ragione_sociale = 'Demo Ente Pubblico',
    contraente_indirizzo = 'Via Esempio 1',
    contraente_comune = 'Demo',
    contraente_provincia = 'DM',
    contraente_cap = '00100',
    updated_at = now()
  WHERE cliente_id = v_cliente;

  UPDATE public.documenti SET
    path_storage = replace(path_storage, '/demo-comune-roma/', '/demo-ente/')
  WHERE path_storage LIKE '%/demo-comune-roma/%'
    AND (
      (entita_tipo = 'cliente' AND entita_id = v_cliente)
      OR entita_tipo = 'sinistro'
    );

  UPDATE public.profiles SET
    nome = 'Demo Ente Pubblico',
    cognome = '',
    email = 'demo.ente@consulbrokers.it',
    updated_at = now()
  WHERE id IN (SELECT user_id FROM public.clienti WHERE id = v_cliente AND user_id IS NOT NULL);
END $$;
