-- Allineamento portafoglio ROMA 2 EXE: corrispondenza tra i codici rischio EXE
-- (Tabella rischi-rami del 05/03/2026) e i nostri sottorami (public.rami).
-- 1) nuovi sottorami senza corrispondenza, 2) riattivazione QG, 3) tabella di mappa.
-- Il rischio 19 TELETTRA è escluso di proposito.

-- 1) Nuovi sottorami (aliquote copiate dai sottorami dello stesso ramo)
INSERT INTO public.rami (codice, descrizione, gruppo_ramo_id, attivo, aliquota_tasse_ramo, aliquota_tasse_ard, ssn_attivo, escludi_provvigioni, diritti_agenzia)
SELECT v.codice, v.descrizione, g.id, true, v.tasse, v.ard, false, false, false
FROM (VALUES
  ('RU',  'UNIT LINKED',                    'ZV',  2.5,   2.5),
  ('RPP', 'PIP - PIANO PENSIONISTICO',      'ZV',  2.5,   2.5),
  ('LTB', 'GLOBALE ALBERGHI',               'ZL', 22.25, 22.25),
  ('LTC', 'GLOBALE ESERCIZI',               'ZL', 22.25, 22.25),
  ('IF',  'INFEDELTA'' DIPENDENTI',         'ZL', 22.25, 22.25),
  ('LX',  'CRISTALLI E VETRI',              'ZL', 22.25, 22.25),
  ('FL',  'ALOP - ADVANCE LOSS OF PROFIT',  'ZL', 22.25, 22.25),
  ('CPI', 'PERDITA D''IMPIEGO',             'ZC', 12.5,  12.5),
  ('NIC', 'INFORTUNI COMPLEMENTARE',        'ZN',  2.5,   2.5),
  ('PCC', 'R.C. CACCIA',                    'ZP', 22.25, 22.25),
  ('PMB', 'R.C. INDUSTRIALE',               'ZP', 22.25, 22.25),
  ('FLM', 'PRODUZIONI CINEMATOGRAFICHE',    'ZY', 22.5,   0),
  ('BST', 'BESTIAME / CAVALLI',             'ZY', 22.5,   0)
) AS v(codice, descrizione, gruppo, tasse, ard)
JOIN public.gruppi_ramo g ON g.codice = v.gruppo
ON CONFLICT (codice) DO NOTHING;

-- 2) Riattiva R. C. I/F AUTOCARRI (serve per il rischio EXE 98 GLOB AUTOC)
UPDATE public.rami SET attivo = true WHERE codice = 'QG';

