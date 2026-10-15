-- Demo ente pubblico — portale cliente (dati fittizi)
-- Credenziali: demo.ente@consulbrokers.it / Leone123! (edge seed-comune-roma-demo)
-- Esclusione report: numero_titolo NOT LIKE 'DEMO-RM-%' AND numero_sinistro NOT LIKE 'SIN-RM-%'

DO $$
DECLARE
  v_cliente uuid := 'e8f4a2b0-7c3d-4e1f-9a6b-2d4e8f1c0b5a';
  v_ufficio uuid;
  v_gf uuid;
  v_generali uuid;
  v_allianz uuid;
  v_lloyds uuid;
  v_nobis uuid;
  v_unipol uuid;
  v_ramo_rcp uuid := '7dc539de-9e42-4753-b05a-d60167c76aaf';
  v_ramo_property uuid := 'dbbd0609-d604-45a5-affb-c83d2d50913e';
  v_ramo_infortuni uuid := 'f3478e36-2d2a-4827-9a56-a059c826ce14';
  v_ramo_rca uuid := '21b2a2d6-9545-496a-9cb0-247674ba2a91';
  v_ramo_tg uuid := '993a51c3-ac45-4531-a80a-917b2dcc0d9d';
  v_ramo_cyber uuid := 'f479640c-7722-4700-8914-236fcb1ec9bb';
  v_ramo_rcto uuid := 'd9b03bc6-c566-4659-b28b-0e9c0ac56588';
  v_backoffice uuid;
  v_t1 uuid; v_t2 uuid; v_t3 uuid; v_t4 uuid; v_t5 uuid; v_t6 uuid; v_t7 uuid; v_t8 uuid; v_t14 uuid;
  v_pcga_ar uuid := 'f1a2b3c4-d5e6-4789-a012-3456789abcde';
  v_pcga_cy uuid := 'f1a2b3c4-d5e6-4789-a012-3456789abcdf';
  v_pcga_rc uuid := 'f1a2b3c4-d5e6-4789-a012-3456789abce0';
  v_prod_ar uuid := '85daceaa-aa44-4f54-8f93-28176172fc1e';
  v_prod_cy uuid := '6b4ce00b-f75c-4ede-8120-e8b8acefac9f';
  v_prod_rc uuid := '4cd397d6-3c6e-4890-83d6-7f218b783ffb';
  v_uso_ente uuid;
