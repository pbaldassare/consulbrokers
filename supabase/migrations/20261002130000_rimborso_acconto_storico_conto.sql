-- Storico completo del rimborso di un acconto cliente.
-- Il rimborso chiude il residuo e conserva importo, conto di uscita,
-- data, note e operatore direttamente sulla partita storica.

ALTER TABLE public.cliente_anticipi
  ADD COLUMN IF NOT EXISTS rimborsato_importo numeric(12,2),
  ADD COLUMN IF NOT EXISTS rimborsato_conto_bancario_id uuid,
  ADD CONSTRAINT cliente_anticipi_rimborsato_importo_check
    CHECK (rimborsato_importo IS NULL OR rimborsato_importo > 0),
  ADD CONSTRAINT cliente_anticipi_rimborsato_conto_bancario_id_fkey
    FOREIGN KEY (rimborsato_conto_bancario_id)
    REFERENCES public.conti_bancari(id)
    ON DELETE RESTRICT;

-- Per i rimborsi storici l'importo è ricostruibile come credito originario
-- meno gli utilizzi già registrati. Il conto non è inferibile e resta nullo.
UPDATE public.cliente_anticipi a
SET rimborsato_importo = GREATEST(
  a.importo - COALESCE((
    SELECT SUM(u.importo_utilizzato)
    FROM public.cliente_anticipi_utilizzi u
    WHERE u.anticipo_id = a.id
  ), 0),
  0.01
)
WHERE a.rimborsato_il IS NOT NULL
  AND a.rimborsato_importo IS NULL;

CREATE INDEX IF NOT EXISTS idx_cliente_anticipi_rimborsato_conto
  ON public.cliente_anticipi(rimborsato_conto_bancario_id)
  WHERE rimborsato_conto_bancario_id IS NOT NULL;

COMMENT ON COLUMN public.cliente_anticipi.rimborsato_importo IS
  'Importo residuo effettivamente restituito al cliente.';
COMMENT ON COLUMN public.cliente_anticipi.rimborsato_conto_bancario_id IS
  'Conto bancario dal quale è uscito il rimborso al cliente.';
