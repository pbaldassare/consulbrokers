-- Specialist da export Excel TTXSP00F_20261027105701 (38 righe attive)
-- Idempotente: lookup per email, creazione auth solo se assente.

CREATE OR REPLACE FUNCTION public.import_specialist_excel_row(
  p_email text,
  p_codice text,
  p_nome text,
  p_cognome text,
  p_descrizione text,
  p_ufficio_id uuid,
  p_telefono text,
  p_fax text,
  p_nome_rui text,
  p_data_rui date,
  p_num_rui text,
  p_sez_rui text,
  p_iban text,
  p_sede_only boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_user_id uuid;
  v_ruolo text;
  v_ufficio uuid := p_ufficio_id;
  v_perm jsonb := '{"titoli":true,"sinistri":true,"trattative":true,"calendario":true,"contabilita":true,"rimesse":true,"ec_clienti":true,"chiusure":false,"report":true,"estrazioni":true,"anagrafiche":false,"tabelle_base":true,"agenzie":false,"uffici":false,"manutenzione":false,"documentale":true,"template":true,"provvigioni":true,"riceve_provvigioni":false,"pagamenti_provvigioni":false}'::jsonb;
BEGIN
  IF v_ufficio IS NULL AND NOT p_sede_only THEN
    v_ufficio := 'cdb3a9e1-2603-4147-819e-2bf5729c6731'::uuid;
  END IF;
  IF v_email IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_email LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated', v_email,
      crypt('Leone123!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nome', p_nome, 'cognome', p_cognome),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email', v_user_id::text, now(), now(), now()
    );
  END IF;

  SELECT ruolo INTO v_ruolo FROM public.profiles WHERE id = v_user_id;

  IF v_ruolo IS NULL THEN
    INSERT INTO public.profiles (
      id, nome, cognome, email, ruolo, ufficio_id, attivo, permessi_json,
      descrizione, telefono, fax, nome_rui, data_iscrizione_rui, numero_rui, sezione_rui,
      codice_contabile, iban
    ) VALUES (
      v_user_id, p_nome, p_cognome, v_email,
      CASE WHEN p_sede_only THEN 'ufficio' ELSE 'backoffice' END,
      CASE WHEN p_sede_only THEN p_ufficio_id ELSE v_ufficio END, true,
      CASE WHEN p_sede_only THEN null ELSE v_perm END,
      p_descrizione, nullif(p_telefono,''), nullif(p_fax,''),
      nullif(p_nome_rui,''), p_data_rui, nullif(p_num_rui,''), nullif(p_sez_rui,''),
      p_codice, nullif(p_iban,'')
    );
    IF NOT p_sede_only THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'backoffice')
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    UPDATE public.profiles SET
      codice_contabile = p_codice,
      descrizione = coalesce(nullif(p_descrizione,''), descrizione),
      telefono = coalesce(nullif(p_telefono,''), telefono),
      fax = coalesce(nullif(p_fax,''), fax),
      nome_rui = coalesce(nullif(p_nome_rui,''), nome_rui),
      data_iscrizione_rui = coalesce(p_data_rui, data_iscrizione_rui),
      numero_rui = coalesce(nullif(p_num_rui,''), numero_rui),
      sezione_rui = coalesce(nullif(p_sez_rui,''), sezione_rui),
      iban = coalesce(nullif(p_iban,''), iban),
      ufficio_id = coalesce(v_ufficio, ufficio_id),
      attivo = true,
      nome = CASE WHEN v_ruolo IN ('admin','cfo') THEN nome ELSE coalesce(nullif(p_nome,''), nome) END,
      cognome = CASE WHEN v_ruolo IN ('admin','cfo') THEN cognome ELSE coalesce(nullif(p_cognome,''), cognome) END,
      ruolo = CASE
        WHEN p_sede_only THEN v_ruolo
        WHEN v_ruolo IN ('admin','cfo','cliente','produttore','corrispondente') THEN v_ruolo
        ELSE 'backoffice'
      END,
      permessi_json = CASE
        WHEN p_sede_only OR v_ruolo IN ('admin','cfo') THEN permessi_json
        ELSE coalesce(permessi_json, v_perm)
      END
    WHERE id = v_user_id;

    IF NOT p_sede_only AND v_ruolo NOT IN ('admin','cfo','cliente') THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'backoffice')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF v_ufficio IS NOT NULL AND NOT p_sede_only THEN
    INSERT INTO public.profilo_sedi (profilo_id, ufficio_id, primaria)
    VALUES (v_user_id, v_ufficio, true)
    ON CONFLICT (profilo_id, ufficio_id) DO NOTHING;
  END IF;
