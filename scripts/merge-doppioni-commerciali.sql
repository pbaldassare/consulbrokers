-- Merge doppioni produttori (corrispondente) e account executive.
-- NON cancella anagrafiche, titoli, clienti, split, provvigioni.
-- Ripunta le FK sul master e archivia il doppione (attivo=false + nota).

BEGIN;

CREATE TEMP TABLE merge_pairs (
  persona text NOT NULL,
  tipo text NOT NULL,
  master uuid NOT NULL,
  dup uuid NOT NULL
);

INSERT INTO merge_pairs (persona, tipo, master, dup) VALUES
  ('MASSARO GIORGIO', 'account_executive', 'e6fa1d1a-4f3e-47e8-b414-80964dd31baf', 'e4597d58-d389-4a51-ac26-c44f9ade309e'),
  ('PAVONI ALDO', 'corrispondente', '2bfd0bea-d8a8-4f86-8657-ce012e083c1e', 'a85be310-a24a-4a98-87c3-3a1dc360ab1e'),
  ('CANOVA/PIROVANO', 'corrispondente', '4968e2bb-58cf-4ed6-944d-c1e52d243079', 'ebb6131a-b6a9-4bc6-a1d3-3185461a50aa'),
  ('GENTILE FLORIANA', 'corrispondente', 'e158d9f7-b1f0-45d4-8e03-250d386ffe59', 'c092b8f0-4a91-4569-bfba-bb87ac470e01'),
  ('RICCI ANGELO', 'corrispondente', '4273df57-62c8-461f-a63e-82cc7828e610', '493586bd-72f4-4a4b-b5e0-e73abb8b903a'),
  ('MELANITTO LUIGI', 'corrispondente', '4117617d-2ab0-4a6e-8e77-b90d96c67a94', '2182ad3c-89d3-42d4-9af5-a72f560ecf9e'),
  ('DIAFERIA DANIELE', 'corrispondente', '16b21d06-65be-44b7-991e-9df96e16efd0', 'e482afae-821f-4674-b1c1-21557d98eb7a'),
  ('RONDINELLA SALVATORE', 'corrispondente', 'ffbe7308-271d-4136-950f-e2a0d2481263', '41414ae2-f0c8-43a5-b3a5-5a800a542f9c'),
  ('BALLERINI CURZIO', 'corrispondente', '50124415-2c08-4bcd-a0ce-e43cd9683771', '86d58d64-a814-4c60-b73f-eb2799964636'),
  ('AMATO ALFREDO', 'corrispondente', 'dad5ebd3-5e94-4128-89bf-92aa31bb2000', '0eabbfe0-247f-4541-a1ab-a8109c8de24c'),
  ('ARMANETTI ILARIA', 'corrispondente', '70e36a6f-5614-41b3-9c27-f35ca15d84c2', 'fdb4b6b6-753e-4d05-a298-bd55ad02103d'),
  ('CARADONIO MICHELE', 'corrispondente', '8e617746-7d72-45d4-aef4-4f0181c28625', '53c0e193-ad3c-412c-9fd3-482bddb01ceb'),
  ('ALBANESE EMILIO', 'corrispondente', '5d3e513e-f478-4cc7-9b4c-4df8f27774da', 'c6183005-e956-46e3-a6b9-2de89285a62b'),
  ('ALBERTI ALESSANDRO', 'corrispondente', '50a7173f-fb09-4fcb-af00-a9e863c24e87', 'a4075fe0-622a-400a-9e49-a661c02c2730'),
  ('ALBERTONI PAOLA', 'corrispondente', 'dcf07e0c-9020-47e2-87ac-c47b6d86cd93', '3f4aa65d-50e1-4924-8e40-4b47b606600e'),
  ('CIRELLI', 'corrispondente', '13ebf15d-e7b1-4054-9497-63b761c61d4a', '74ee76d1-1b00-4831-b04a-1b5da854c4de'),
  ('DEL GIUDICE GIULIO', 'corrispondente', '9d8d72c3-a38f-4d8d-9a60-3b4b6787faf3', '82d40b6b-b142-432d-b046-9a370f42412f'),
  ('FCV BROKER SRL', 'corrispondente', '232c4f27-9a45-41b2-a321-63ef2ba4a723', '2b17eaf4-e52f-494c-8b0e-cd2c7d463c52'),
  ('G.P.B. CONSULTING S.A.S.', 'corrispondente', '6a5e16f0-6c24-4ec9-a291-b3cc84886e37', '7c02fc4c-45fc-4d67-81c4-3417dd8535d5'),
  ('GEDRESSI MARIO', 'corrispondente', '2fc08fdc-db80-46cf-8a93-6668a1f772eb', '90514aff-05c4-4b6f-9b5c-b08cee100430'),
  ('GENNARI GIANPIERO', 'corrispondente', '2b2b2a4f-73e6-4571-b798-a5a24d97ecdd', '7eb0fa6d-7aa4-47be-b686-9747a9bbcdb4'),
  ('IMPRESA FACILE SRL', 'corrispondente', 'da8be89f-4632-47bd-9b19-31fcfa5c4491', 'f761a810-7019-42a1-be95-92bf4ea289c4'),
  ('RUSSO ANTONIO', 'corrispondente', 'f029aed6-8b43-4e6a-8450-33a1d7211a1a', '9a4ca973-aefc-481e-8db9-7abd0d63cb8d'),
  ('ZANOTTI MARIO', 'corrispondente', '7383483e-2424-4eff-8171-2fb3cba37cfe', '0d16c3c8-3cc7-43fc-946e-753ed275e576');

