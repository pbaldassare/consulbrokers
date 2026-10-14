-- dettaglio_riparto: write era solo has_role('ufficio').
-- Admin (e Visualizza come) crea il titolo ma l'insert del riparto falliva 42501.
-- Allinea a titoli: chi vede il titolo può leggere/scrivere il riparto.

DROP POLICY IF EXISTS "Ufficio global insert dettaglio_riparto" ON public.dettaglio_riparto;
DROP POLICY IF EXISTS "Ufficio global update dettaglio_riparto" ON public.dettaglio_riparto;
DROP POLICY IF EXISTS "Ufficio global delete dettaglio_riparto" ON public.dettaglio_riparto;
DROP POLICY IF EXISTS "Authenticated users can read dettaglio_riparto" ON public.dettaglio_riparto;
DROP POLICY IF EXISTS "Authenticated users can insert dettaglio_riparto" ON public.dettaglio_riparto;
DROP POLICY IF EXISTS "Authenticated users can update dettaglio_riparto" ON public.dettaglio_riparto;
DROP POLICY IF EXISTS "Authenticated users can delete dettaglio_riparto" ON public.dettaglio_riparto;
DROP POLICY IF EXISTS "Staff select dettaglio_riparto via titolo" ON public.dettaglio_riparto;
DROP POLICY IF EXISTS "Staff insert dettaglio_riparto via titolo" ON public.dettaglio_riparto;
DROP POLICY IF EXISTS "Staff update dettaglio_riparto via titolo" ON public.dettaglio_riparto;
DROP POLICY IF EXISTS "Staff delete dettaglio_riparto via titolo" ON public.dettaglio_riparto;

CREATE POLICY "Staff select dettaglio_riparto via titolo"
  ON public.dettaglio_riparto
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.titoli t
      WHERE t.id = dettaglio_riparto.titolo_id
    )
  );

CREATE POLICY "Staff insert dettaglio_riparto via titolo"
  ON public.dettaglio_riparto
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.titoli t
      WHERE t.id = dettaglio_riparto.titolo_id
    )
  );

CREATE POLICY "Staff update dettaglio_riparto via titolo"
  ON public.dettaglio_riparto
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.titoli t
      WHERE t.id = dettaglio_riparto.titolo_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.titoli t
      WHERE t.id = dettaglio_riparto.titolo_id
    )
  );

CREATE POLICY "Staff delete dettaglio_riparto via titolo"
  ON public.dettaglio_riparto
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.titoli t
      WHERE t.id = dettaglio_riparto.titolo_id
    )
  );