BEGIN
  SELECT id INTO v_ufficio FROM public.uffici WHERE attivo = true AND codice_ufficio = '009' LIMIT 1;
  IF v_ufficio IS NULL THEN
    SELECT id INTO v_ufficio FROM public.uffici WHERE attivo = true ORDER BY nome_ufficio LIMIT 1;
  END IF;

  SELECT id INTO v_gf FROM public.gruppi_finanziari WHERE codice = 'AZ_ENTE_DEMO' LIMIT 1;
  IF v_gf IS NULL THEN
    INSERT INTO public.gruppi_finanziari (codice, descrizione, attivo)
    VALUES ('AZ_ENTE_DEMO', '[DEMO] Enti pubblici presentazione', true)
    RETURNING id INTO v_gf;
  END IF;

  SELECT id INTO v_generali FROM public.compagnie WHERE attiva = true AND nome ILIKE '%GENERALI%' ORDER BY nome LIMIT 1;
  SELECT id INTO v_allianz FROM public.compagnie WHERE attiva = true AND nome ILIKE '%allianz%' ORDER BY nome LIMIT 1;
  SELECT id INTO v_unipol FROM public.compagnie WHERE attiva = true AND nome ILIKE '%UNIPOL%' ORDER BY nome LIMIT 1;
  SELECT id INTO v_nobis FROM public.compagnie
    WHERE attiva = true AND (nome ILIKE '%nobis%' OR nome ILIKE '%CHUBB%' OR nome ILIKE '%GROUPAMA%')
    ORDER BY nome LIMIT 1;
  SELECT id INTO v_lloyds FROM public.compagnie
    WHERE attiva = true AND (nome ILIKE '%lloyd%' OR nome ILIKE '%AIG%' OR nome ILIKE '%REVO%')
    ORDER BY nome LIMIT 1;
  IF v_nobis IS NULL THEN SELECT id INTO v_nobis FROM public.compagnie WHERE attiva = true LIMIT 1; END IF;
  IF v_lloyds IS NULL THEN
    SELECT id INTO v_lloyds FROM public.compagnie WHERE attiva = true AND id <> COALESCE(v_nobis, '00000000-0000-0000-0000-000000000000'::uuid) LIMIT 1;
  END IF;
  IF v_generali IS NULL OR v_allianz IS NULL THEN
    RAISE EXCEPTION 'Compagnie demo non trovate';
  END IF;
  IF v_unipol IS NULL THEN v_unipol := v_generali; END IF;

  SELECT id INTO v_uso_ente FROM public.rca_usi
  WHERE descrizione ILIKE '%Servizio Enti%' ORDER BY codice LIMIT 1;
  IF v_uso_ente IS NULL THEN
    SELECT id INTO v_uso_ente FROM public.rca_usi ORDER BY codice LIMIT 1;
  END IF;

  SELECT p.id INTO v_backoffice FROM public.profiles p
  WHERE p.ruolo IN ('ufficio', 'backoffice', 'admin') AND p.attivo IS NOT FALSE
  ORDER BY CASE WHEN p.ufficio_id = v_ufficio THEN 0 ELSE 1 END, p.created_at
  LIMIT 1;

  INSERT INTO public.clienti (
    id, tipo_cliente, tipo_persona, ragione_sociale,
    partita_iva, codice_fiscale_azienda, forma_giuridica,
    indirizzo_sede, cap_sede, citta_sede, provincia_sede, nazione,
    email, pec, telefono, codice_sdi,
    ufficio_id, gruppo_finanziario_id,
    attivo, stato_cliente, area_riservata_tipo,
    codice_ricerca, settore, note, num_dipendenti
  ) VALUES (
    v_cliente, 'ente', 'giuridica',
    'Comune Demo Roma Capitale',
    '80123456789', '80123456789', 'Ente Pubblico Territoriale',
    'Piazza del Campidoglio 1', '00186', 'Roma', 'RM', 'Italia',
    'demo.comune.roma@consulbrokers.it', 'demo.comune.roma@pec.demo.it', '06 0606', 'M5UXCR1',
    v_ufficio, v_gf,
    true, 'attivo', 'completa',
    'COMUNE_ROMA_DEMO', 'Pubblica Amministrazione locale',
    '[DEMO] Cliente fittizio per presentazioni area riservata a comuni/enti. Dati anonimizzati.',
    420
  )
  ON CONFLICT (id) DO UPDATE SET
    ragione_sociale = EXCLUDED.ragione_sociale,
    email = EXCLUDED.email,
    pec = EXCLUDED.pec,
    citta_sede = EXCLUDED.citta_sede,
    area_riservata_tipo = 'completa',
    note = EXCLUDED.note,
    attivo = true,
    updated_at = now();

  DELETE FROM public.nominativi_cliente WHERE cliente_id = v_cliente;
  INSERT INTO public.nominativi_cliente (cliente_id, nome, cognome, email, telefono, ruolo)
  VALUES
    (v_cliente, 'Laura', 'Bianchi', 'demo.comune.roma@consulbrokers.it', '06 0606 1201', 'Responsabile Assicurazioni'),
    (v_cliente, 'Marco', 'Verdi', 'risk.demo@pec.demo.it', '06 0606 1202', 'Ufficio Sinistri');

  IF v_backoffice IS NOT NULL THEN
    INSERT INTO public.codici_commerciali_cliente (cliente_id, profilo_id, ruolo, societa_brand, filiale)
    SELECT v_cliente, v_backoffice, 'Backoffice', 'Consulbrokers', 'Roma uno'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.codici_commerciali_cliente WHERE cliente_id = v_cliente AND profilo_id = v_backoffice
    );
  END IF;

  DELETE FROM public.titoli WHERE cliente_anagrafica_id = v_cliente AND numero_titolo LIKE 'DEMO-RM-%';

  INSERT INTO public.titoli (
    numero_titolo, cliente_anagrafica_id, ufficio_id, compagnia_id, ramo_id,
    premio_lordo, premio_netto, tasse, stato, descrizione_polizza, prodotto_nome,
    durata_da, durata_a, data_scadenza, garanzia_da, garanzia_a, periodicita, tipo_portafoglio, rate, note,
    cig_rif, tacito_rinnovo, libro_matricola
  )
  SELECT * FROM (VALUES
    ('DEMO-RM-2025-001', v_cliente, v_ufficio, v_lloyds, v_ramo_rcp,
      22400::numeric, 20400::numeric, 2000::numeric, 'incassato', 'RC Patrimoniale amministratori e dirigenti',
      'RC Patrimoniale Ente', '2025-01-01'::date, '2025-12-31'::date, '2025-12-31'::date, '2025-01-01'::date, '2025-12-31'::date, 'annuale', 'diretto', 1,
      '[DEMO] Polizza anonimizzata', NULL::text, true, NULL::text),
    ('DEMO-RM-2025-002', v_cliente, v_ufficio, v_nobis, v_ramo_rcto,
      31800::numeric, 28900::numeric, 2900::numeric, 'attivo', 'RCT/O verso terzi — servizi comunali',
      'RC Generale Enti Pubblici', '2025-01-01'::date, '2025-12-31'::date, '2025-12-31'::date, '2025-01-01'::date, '2025-12-31'::date, 'annuale', 'diretto', 1,
      '[DEMO] Polizza anonimizzata', 'B33772177C', true, NULL::text),
    ('DEMO-RM-2025-003', v_cliente, v_ufficio, v_allianz, v_ramo_property,
      48500::numeric, 44100::numeric, 4400::numeric, 'attivo', 'All Risks patrimonio — scuole, impianti sportivi, municipi',
      'All Risks Property', '2025-01-01'::date, '2025-12-31'::date, '2025-12-31'::date, '2025-01-01'::date, '2025-12-31'::date, 'annuale', 'diretto', 1,
      '[DEMO] Polizza anonimizzata', NULL::text, true, NULL::text),
    ('DEMO-RM-2025-004', v_cliente, v_ufficio, v_generali, v_ramo_infortuni,
      14200::numeric, 12900::numeric, 1300::numeric, 'attivo', 'Infortuni cumulativa dipendenti comunali',
      'Infortuni Dipendenti', '2025-01-01'::date, '2025-12-31'::date, '2025-12-31'::date, '2025-01-01'::date, '2025-12-31'::date, 'annuale', 'diretto', 1,
      '[DEMO] Polizza anonimizzata', NULL::text, true, NULL::text),
    ('DEMO-RM-2025-005', v_cliente, v_ufficio, v_unipol, v_ramo_rca,
      35600::numeric, 32400::numeric, 3200::numeric, 'attivo', 'RCA parco veicoli comunale (38 automezzi)',
      'Libro Matricola RCA', '2025-03-01'::date, '2026-02-28'::date, '2026-02-28'::date, '2025-03-01'::date, '2026-02-28'::date, 'annuale', 'diretto', 1,
      '[DEMO] Polizza anonimizzata', NULL::text, true, 'SI'),
    ('DEMO-RM-2025-006', v_cliente, v_ufficio, v_lloyds, v_ramo_tg,
      7200::numeric, 6500::numeric, 700::numeric, 'attivo', 'Tutela legale amministratori e uffici',
      'Tutela Giudiziaria', '2025-01-01'::date, '2025-12-31'::date, '2025-12-31'::date, '2025-01-01'::date, '2025-12-31'::date, 'annuale', 'diretto', 1,
      '[DEMO] Polizza anonimizzata', NULL::text, true, NULL::text),
    ('DEMO-RM-2025-007', v_cliente, v_ufficio, v_unipol, v_ramo_cyber,
      9800::numeric, 8900::numeric, 900::numeric, 'attivo', 'Cyber risk PA — servizi digitali e protocollo informatico',
      'Cyber Risk Enti Locali', '2025-01-01'::date, '2025-12-31'::date, '2025-12-31'::date, '2025-01-01'::date, '2025-12-31'::date, 'annuale', 'diretto', 1,
      '[DEMO] Polizza anonimizzata', NULL::text, true, NULL::text),
    ('DEMO-RM-2026-010', v_cliente, v_ufficio, v_allianz, v_ramo_property,
      51200::numeric, 46600::numeric, 4600::numeric, 'attivo', 'All Risks 2026 — patrimonio edifici pubblici',
      'All Risks Property', '2026-01-01'::date, '2026-12-31'::date, '2026-12-31'::date, '2026-01-01'::date, '2026-12-31'::date, 'annuale', 'diretto', 1,
      '[DEMO] Con PDF in area documenti', NULL::text, true, NULL::text),
    ('DEMO-RM-2026-011', v_cliente, v_ufficio, v_lloyds, v_ramo_tg,
      7800::numeric, 7100::numeric, 700::numeric, 'attivo', 'Tutela legale 2026',
      'Tutela Legale Enti', '2026-01-01'::date, '2026-12-31'::date, '2026-12-31'::date, '2026-01-01'::date, '2026-12-31'::date, 'annuale', 'diretto', 1,
      '[DEMO] Con PDF', NULL::text, true, NULL::text),
    ('DEMO-RM-2026-012', v_cliente, v_ufficio, v_unipol, v_ramo_cyber,
      10500::numeric, 9500::numeric, 1000::numeric, 'attivo', 'Cyber Risk 2026',
      'Cyber Risk PA', '2026-01-01'::date, '2026-12-31'::date, '2026-12-31'::date, '2026-01-01'::date, '2026-12-31'::date, 'annuale', 'diretto', 1,
      '[DEMO] Con PDF', NULL::text, true, NULL::text),
    ('DEMO-RM-2026-013', v_cliente, v_ufficio, v_nobis, v_ramo_rcto,
      33200::numeric, 30200::numeric, 3000::numeric, 'attivo', 'RCT/O 2026',
      'RC Generale Enti', '2026-01-01'::date, '2026-12-31'::date, '2026-12-31'::date, '2026-01-01'::date, '2026-12-31'::date, 'annuale', 'diretto', 1,
      '[DEMO] Con PDF', '9875689C5D', true, NULL::text),
    ('DEMO-RM-2026-014', v_cliente, v_ufficio, v_unipol, v_ramo_rca,
      36800::numeric, 33500::numeric, 3300::numeric, 'attivo', 'RCA parco veicoli 2026',
      'Libro Matricola RCA', '2026-03-01'::date, '2027-02-28'::date, '2027-02-28'::date, '2026-03-01'::date, '2027-02-28'::date, 'annuale', 'diretto', 1,
      '[DEMO] Con PDF', NULL::text, true, 'SI')
  ) AS v(numero_titolo, cliente_anagrafica_id, ufficio_id, compagnia_id, ramo_id,
         premio_lordo, premio_netto, tasse, stato, descrizione_polizza, prodotto_nome,
         durata_da, durata_a, data_scadenza, garanzia_da, garanzia_a, periodicita, tipo_portafoglio, rate, note,
         cig_rif, tacito_rinnovo, libro_matricola);

  SELECT id INTO v_t1 FROM public.titoli WHERE numero_titolo = 'DEMO-RM-2025-001' AND cliente_anagrafica_id = v_cliente;
  SELECT id INTO v_t2 FROM public.titoli WHERE numero_titolo = 'DEMO-RM-2025-002' AND cliente_anagrafica_id = v_cliente;
  SELECT id INTO v_t3 FROM public.titoli WHERE numero_titolo = 'DEMO-RM-2025-003' AND cliente_anagrafica_id = v_cliente;
  SELECT id INTO v_t4 FROM public.titoli WHERE numero_titolo = 'DEMO-RM-2025-004' AND cliente_anagrafica_id = v_cliente;
  SELECT id INTO v_t5 FROM public.titoli WHERE numero_titolo = 'DEMO-RM-2025-005' AND cliente_anagrafica_id = v_cliente;
  SELECT id INTO v_t6 FROM public.titoli WHERE numero_titolo = 'DEMO-RM-2025-006' AND cliente_anagrafica_id = v_cliente;
  SELECT id INTO v_t7 FROM public.titoli WHERE numero_titolo = 'DEMO-RM-2025-007' AND cliente_anagrafica_id = v_cliente;
  SELECT id INTO v_t8 FROM public.titoli WHERE numero_titolo = 'DEMO-RM-2026-010' AND cliente_anagrafica_id = v_cliente;
  SELECT id INTO v_t14 FROM public.titoli WHERE numero_titolo = 'DEMO-RM-2026-014' AND cliente_anagrafica_id = v_cliente;

  DELETE FROM public.libro_matricola_mezzi WHERE titolo_id IN (
    SELECT id FROM public.titoli WHERE cliente_anagrafica_id = v_cliente AND numero_titolo LIKE 'DEMO-RM-%'
  );
  DELETE FROM public.veicoli_polizza WHERE titolo_id IN (
    SELECT id FROM public.titoli WHERE cliente_anagrafica_id = v_cliente AND numero_titolo LIKE 'DEMO-RM-%'
  );

  IF v_t5 IS NOT NULL THEN
    INSERT INTO public.libro_matricola_mezzi (titolo_id, n_progressivo, targa, tipologia, descrizione, uso, uso_id, data_inclusione)
    VALUES
      (v_t5, 1, 'RM100AA', 'Autocarro leggero', 'FIAT Doblò — servizio comunale', 'Servizio Enti', v_uso_ente, '2025-03-01'),
      (v_t5, 2, 'RM101BB', 'Furgone', 'IVECO Daily — manutenzione verde', 'Servizio Enti', v_uso_ente, '2025-03-01'),
      (v_t5, 3, 'RM102CC', 'Autovettura elettrica', 'NISSAN Leaf — ufficio tecnico', 'Servizio Enti', v_uso_ente, '2025-03-01'),
      (v_t5, 4, 'RM103DD', 'Autovettura', 'FIAT 500 — polizia locale', 'Servizio Enti', v_uso_ente, '2025-03-01'),
      (v_t5, 5, 'RM104EE', 'Minibus', 'OPEL Movano — trasporto scolastico', 'Servizio Enti', v_uso_ente, '2025-03-01');
    INSERT INTO public.veicoli_polizza (titolo_id, targa, marca, modello, tipo_veicolo, uso, provincia_circolazione, veicolo_descrizione)
    VALUES (v_t5, 'RM100AA', 'FIAT', 'Doblò', 'Autocarro leggero', v_uso_ente, 'RM', 'Capofila parco veicoli demo');
  END IF;
  IF v_t14 IS NOT NULL THEN
    INSERT INTO public.libro_matricola_mezzi (titolo_id, n_progressivo, targa, tipologia, descrizione, uso, uso_id, data_inclusione)
    VALUES
      (v_t14, 1, 'RM200AA', 'Autovettura', 'FIAT Tipo — servizi sociali', 'Servizio Enti', v_uso_ente, '2026-03-01'),
      (v_t14, 2, 'RM201BB', 'Furgone', 'RENAULT Master — logistica', 'Servizio Enti', v_uso_ente, '2026-03-01'),
      (v_t14, 3, 'RM202CC', 'Autocarro leggero', 'ISUZU — raccolta rifiuti', 'Servizio Enti', v_uso_ente, '2026-03-01');
  END IF;

  DELETE FROM public.sinistri WHERE cliente_anagrafica_id = v_cliente AND numero_sinistro LIKE 'SIN-RM-%';

  INSERT INTO public.sinistri (
    numero_sinistro, cliente_anagrafica_id, ufficio_id, compagnia_id, titolo_id,
    stato, tipo_sinistro, ramo_sinistro, descrizione, dinamica,
    data_evento, data_apertura, data_denuncia,
    indirizzo_sinistro, luogo_sinistro, citta_sinistro, provincia_sinistro, cap_sinistro,
    lat, lng, reparto,
    controparte, importo_riserva, importo_liquidato, costo_preventivato,
    numero_sinistro_compagnia, note_perito, data_chiusura, targa_veicolo
  ) VALUES
    ('SIN-RM-2025-001', v_cliente, v_ufficio, v_lloyds, v_t1,
      'aperto', 'RC Patrimoniale', 'RC Patrimoniale',
      'Contenzioso su delibera di esclusione da gara servizi',
      'Ricorso TAR Lazio da ditta aggiudicataria — contestazione legittimità procedura.',
      '2025-04-08', '2025-04-10', '2025-04-12',
      'Piazza del Campidoglio 1', 'Palazzo Senatorio — Ufficio Gare', 'Roma', 'RM', '00186',
      41.8931, 12.4828, 'Ufficio Gare e Appalti',
      'Ditta Alfa Servizi S.r.l.', 28000, 0, 32000, 'LL-RM-2025-001', '[DEMO] Perizia legale in corso', NULL, NULL),
    ('SIN-RM-2025-002', v_cliente, v_ufficio, v_generali, v_t4,
      'chiuso', 'Infortunio', 'Infortuni',
      'Infortunio dipendente ufficio anagrafe',
      'Scivolamento su pavimento bagnato — contusione ginocchio, prognosi 28 giorni.',
      '2025-02-18', '2025-02-19', '2025-02-20',
      'Via del Campidoglio 46', 'Municipio I — Anagrafe', 'Roma', 'RM', '00186',
      41.8945, 12.4809, 'Anagrafe e Stato Civile',
      NULL, 0, 4100, 4800, 'GEN-RM-2025-002', '[DEMO] Liquidato', '2025-06-01', NULL),
    ('SIN-RM-2025-003', v_cliente, v_ufficio, v_allianz, v_t3,
      'in_lavorazione', 'Danni da acqua', 'Property',
      'Allagamento palestra scuola elementare',
      'Rottura tubazione notturna — danni pavimento e impianto elettrico.',
      '2025-06-22', '2025-06-23', '2025-06-24',
      'Via Cristoforo Colombo 44', 'Scuola Primaria Demo — Palestra', 'Roma', 'RM', '00147',
      41.8356, 12.4712, 'Istruzione',
      NULL, 0, 0, 22000, 'AZ-RM-2025-003', '[DEMO] Perito edile incaricato', NULL, NULL),
    ('SIN-RM-2025-004', v_cliente, v_ufficio, v_unipol, v_t5,
      'aperto', 'Sinistro Stradale', 'RC Auto',
      'Collisione automezzo comunale in incrocio',
      'Tamponamento a semaforo — danni anteriori furgone RM101BB.',
      '2025-09-03', '2025-09-04', '2025-09-05',
      'Viale Tiburtina 1020', 'Incrocio con Via di Pietralata', 'Roma', 'RM', '00156',
      41.9109, 12.5344, 'Manutenzione Verde',
      'Sig. Paolo Neri — FIAT Panda GH789KL', 0, 0, 8500, 'UNI-RM-2025-004', '[DEMO] Constatazione amichevole', NULL, 'RM101BB'),
    ('SIN-RM-2025-005', v_cliente, v_ufficio, v_nobis, v_t2,
      'aperto', 'RC Terzi', 'RCT/O',
      'Caduta ciclista su marciapiede in cantiere',
      'Passante ferito per segnaletica insufficiente — riserva aperta.',
      '2025-07-14', '2025-07-15', '2025-07-16',
      'Lungotevere dei Mellini 12', 'Cantiere manutenzione marciapiede', 'Roma', 'RM', '00186',
      41.9028, 12.4663, 'Lavori Pubblici',
      'Sig.ra Elena Russo', 15000, 0, 18000, 'NB-RM-2025-005', '[DEMO] Attesa referti', NULL, NULL),
    ('SIN-RM-2025-006', v_cliente, v_ufficio, v_unipol, v_t7,
      'chiuso', 'Cyber', 'Cyber',
      'Tentativo phishing su caselle PEC comunali',
      'Individuato accesso anomalo — nessun dato esfiltrato, intervento CERT.',
      '2025-03-05', '2025-03-06', '2025-03-07',
      'Via dei Fori Imperiali 1', 'Data Center Comunale', 'Roma', 'RM', '00186',
      41.8925, 12.4892, 'Sistemi Informativi',
      'Ignoti', 0, 6200, 7500, 'CY-RM-2025-006', '[DEMO] Chiuso con indennizzo spese', '2025-05-10', NULL),
    ('SIN-RM-2026-007', v_cliente, v_ufficio, v_allianz, v_t3,
      'aperto', 'Furto', 'Property',
      'Furto attrezzature cantiere verde pubblico',
      'Sottrazione decespugliatrici da deposito recintato.',
      '2026-01-20', '2026-01-21', '2026-01-22',
      'Via di Villa Borghese 45', 'Deposito attrezzi — Villa Borghese', 'Roma', 'RM', '00197',
      41.9142, 12.4922, 'Verde Pubblico',
      'Ignoti', 0, 0, 9800, 'AZ-RM-2026-007', '[DEMO] Denuncia Carabinieri', NULL, NULL);

  DELETE FROM public.documenti
  WHERE (entita_tipo = 'cliente' AND entita_id = v_cliente AND path_storage LIKE '%/demo-comune-roma/%')
     OR (entita_tipo = 'sinistro' AND path_storage LIKE '%/demo-comune-roma/%');

  INSERT INTO public.documenti (entita_tipo, entita_id, nome_file, path_storage, bucket_name, categoria, visibile_al_cliente)
  VALUES
    ('cliente', v_cliente, 'Polizza_All_Risks_Demo.pdf', v_cliente || '/demo-comune-roma/polizza_all_risks.pdf', 'documenti_clienti', 'polizza', true),
    ('cliente', v_cliente, 'Polizza_RCT-O_Demo.pdf', v_cliente || '/demo-comune-roma/polizza_rcto.pdf', 'documenti_clienti', 'polizza', true),
    ('cliente', v_cliente, 'Quietanza_RC_Patrimoniale.pdf', v_cliente || '/demo-comune-roma/quietanza_rcp.pdf', 'documenti_clienti', 'quietanza', true),
    ('cliente', v_cliente, 'Modulo_Privacy_GDPA_Ente.pdf', v_cliente || '/demo-comune-roma/privacy_gdpr.pdf', 'documenti_clienti', 'privacy', true),
    ('cliente', v_cliente, 'Circolare_Premi_2026_Demo.pdf', v_cliente || '/demo-comune-roma/circolare_2026.pdf', 'documenti_clienti', 'comunicazione', true);

  INSERT INTO public.documenti (entita_tipo, entita_id, nome_file, path_storage, bucket_name, categoria, visibile_al_cliente)
  SELECT 'sinistro', s.id, 'Denuncia_' || s.numero_sinistro || '.pdf',
    v_cliente || '/demo-comune-roma/sinistri/' || s.numero_sinistro || '_denuncia.pdf',
    'documenti_clienti', 'sinistro', true
  FROM public.sinistri s
  WHERE s.cliente_anagrafica_id = v_cliente AND s.numero_sinistro LIKE 'SIN-RM-%';

  -- Polizze CGA per assistente IA (prodotti catalogo anonimizzati)
  DELETE FROM public.polizza_garanzie_personali WHERE polizza_cga_id IN (
    SELECT id FROM public.polizza_cga WHERE cliente_id = v_cliente AND numero_polizza LIKE 'DEMO-RM-CGA-%'
  );
  DELETE FROM public.polizza_cga_premio_garanzia WHERE polizza_cga_id IN (
    SELECT id FROM public.polizza_cga WHERE cliente_id = v_cliente AND numero_polizza LIKE 'DEMO-RM-CGA-%'
  );
  DELETE FROM public.polizza_cga WHERE cliente_id = v_cliente AND numero_polizza LIKE 'DEMO-RM-CGA-%';

  INSERT INTO public.polizza_cga (
    id, cliente_id, titolo_id, prodotto_id, numero_polizza, stato,
    data_decorrenza, data_scadenza, frazionamento,
    premio_lordo_totale, premio_imponibile_totale, premio_imposte_totale,
    contraente_ragione_sociale, contraente_indirizzo, contraente_comune, contraente_provincia, contraente_cap, contraente_piva,
    sommario_personalizzato, approvato_at, cig
  ) VALUES
    (v_pcga_ar, v_cliente, v_t8, v_prod_ar, 'DEMO-RM-CGA-010', 'approvato',
      '2026-01-01', '2026-12-31', 'annuale', 51200, 46600, 4600,
      'Comune Demo Roma Capitale', 'Piazza del Campidoglio 1', 'Roma', 'RM', '00186', '80123456789',
      '[DEMO] Copertura All Risks su edifici comunali, scuole e impianti sportivi. Massimale aggregato € 25.000.000. Franchigia € 2.500 per sinistro. Esclusi danni da guerra e usura normale.',
      now(), NULL),
    (v_pcga_cy, v_cliente, v_t7, v_prod_cy, 'DEMO-RM-CGA-007', 'approvato',
      '2025-01-01', '2025-12-31', 'annuale', 9800, 8900, 900,
      'Comune Demo Roma Capitale', 'Piazza del Campidoglio 1', 'Roma', 'RM', '00186', '80123456789',
      '[DEMO] Cyber risk PA: risposta incidenti, ripristino dati, notifica Garante Privacy, assistenza legale fino € 50.000. Massimale sinistro cyber € 500.000.',
      now(), NULL),
    (v_pcga_rc, v_cliente, v_t1, v_prod_rc, 'DEMO-RM-CGA-001', 'approvato',
      '2025-01-01', '2025-12-31', 'annuale', 22400, 20400, 2000,
      'Comune Demo Roma Capitale', 'Piazza del Campidoglio 1', 'Roma', 'RM', '00186', '80123456789',
      '[DEMO] RC patrimoniale amministratori: massimale € 1.500.000 per sinistro e € 3.000.000 annuo. Copertura atti amministrativi, gare, contenzioso TAR. Franchigia € 5.000.',
      now(), NULL);

  INSERT INTO public.polizza_garanzie_personali (polizza_cga_id, prodotto_garanzia_id, massimale_personalizzato, franchigia_personalizzata, note_personali)
  SELECT v_pcga_ar, g.id, g.massimale_standard, g.franchigia_standard, '[DEMO] ' || COALESCE(g.garanzia, 'Garanzia')
  FROM public.prodotti_garanzie g WHERE g.prodotto_id = v_prod_ar;

  INSERT INTO public.polizza_garanzie_personali (polizza_cga_id, prodotto_garanzia_id, massimale_personalizzato, franchigia_personalizzata, note_personali)
  SELECT v_pcga_cy, g.id, g.massimale_standard, g.franchigia_standard, '[DEMO] ' || COALESCE(g.garanzia, 'Garanzia')
  FROM public.prodotti_garanzie g WHERE g.prodotto_id = v_prod_cy;

  INSERT INTO public.polizza_garanzie_personali (polizza_cga_id, prodotto_garanzia_id, massimale_personalizzato, franchigia_personalizzata, note_personali)
  SELECT v_pcga_rc, g.id, g.massimale_standard, g.franchigia_standard, '[DEMO] ' || COALESCE(g.garanzia, 'Garanzia')
  FROM public.prodotti_garanzie g WHERE g.prodotto_id = v_prod_rc;

END $$;
