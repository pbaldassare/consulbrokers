-- Conti bancari da export TTCBI00F_20261027105855 (17 rapporti legacy Consulbrokers)
insert into conti_bancari (etichetta, iban, intestato_a, banca, bic, codice_abi, codice_cab, tipo, is_default, attivo, note)
select v.etichetta, v.iban, v.intestato_a, v.banca, v.bic, v.codice_abi, v.codice_cab, v.tipo, v.is_default, v.attivo, v.note
from (values
  ('No Contabilità', 'SENZA-IBAN-RAPPORTO-01', 'Consulbrokers Spa', null::text, null::text, null::text, null::text, 'generico', false, true, 'RapportoID legacy: 01 | CF/P.IVA: 00970250767'),
  ('BDM CC CONGIUNTO 4954', 'IT57E0542404201000000154954', 'CONSULBROKERS SPA', 'CONSULBROKERS SPA', null::text, '05424', '04200', 'generico', false, true, 'RapportoID legacy: 02 | ContoCoge: 060201000083'),
  ('BANCA PREALPI CC 10756', 'IT33Q0890436281061015010756', 'CONSULBROKERS SPA', 'CONSULBROKERS SPA', null::text, '08904', '36281', 'generico', false, true, 'RapportoID legacy: 05 | ContoCoge: 060201000034 | CF/P.IVA: 14003610962 | CUC: 2033889L'),
  ('BANCA PREALPI CC 10777', 'IT68V0890436281061015010777', 'CONSULBROKERS SPA', 'CONSULBROKERS SPA', null::text, '08904', '36281', 'generico', false, true, 'RapportoID legacy: 06 | ContoCoge: 060201000055 | CF/P.IVA: 14003610962 | CUC: 2033889L'),
  ('BCC 3292', 'IT62G0859704200000000603292', 'Consulbrokers Spa', 'Consulbrokers Spa', null::text, '08597', '04200', 'generico', false, true, 'RapportoID legacy: 07 | ContoCoge: 060201000050 | CF/P.IVA: 14003610962 | CUC: 2033889L'),
  ('INTESA SAN DONA 64660', 'IT30J0306936283100000064660', 'Consulbrokers Spa', 'Consulbrokers Spa', null::text, '03069', '36283', 'generico', false, true, 'RapportoID legacy: 08 | ContoCoge: 060201000057 | CF/P.IVA: 14003610962'),
  ('BANCO DI NAPOLI C/C 7947', 'IT09W0101004200000027007947', 'CONSULBROKERS SPA', 'CONSULBROKERS SPA', null::text, '01010', '04200', 'generico', false, true, 'RapportoID legacy: 12 | ContoCoge: 060201000001 | CF/P.IVA: 00970250767'),
  ('DEBITI V/SO CB HOLDING X COMP.', 'SENZA-IBAN-RAPPORTO-18', 'CB CONSULBROKERS SPA', 'CB CONSULBROKERS SPA', null::text, null::text, null::text, 'generico', false, true, 'RapportoID legacy: 18 | ContoCoge: 040305000110'),
  ('BCC BASILICATA - C/C 1668', 'IT54D0859704200000000601668', 'CB CONSULBROKERS SPA', 'CB CONSULBROKERS SPA', 'ICRAITRRGL0', '08597', '04200', 'generico', false, true, 'RapportoID legacy: 19 | ContoCoge: 060201000064 | CF/P.IVA: 12994080963'),
  ('BANCA VALSABBINA 3846', 'IT16L0511601600000000003846', 'CB CONSULBROKERS SPA', 'CB CONSULBROKERS SPA', null::text, '05116', '01600', 'generico', false, true, 'RapportoID legacy: 20 | ContoCoge: 060201000080 | CF/P.IVA: 12994080963 | CUC: SIAC2KVK'),
  ('INTESA SANPAOLO 7591', 'IT44R0306904214100000017591', 'CB CONSULBROKERS SPA', 'CB CONSULBROKERS SPA', null::text, '03069', '04214', 'generico', false, true, 'RapportoID legacy: 21 | ContoCoge: 060201000067 | CF/P.IVA: 12994080963'),
  ('BCC BASILICATA - CC 1673', 'IT04A0859704200000000601673', 'CB CONSULBROKERS SPA', 'CB CONSULBROKERS SPA', null::text, '08597', '04200', 'generico', false, true, 'RapportoID legacy: 22 | ContoCoge: 060201000065 | CF/P.IVA: 12994080963'),
  ('CRIPARMA C/C 8241', 'IT71I0623003546000057368241', 'CB CONSULBROKERS SPA', 'CB CONSULBROKERS SPA', 'CRPPIT2P500', '06230', '03549', 'generico', false, true, 'RapportoID legacy: 23 | ContoCoge: 060201000054 | CF/P.IVA: 12994080963'),
  ('VIVIBANCA 1753', 'IT70C0503003400000010211753', 'CB CONSULBROKERS SPA', 'CB CONSULBROKERS SPA', 'CRSNIT31', '05030', '03400', 'generico', false, true, 'RapportoID legacy: 24 | ContoCoge: 060201000082 | CF/P.IVA: 12994080963'),
  ('VALSABBINA 4464', 'IT22N0511601600000000004464', 'CONSULBROKERS SPA', 'CONSULBROKERS SPA', null::text, '05116', '01600', 'generico', false, true, 'RapportoID legacy: 25 | ContoCoge: 060201000052 | CF/P.IVA: 14003610962'),
  ('BCC 3293', 'IT39H0859704200000000603293', 'CONSULBROKERS SPA', 'CONSULBROKERS SPA', null::text, '08597', '04200', 'generico', false, true, 'RapportoID legacy: 26 | ContoCoge: 060201000051 | CF/P.IVA: 14003610962'),
  ('VIVIBANCA 5494 ART 117', 'IT70A0503003400000010425494', 'CONSULBROKERS SPA', 'CONSULBROKERS SPA', null::text, '05030', '03400', 'generico', false, true, 'RapportoID legacy: 27 | ContoCoge: 060201000086 | CF/P.IVA: 14003610962')
) as v(etichetta, iban, intestato_a, banca, bic, codice_abi, codice_cab, tipo, is_default, attivo, note)
where not exists (
  select 1 from conti_bancari c
  where upper(replace(c.iban, ' ', '')) = upper(replace(v.iban, ' ', ''))
);