END;
$$;

DO $$
BEGIN
  PERFORM public.import_specialist_excel_row('aguglielmini@consulbrokers.it', 'AG', 'Antonino', 'Guglielmini', 'GUGLIELMINI ANTONINO', 'cdb3a9e1-2603-4147-819e-2bf5729c6731'::uuid, '06 44172501', null, 'GUGLIELMINI ANTONINO', '2010-10-14', 'E000357187', 'E', 'IT62G0859704200000000603292', false);
  PERFORM public.import_specialist_excel_row('aperretti@consulbrokers.it', 'AP', 'Antonio', 'Perretti', 'PERRETTI ANTONIO', 'e4f0d1f5-e344-4920-b178-d8754904a108'::uuid, '097154732', '0971472686', 'PERRETTI ANTONIO', '2007-05-04', 'B000181634', 'B', null, false);
  PERFORM public.import_specialist_excel_row('aroberti@consulbrokers.it', 'AR', 'Agnese', 'Roberti', 'ROBERTI AGNESE', null, '097154732', '0971472686', 'AGNESE ROBERTI', null, null, null, null, false);
  PERFORM public.import_specialist_excel_row('aturco@consulbrokers.it', 'AT', 'Alida', 'Turco', 'TURCO ALIDA', 'd2c47452-4bb2-4b3b-8a24-a1606357e909'::uuid, null, null, null, null, null, null, 'IT62G0859704200000000603292', false);
  PERFORM public.import_specialist_excel_row('c.ballerini@confesercenti.fi.it', 'BC', 'Curzio', 'Ballerini', 'BALLERINI CURZIO', '85e3e5e8-06be-4eb0-b547-c9cc36a70008'::uuid, null, null, 'BALLERINI CURZIO', '2007-03-26', 'E000135816', 'E', 'IT62G0859704200000000603292', false);
  PERFORM public.import_specialist_excel_row('sedebergamo@consulbrokers.it', 'BG', 'Sede Bergamo', 'Sede', 'Sede Bergamo', 'd2d73996-a161-4a04-be84-260f6c514c23'::uuid, null, null, null, null, null, null, null, true);
  PERFORM public.import_specialist_excel_row('apavoni@consulbrokers.it', 'BG1', 'Aldo', 'Pavoni', 'PAVONI ALDO', 'd2d73996-a161-4a04-be84-260f6c514c23'::uuid, '035.230306', null, null, '2007-04-22', 'E000047766', 'E', null, false);
  PERFORM public.import_specialist_excel_row('a.cai@confesercenti.fi.it', 'CA', 'Angiolo', 'Cai', 'CAI ANGIOLO', '85e3e5e8-06be-4eb0-b547-c9cc36a70008'::uuid, null, null, 'CAI ANGIOLO', '2019-02-21', 'E000622244', 'E', null, false);
  PERFORM public.import_specialist_excel_row('specialist.cav@consulbrokers.it', 'CAV', '—', 'Cavs', 'CAVS', null, null, null, null, null, null, null, null, false);
  PERFORM public.import_specialist_excel_row('f.contessa@confesercenti.fi.it', 'CF', 'Fabrizio', 'Contessa', 'CONTESSA FABRIZIO', '85e3e5e8-06be-4eb0-b547-c9cc36a70008'::uuid, null, null, 'CONTESSA FABRIZIO', '2015-03-13', 'E000142167', 'E', null, false);
  PERFORM public.import_specialist_excel_row('adeodato@consulbrokers.it', 'DA', 'Deodato', 'Angela', 'Angela Deodato', '88cf938e-0f81-4fdc-96a8-f9048d08b91b'::uuid, '02 49534055', null, null, null, null, null, 'IT02Y0623002402000057338648', false);
  PERFORM public.import_specialist_excel_row('adipiazza@consulbrokers.it', 'DP', 'Alberto', 'Di Piazza', 'DI PIAZZA ALBERTO', '05727385-affb-4c21-80dd-1e218482307e'::uuid, null, null, null, null, null, null, null, false);
  PERFORM public.import_specialist_excel_row('ealbanese@consulbrokers.it', 'EA', 'Emilio', 'Albanese', 'ALBANESE EMILIO', 'd2d73996-a161-4a04-be84-260f6c514c23'::uuid, '035230306', '035225301', 'ALBANESE EMILIO', '2007-03-13', 'B000007307', 'B', null, false);
  PERFORM public.import_specialist_excel_row('fbartocci@consulbrokers.it', 'FB', 'Federico', 'Bartocci', 'BARTOCCI FEDERICO', 'cdb3a9e1-2603-4147-819e-2bf5729c6731'::uuid, '06 44172501', '06 8541149', 'BARTOCCI FEDERICO', '2010-10-14', 'E00035718', 'E', 'IT62G0859704200000000603292', false);
  PERFORM public.import_specialist_excel_row('fgpaparella@consulbrokers.it', 'FP', 'Francesco', 'Paparella', 'PAPARELLA FRANCESCO', 'cdb3a9e1-2603-4147-819e-2bf5729c6731'::uuid, '06 44172501', null, 'PAPARELLA FRANCESCO', '2007-04-16', 'B000164802', 'B', 'IT62G0859704200000000603292', false);
  PERFORM public.import_specialist_excel_row('segreteria@consulbrokers.it', 'G2', 'Giuliano', 'Ghiglieri', 'GHIGLIERI GIULIANO', 'f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a'::uuid, '0817648268', '0817648469', 'GHIGLIERI GIULIANO', '2014-06-09', 'E000491031', 'E', 'IT62G0859704200000000603292', false);
  PERFORM public.import_specialist_excel_row('aguarino@consulbrokers.it', 'GA', 'Mariadele', 'Guarino', 'GUARINO MARIADELE', '88cf938e-0f81-4fdc-96a8-f9048d08b91b'::uuid, '02 49234055', null, 'GUARINO MARIADELE', null, 'E000354024', 'E', 'IT02Y0623002402000057338648', false);
  PERFORM public.import_specialist_excel_row('specialist.ge@consulbrokers.it', 'GE', 'SEDE GENOVA', 'SEDE', 'SEDE GENOVA', '52f824ba-de02-4dbb-b1fd-a545424eaca2'::uuid, null, null, null, null, null, null, null, false);
  PERFORM public.import_specialist_excel_row('gguarracino@consulbrokers.it', 'GG', 'Gaetano', 'Guarracino', 'GUARRACINO GAETANO', 'f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a'::uuid, '081 7648268', '081 7648685', 'GUARRACINO GAETANO', '2014-06-19', 'E000492149', 'E', 'IT62G0859704200000000603292', false);
  PERFORM public.import_specialist_excel_row('glafiora@consulbrokers.it', 'GL', 'La Fiora', 'Gianluca', 'GIANLUCA LA FIORA', '05727385-affb-4c21-80dd-1e218482307e'::uuid, null, null, null, null, null, null, null, false);
  PERFORM public.import_specialist_excel_row('gestionemilano@consulbrokers.it', 'GM', 'Gestione Milano', 'Gestione', 'Gestione Milano', '88cf938e-0f81-4fdc-96a8-f9048d08b91b'::uuid, '02 49534055', null, null, null, null, null, null, false);
  PERFORM public.import_specialist_excel_row('consulbrokerssa@consulbrokers.it', 'GS', 'Gestione Salerno', 'Gestione', 'Gestione Salerno', '6153d82f-0e65-4862-81a0-52d438711640'::uuid, '348 3204012', '348 3204016', null, null, null, null, 'IT62G0859704200000000603292', false);
  PERFORM public.import_specialist_excel_row('itallini@consulbrokers.it', 'IT', 'Iole', 'Tallini', 'TALLINI IOLE', 'ebd881c6-cc52-4fbe-a423-2bf1f8498e5c'::uuid, '0874 438635', '0874 412079', 'TALLINI IOLE', '2011-11-14', 'E000397657', 'E', 'IT62G0859704200000000603292', false);
  PERFORM public.import_specialist_excel_row('specialist.le@consulbrokers.it', 'LE', 'Lorenzo', 'Esposito', 'ESPOSITO LORENZO', null, null, null, null, null, null, null, null, false);
  PERFORM public.import_specialist_excel_row('lferro@consulbrokers.it', 'LF', 'Ferro', 'Loredana', 'LOREDANA FERRO', 'ebd881c6-cc52-4fbe-a423-2bf1f8498e5c'::uuid, '0874 438635', '0874 412079', 'FERRO LOREDANA', '2010-06-15', 'E000344226', 'E', 'IT62G0859704200000000603292', false);
  PERFORM public.import_specialist_excel_row('lmelanitto@consulbrokers.it', 'LM', 'Luigi', 'Melanitto', 'MELANITTO LUIGI', null, '0874 438635', null, 'MELANITTO LUIGI', '2020-03-16', 'A000317602', 'A', null, false);
  PERFORM public.import_specialist_excel_row('mfiore@consulbrokers.it', 'MF', 'Maurizio', 'Fiore', 'FIORE MAURIZIO', null, '081 7648268', '081 7648685', 'Fiore Maurizio', '2007-05-11', 'B00018656', 'B', null, false);
  PERFORM public.import_specialist_excel_row('mderosa@consulbrokers.it', 'MG', 'Maria Grazia', 'Derosa', 'DEROSA MARIA GRAZIA', 'e4f0d1f5-e344-4920-b178-d8754904a108'::uuid, '0971 54732', '0971 472686', 'De Rosa Maria Grazia', '2010-09-14', 'E000354023', 'E', null, false);
  PERFORM public.import_specialist_excel_row('milano@consulbrokers.it', 'MI', 'SEDE MILANO', 'SEDE', 'SEDE MILANO', '88cf938e-0f81-4fdc-96a8-f9048d08b91b'::uuid, null, null, null, null, null, null, 'IT62G0859704200000000603292', true);
  PERFORM public.import_specialist_excel_row('mmagalli@consulbrokers.it', 'MM', 'Manuela', 'Magalli', 'MAGALLI MANUELA', 'cdb3a9e1-2603-4147-819e-2bf5729c6731'::uuid, '06 44172501', null, 'Magalli Manuela', '2007-04-22', 'B000169823', 'B', 'IT62G0859704200000000603292', false);
  PERFORM public.import_specialist_excel_row('ufficiopadova@consulbrokers.it', 'PD', 'Sede Padova', 'Sede', 'Sede Padova', 'ddd1d20f-9284-41bb-b49e-445817858722'::uuid, null, null, null, null, null, null, 'IT02Y0623002402000057338648', false);
  PERFORM public.import_specialist_excel_row('pfailla@consulbrokers.it', 'PF', 'Paolo', 'Failla', 'FAILLA PAOLO', 'f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a'::uuid, null, null, 'FAILLA PAOLO', '2007-02-19', 'E000074033', 'E', 'IT62G0859704200000000603292', false);
  PERFORM public.import_specialist_excel_row('pscarpelli@consulbrokers.it', 'PS', 'Paola', 'Scarpelli', 'SCARPELLI PAOLA', 'f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a'::uuid, '081 7648268', '081 7648685', 'Paola Scarpelli', '2010-09-14', 'E000354024', 'E', 'IT62G0859704200000000603292', false);
  PERFORM public.import_specialist_excel_row('gestionerm@consulbrokers.it', 'RM', 'Sede ROMA', 'Sede', 'Sede ROMA', 'cdb3a9e1-2603-4147-819e-2bf5729c6731'::uuid, '06 48903343', '06 48903343', null, null, null, null, 'IT62G0859704200000000603292', true);
  PERFORM public.import_specialist_excel_row('consulbrokersriskmanagementsa@consulbrokers.it', 'SA', 'Mario', 'Gedressi', 'GEDRESSI MARIO', '6153d82f-0e65-4862-81a0-52d438711640'::uuid, null, null, 'GEDRESSI MARIO', '2007-05-04', 'B000181632', 'B', 'IT62G0859704200000000603292', false);
  PERFORM public.import_specialist_excel_row('clurdo@consulbrokers.it', 'SP', 'Sede PARMA', 'Sede', 'Sede PARMA', 'a0d09b81-777d-43be-9615-e9d051786e2c'::uuid, null, null, null, null, null, null, 'IT16L0511601600000000003846', false);
  PERFORM public.import_specialist_excel_row('fgusmatti@consulbrokers.it', 'SSD', 'SEDE SAN', 'DONA'' DI PIAVE', 'SEDE SAN DONA'' DI PIAVE', '327e92f7-64f0-48b9-9e48-73611d8cb406'::uuid, '0421/307800', null, null, null, null, null, 'IT60B0200836282000101869818', false);
  PERFORM public.import_specialist_excel_row('specialist.z1@consulbrokers.it', 'Z1', 'Ufficio Cauzioni', 'Ufficio', 'Ufficio Cauzioni', null, null, null, null, null, null, null, null, false);
END;
$$;

DROP FUNCTION public.import_specialist_excel_row(
  text, text, text, text, text, uuid, text, text, text, date, text, text, text, boolean
);