DO $$
DECLARE
  r record;
  junk constant text[] := ARRAY['XXXXXX', 'N/A', '-', 'X', '.'];
  v_txt text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM merge_pairs p
    JOIN anagrafiche_professionali m ON m.id = p.master
    JOIN anagrafiche_professionali d ON d.id = p.dup
    WHERE m.tipo IS DISTINCT FROM p.tipo OR d.tipo IS DISTINCT FROM p.tipo
  ) THEN
    RAISE EXCEPTION 'tipo master/doppione non coincide con la coppia';
  END IF;

  FOR r IN SELECT * FROM merge_pairs LOOP
    UPDATE anagrafiche_professionali m
    SET
      nome = COALESCE(NULLIF(btrim(m.nome), ''), NULLIF(btrim(d.nome), '')),
      cognome = CASE
        WHEN NULLIF(btrim(m.cognome), '') IS NOT NULL THEN m.cognome
        WHEN upper(btrim(coalesce(d.cognome, ''))) = ANY (junk) THEN m.cognome
        ELSE NULLIF(btrim(d.cognome), '')
      END,
      ragione_sociale = COALESCE(NULLIF(btrim(m.ragione_sociale), ''), NULLIF(btrim(d.ragione_sociale), '')),
      codice_fiscale = COALESCE(NULLIF(btrim(m.codice_fiscale), ''), NULLIF(btrim(d.codice_fiscale), '')),
      partita_iva = COALESCE(NULLIF(btrim(m.partita_iva), ''), NULLIF(btrim(d.partita_iva), '')),
      email = COALESCE(NULLIF(btrim(m.email), ''), NULLIF(btrim(d.email), '')),
      pec = COALESCE(NULLIF(btrim(m.pec), ''), NULLIF(btrim(d.pec), '')),
      telefono = COALESCE(NULLIF(btrim(m.telefono), ''), NULLIF(btrim(d.telefono), '')),
      cellulare = COALESCE(NULLIF(btrim(m.cellulare), ''), NULLIF(btrim(d.cellulare), '')),
      fax = COALESCE(NULLIF(btrim(m.fax), ''), NULLIF(btrim(d.fax), '')),
      indirizzo = COALESCE(NULLIF(btrim(m.indirizzo), ''), NULLIF(btrim(d.indirizzo), '')),
      cap = COALESCE(NULLIF(btrim(m.cap), ''), NULLIF(btrim(d.cap), '')),
      citta = COALESCE(NULLIF(btrim(m.citta), ''), NULLIF(btrim(d.citta), '')),
      provincia = COALESCE(NULLIF(btrim(m.provincia), ''), NULLIF(btrim(d.provincia), '')),
      codice = COALESCE(NULLIF(btrim(m.codice), ''), NULLIF(btrim(d.codice), '')),
      nome_breve = COALESCE(NULLIF(btrim(m.nome_breve), ''), NULLIF(btrim(d.nome_breve), '')),
      referente_nome = COALESCE(NULLIF(btrim(m.referente_nome), ''), NULLIF(btrim(d.referente_nome), '')),
      referente_email = COALESCE(NULLIF(btrim(m.referente_email), ''), NULLIF(btrim(d.referente_email), '')),
      studio_ufficio = COALESCE(NULLIF(btrim(m.studio_ufficio), ''), NULLIF(btrim(d.studio_ufficio), '')),
      sigla = COALESCE(NULLIF(btrim(m.sigla), ''), NULLIF(btrim(d.sigla), '')),
      banca_riga1 = COALESCE(NULLIF(btrim(m.banca_riga1), ''), NULLIF(btrim(d.banca_riga1), '')),
      banca_riga2 = COALESCE(NULLIF(btrim(m.banca_riga2), ''), NULLIF(btrim(d.banca_riga2), '')),
      banca_riga3 = COALESCE(NULLIF(btrim(m.banca_riga3), ''), NULLIF(btrim(d.banca_riga3), '')),
      nome_rui = COALESCE(NULLIF(btrim(m.nome_rui), ''), NULLIF(btrim(d.nome_rui), '')),
      iscrizione_rui = COALESCE(NULLIF(btrim(m.iscrizione_rui), ''), NULLIF(btrim(d.iscrizione_rui), '')),
      numero_rui = COALESCE(NULLIF(btrim(m.numero_rui), ''), NULLIF(btrim(d.numero_rui), '')),
      sezione_rui = COALESCE(NULLIF(btrim(m.sezione_rui), ''), NULLIF(btrim(d.sezione_rui), '')),
      codice_fornitore = COALESCE(NULLIF(btrim(m.codice_fornitore), ''), NULLIF(btrim(d.codice_fornitore), '')),
      abi = COALESCE(NULLIF(btrim(m.abi), ''), NULLIF(btrim(d.abi), '')),
      cab = COALESCE(NULLIF(btrim(m.cab), ''), NULLIF(btrim(d.cab), '')),
      iban = COALESCE(NULLIF(btrim(m.iban), ''), NULLIF(btrim(d.iban), '')),
      intestatario_cc = COALESCE(NULLIF(btrim(m.intestatario_cc), ''), NULLIF(btrim(d.intestatario_cc), '')),
      percentuale_base = COALESCE(m.percentuale_base, d.percentuale_base),
      percentuale_ra = COALESCE(m.percentuale_ra, d.percentuale_ra),
      percentuale_consulenza = COALESCE(m.percentuale_consulenza, d.percentuale_consulenza),
      data_iscrizione_rui = COALESCE(m.data_iscrizione_rui, d.data_iscrizione_rui),
      trattenuta_provvigioni_incasso = COALESCE(m.trattenuta_provvigioni_incasso, d.trattenuta_provvigioni_incasso),
      ufficio_id = COALESCE(m.ufficio_id, d.ufficio_id),
      note = NULLIF(btrim(concat_ws(E'\n', NULLIF(btrim(m.note), ''),
        format('Unito da doppione %s il 2026-09-25. Scheda %s non cancellata.', r.persona, r.dup))), '')
    FROM anagrafiche_professionali d
    WHERE m.id = r.master AND d.id = r.dup;

    UPDATE titoli SET anagrafica_commerciale_id = r.master WHERE anagrafica_commerciale_id = r.dup;
    UPDATE titoli SET ae_anagrafica_id = r.master WHERE ae_anagrafica_id = r.dup;
    UPDATE titoli_split_commerciali SET anagrafica_commerciale_id = r.master WHERE anagrafica_commerciale_id = r.dup;
    UPDATE titoli_modalita_incasso SET anagrafica_commerciale_id = r.master WHERE anagrafica_commerciale_id = r.dup;
    UPDATE clienti_intermediari_default SET anagrafica_commerciale_id = r.master WHERE anagrafica_commerciale_id = r.dup;
    UPDATE codici_commerciali_cliente SET anagrafica_id = r.master WHERE anagrafica_id = r.dup;
    UPDATE produttori_provvigioni_ramo SET anagrafica_id = r.master WHERE anagrafica_id = r.dup;
    UPDATE provvigioni_generate SET anagrafica_commerciale_id = r.master WHERE anagrafica_commerciale_id = r.dup;
    UPDATE polizze SET anagrafica_commerciale_id = r.master WHERE anagrafica_commerciale_id = r.dup;
    UPDATE polizze SET produttore_anagrafica_id = r.master WHERE produttore_anagrafica_id = r.dup;
    UPDATE polizze SET account_executive_anagrafica_id = r.master WHERE account_executive_anagrafica_id = r.dup;
    UPDATE fornitori SET anagrafica_professionale_id = r.master WHERE anagrafica_professionale_id = r.dup;

    v_txt := format(
      'Unito in %s (%s) il 2026-09-25. Scheda non cancellata; polizze e clienti ripuntati sul master.',
      r.master, r.persona
    );
    UPDATE anagrafiche_professionali
    SET attivo = false,
        note = NULLIF(btrim(concat_ws(E'\n', NULLIF(btrim(note), ''), v_txt)), '')
    WHERE id = r.dup;
  END LOOP;
END $$;

COMMIT;