-- 3) Tabella di corrispondenza rischio EXE -> sottoramo
CREATE TABLE IF NOT EXISTS public.roma_exe_rischi_map (
  codice_rischio integer PRIMARY KEY,
  descrizione_rischio text NOT NULL,
  ramo_exe text NOT NULL,
  ramo_id uuid NOT NULL REFERENCES public.rami(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roma_exe_rischi_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roma_exe_rischi_map_select" ON public.roma_exe_rischi_map;
CREATE POLICY "roma_exe_rischi_map_select" ON public.roma_exe_rischi_map
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "roma_exe_rischi_map_admin" ON public.roma_exe_rischi_map;
CREATE POLICY "roma_exe_rischi_map_admin" ON public.roma_exe_rischi_map
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.roma_exe_rischi_map (codice_rischio, descrizione_rischio, ramo_exe, ramo_id)
SELECT v.cod, v.descr, v.ramo_exe, r.id
FROM (VALUES
  (100, 'VITA',         'VITA',                        'RI'),
  (101, 'PERSONALE',    'VITA',                        'RC'),
  (102, 'TFM',          'VITA',                        'RC1'),
  (103, 'UNIT',         'VITA',                        'RU'),
  (104, 'TFR',          'VITA',                        'RB'),
  (105, 'PIP',          'VITA',                        'RPP'),
  (1,   'PIU`',         'POLIZZA PIU`',                'LQ'),
  (8,   'GLOB AB UF',   'INCENDIO',                    'LTA'),
  (9,   'CATASTR',      'INCENDIO',                    'CAT'),
  (10,  'INCENDIO',     'INCENDIO',                    'LS'),
  (11,  'INC.AGRIC',    'INCENDIO',                    'LA'),
  (12,  'IMP FOTOV',    'INCENDIO',                    'ARB'),
  (13,  'GLOB.FABB',    'INCENDIO',                    'LT'),
  (14,  'ALBERGHI',     'INCENDIO',                    'LTB'),
  (16,  'LEASING',      'INCENDIO',                    'LB'),
  (17,  'INDUSTR.',     'INCENDIO',                    'LI'),
  (18,  'MONTAGGIO',    'INCENDIO',                    'FE'),
  (15,  'GLOB.ESER.',   'GLOBALE ESERCIZI',            'LTC'),
  (20,  'FURTO',        'FURTO',                       'IB'),
  (24,  'FURTO AB.',    'FURTO',                       'IV'),
  (28,  'INFEDELTA''',  'FURTO',                       'IF'),
  (25,  'CRISTALLI',    'GLOBALE CRISTALLI',           'LX'),
  (30,  'FUR\INC',      'FURTO E INCENDIO',            'LU'),
  (34,  'F.I.ABIT',     'FURTO E INCENDIO',            'LU'),
  (36,  'F.I.ABIT',     'FURTO E INCENDIO',            'LU'),
  (42,  'CAUZIONI',     'CAUZIONI',                    'FID'),
  (44,  'LEGALI',       'SPESE LEGALI E PERITALI',     'PG'),
  (45,  'CREDITO',      'CREDITO',                     'CC'),
  (46,  'IMPIEGO',      'CREDITO',                     'CPI'),
  (50,  'INFORTUNI',    'INFORTUNI',                   'NIA'),
  (51,  'INFORTUNI',    'INFORTUNI',                   'NIA'),
  (52,  'INFORTUNI',    'INFORTUNI',                   'NIA'),
  (54,  'INF COMPL',    'INFORTUNI',                   'NIC'),
  (55,  'INFORTUNI',    'INFORTUNI',                   'NIA'),
  (57,  'INFORTUNI',    'INFORTUNI',                   'NIA'),
  (58,  'ASS SANIT',    'SANITARIA',                   'MS'),
  (59,  'SANITARIA',    'SANITARIA',                   'MCA'),
  (60,  'RCVT',         'RESP.CIVILE VERSO TERZI',     'PB'),
  (61,  'TUT.LEG.',     'RESP.CIVILE VERSO TERZI',     'SL'),
  (62,  'RC CACCIA',    'RESP.CIVILE VERSO TERZI',     'PCC'),
  (63,  'D&O',          'RESP.CIVILE VERSO TERZI',     'PT'),
  (64,  'VIAGGI',       'RESP.CIVILE VERSO TERZI',     'DV'),
  (65,  'CAPOFAM.',     'RESP.CIVILE VERSO TERZI',     'PE'),
  (66,  'L. FAMIGLIA',  'RESP.CIVILE VERSO TERZI',     'PE'),
  (67,  'KASKO',        'RESP.CIVILE VERSO TERZI',     'QK'),
  (68,  'DEC POST',     'RESP.CIVILE VERSO TERZI',     'PL'),
  (69,  'R.C.T. IND.',  'RESP.CIVILE VERSO TERZI',     'PMB'),
  (71,  'ALOP',         'RESP.CIVILE VERSO TERZI',     'FL'),
  (73,  'INQUINAM',     'RESP.CIVILE VERSO TERZI',     'PN'),
  (70,  'VETRI',        'POLIZZA VETRI',               'LX'),
  (72,  'FILM',         'DANNI PELLICOLE',             'FLM'),
  (75,  'CAVALLI',      'ALL RISKS BESTIAME',          'BST'),
  (77,  'APPALT.RE',    'RISCHI APPALTATORE',          'GC'),
  (80,  'AEREOMO',      'TRASPORTI',                   'BC'),
  (81,  'INF. AER.',    'TRASPORTI',                   'BI'),
  (85,  'CORPI',        'TRASPORTI',                   'DNA'),
  (87,  'DANNI  MERCI', 'TRASPORTI',                   'TM'),
  (88,  'OPER D''ARTE', 'TRASPORTI',                   'AT'),
  (89,  'RAMO VALORI',  'TRASPORTI',                   'TV'),
  (91,  'RCA',          'RESPONSABILITA'' CIVILE AUTO', 'QA'),
  (92,  'GLOB.AUTO',    'RESPONSABILITA'' CIVILE AUTO', 'QU'),
  (93,  'R.C.T. IMB.',  'RESPONSABILITA'' CIVILE AUTO', 'QN'),
  (94,  'ASSIS AUTO',   'RESPONSABILITA'' CIVILE AUTO', 'DAB'),
  (95,  'RC CICL',      'RESPONSABILITA'' CIVILE AUTO', 'QM'),
  (96,  'GLOB CICLOM',  'RESPONSABILITA'' CIVILE AUTO', 'QO'),
  (97,  'RC AUTOC',     'RESPONSABILITA'' CIVILE AUTO', 'QC'),
  (98,  'GLOB AUTOC',   'RESPONSABILITA'' CIVILE AUTO', 'QG'),
  (99,  'LIBRO MATR.',  'RESPONSABILITA'' CIVILE AUTO', 'QAB')
) AS v(cod, descr, ramo_exe, sottoramo)
JOIN public.rami r ON r.codice = v.sottoramo
ON CONFLICT (codice_rischio) DO NOTHING;
