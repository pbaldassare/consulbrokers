-- POTENZA CALCIO SRL: due righe del flusso riportavano Inizio Polizza 2024,
-- ma la copertura effettiva del titolo è 15/09/2026 - 15/09/2027.
-- Allineamento al terzo titolo dello stesso rinnovo, senza creare duplicati.

DO $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.titoli
  SET durata_da = DATE '2026-09-15',
      durata_a = DATE '2027-09-15',
      anni_durata = 1,
      garanzia_da = DATE '2026-09-15',
      garanzia_a = DATE '2027-09-15',
      data_competenza = DATE '2026-09-15',
      data_scadenza = DATE '2027-09-15'
  WHERE id IN (
      'a2818e0c-75fb-4fa3-a50c-458406e14252'::uuid,
      '84393003-8f02-4b61-b21e-d8dbcc5f7e63'::uuid
    )
    AND numero_titolo IN (
      '774.047.0000900016',
      '774.053.0000900050'
    )
    AND cliente_anagrafica_id = 'd4c14af2-c521-42fc-9ae0-542345363189'::uuid
    AND data_messa_cassa IS NULL
    AND stato = 'attivo';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 2 THEN
    RAISE EXCEPTION
      'Correzione Potenza Calcio annullata: attese 2 righe, aggiornate %',
      v_updated;
  END IF;
END
$$;
