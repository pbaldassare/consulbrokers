
# Modulo Movimenti Bancari — Piano

## 1. Tabelle Supabase (da approvare prima di creare)

### 1.1 `movimenti_bancari`

```sql
CREATE TYPE public.movimento_bancario_stato AS ENUM
  ('importato','matchato','assegnato','ricongiunti','incassato');

CREATE TABLE public.movimenti_bancari (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_movimento  date NOT NULL,
  importo         numeric(12,2) NOT NULL,
  ordinante       text,
  descrizione     text,
  stato           public.movimento_bancario_stato NOT NULL DEFAULT 'importato',
  ufficio_id      uuid REFERENCES public.uffici(id),
  cliente_id      uuid REFERENCES public.clienti(id),
  caricato_da     uuid REFERENCES auth.users(id),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimenti_bancari TO authenticated;
GRANT ALL ON public.movimenti_bancari TO service_role;
ALTER TABLE public.movimenti_bancari ENABLE ROW LEVEL SECURITY;

-- Admin/CFO: full access
CREATE POLICY "mb_admin_all" ON public.movimenti_bancari
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo'));

-- Sede: solo movimenti del proprio ufficio_id
CREATE POLICY "mb_sede_select" ON public.movimenti_bancari
  FOR SELECT TO authenticated
  USING (ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "mb_sede_update" ON public.movimenti_bancari
  FOR UPDATE TO authenticated
  USING (ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid()));
```

### 1.2 `movimenti_clienti`

```sql
CREATE TABLE public.movimenti_clienti (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimento_id        uuid NOT NULL REFERENCES public.movimenti_bancari(id) ON DELETE CASCADE,
  cliente_id          uuid NOT NULL REFERENCES public.clienti(id),
  ufficio_id          uuid REFERENCES public.uffici(id),
  importo_assegnato   numeric(12,2) NOT NULL,
  anticipo            numeric(12,2) NOT NULL DEFAULT 0,
  ammanco             numeric(12,2) NOT NULL DEFAULT 0,
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimenti_clienti TO authenticated;
GRANT ALL ON public.movimenti_clienti TO service_role;
ALTER TABLE public.movimenti_clienti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mc_admin_all" ON public.movimenti_clienti
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo'));

CREATE POLICY "mc_sede_rw" ON public.movimenti_clienti
  FOR ALL TO authenticated
  USING (ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid()));
```

### 1.3 `movimenti_polizze`

```sql
CREATE TYPE public.movimento_polizza_tipo AS ENUM ('polizza','anticipo','ammanco');

CREATE TABLE public.movimenti_polizze (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimento_cliente_id  uuid NOT NULL REFERENCES public.movimenti_clienti(id) ON DELETE CASCADE,
  titolo_id             uuid REFERENCES public.titoli(id),
  importo               numeric(12,2) NOT NULL,
  tipo                  public.movimento_polizza_tipo NOT NULL DEFAULT 'polizza',
  messo_a_cassa         boolean NOT NULL DEFAULT false,
  data_messa_cassa      date,
  created_at            timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimenti_polizze TO authenticated;
GRANT ALL ON public.movimenti_polizze TO service_role;
ALTER TABLE public.movimenti_polizze ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_admin_all" ON public.movimenti_polizze
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo'));

CREATE POLICY "mp_sede_rw" ON public.movimenti_polizze
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.movimenti_clienti mc
    WHERE mc.id = movimento_cliente_id
      AND mc.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.movimenti_clienti mc
    WHERE mc.id = movimento_cliente_id
      AND mc.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
  ));
```

Realtime abilitato su tutte e 3 (`ALTER PUBLICATION supabase_realtime ADD TABLE ...`) per il monitor admin.

## 2. Voci di menu (in `src/components/AppSidebar.tsx`, gruppo "Contabilità")

Aggiunte alla fine del gruppo `Contabilità` esistente:

```ts
{ label: "Caricamento Mov. Bancari", path: "/contabilita/caricamento-mov-bancari",
  icon: Import, hideForRoles: ["ufficio","backoffice","contabilita","manager","produttore","corrispondente","cliente","prospect"] },
// → visibile solo a admin (L1) e cfo (L2)

{ label: "Ricongiungimento Bancario", path: "/contabilita/ricongiungimento-bancario",
  icon: ArrowRightLeft, hideForRoles: ["manager","produttore","corrispondente","cliente","prospect"] },
// → visibile a admin, cfo, ufficio, backoffice, contabilita (L1/L2/L3)
```

Permessi: entrambe sotto `permissionKey: "contabilita"` (già esistente nel gruppo).

## 3. Pagine (dopo approvazione tabelle)

- `src/pages/contabilita/CaricamentoMovBancariPage.tsx` — 3 tab (Importazione, Revisione, Monitor real-time). Riusa `parse-bank-document`, `match-bank-rows`, `incrocio-bancario` edge functions esistenti. RoleGuard: `["admin","cfo"]`.
- `src/pages/contabilita/RicongiungimentoBancarioPage.tsx` — 2 tab (Da Ricongiungere, Storico). Card espandibili con sezioni Cliente / Polizze (checkbox + importo) / Anticipi / Ammanchi; validazione quadratura in tempo reale; "Metti a Cassa" riusa logica `MessaCassaDialog` esistente. RoleGuard: `["admin","cfo","ufficio","backoffice","contabilita"]`. Filtro automatico per `ufficio_id` (admin/cfo selettore ufficio).
- Route registrate in `src/routes/contabilita.tsx`.

## 4. Note tecniche

- Riuso totale di edge functions e dialog esistenti — nessuna duplicazione di logica.
- `useServerPagination` (25 righe, debounce 350ms) per le liste lunghe.
- `SearchableSelect` per ricerca cliente manuale.
- Subscription Realtime chiusa in `useEffect` con `removeChannel` (no leak).
- Audit log su cambi di stato via `logAttivita`.

---

**Conferma queste 3 tabelle SQL e le 2 voci di menu così procedo con la migration e poi le pagine.**
