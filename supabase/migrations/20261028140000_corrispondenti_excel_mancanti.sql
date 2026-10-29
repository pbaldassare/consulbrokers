-- Corrispondenti (produttori) da export Excel Corrispondenti_20261027105501: 7 codici assenti in anagrafiche_professionali
insert into anagrafiche_professionali (
  codice, tipo, ruoli, attivo, annullato, trattenuta_provvigioni_incasso,
  nome, cognome, ragione_sociale, indirizzo, citta, provincia, cap,
  percentuale_base, percentuale_ra, telefono, email, numero_rui, iban, intestatario_cc
)
select v.*
from (values
  ('CV', 'corrispondente', array['corrispondente']::text[], true, false, false,
   'VALERIO', 'COSTAGLIOLA', 'COSTAGLIOLA VALERIO', 'VIA G. VERDI, 5', 'POTENZA', 'PZ', '85100',
   40::numeric, 0::numeric, '3386309327', 'info.superass@gmail.com', 'E000578245',
   'IT43J0306903487100000005659', 'COSTAGLIOLA VALERIO'),
  ('ETI', 'corrispondente', array['corrispondente']::text[], true, false, false,
   null, null, 'ETISICURA', null, null, null, null, 0::numeric, 0::numeric, null, null, null, null, null),
  ('LEO', 'corrispondente', array['corrispondente']::text[], true, false, false,
   'ANDREA', 'LEONE', 'LEONE ANDREA', null, 'CORATO', 'BA', '70033', 20::numeric, 0::numeric, null, 'aleone@consulbrokers.it', null, null, null),
  ('MN', 'corrispondente', array['corrispondente']::text[], true, false, false,
   'NICOLA', 'MASUCCI', 'MASUCCI NICOLA', null, null, null, null, 40::numeric, 0::numeric, null, null, null, null, null),
  ('MP2', 'corrispondente', array['corrispondente']::text[], true, false, false,
   null, null, 'MPC', null, null, null, null, 0::numeric, 0::numeric, null, null, null, null, null),
  ('PM', 'corrispondente', array['corrispondente']::text[], true, false, false,
   'MATTIA', 'PALATELLA', 'PALATELLA MATTIA', 'Via Andrea Solari 43/3', null, null, '20144', 40::numeric, 0::numeric, null, null, null, null, null),
  ('SUD', 'corrispondente', array['corrispondente']::text[], true, false, false,
   null, null, 'Assisud di Gregorio Angelo & C. Sas', 'Via Velia, 15', 'SALERNO', 'SA', '84122', 0::numeric, 4.6::numeric, null, 'f.dangelo@assisud.it', null, null, null)
) as v(
  codice, tipo, ruoli, attivo, annullato, trattenuta_provvigioni_incasso,
  nome, cognome, ragione_sociale, indirizzo, citta, provincia, cap,
  percentuale_base, percentuale_ra, telefono, email, numero_rui, iban, intestatario_cc
)
where not exists (
  select 1 from anagrafiche_professionali ap
  where ap.tipo = 'corrispondente' and ap.codice = v.codice
);
