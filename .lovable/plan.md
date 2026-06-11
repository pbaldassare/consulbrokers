# Modulo RAG Polizze CGA

Sistema di estrazione **una tantum** del PDF polizza in DB strutturato, separando **Dati di Prodotto** (condivisi tra clienti) e **Dati Personali** (override per cliente). La chat "Chiedi alla Polizza" interroga il DB e usa l'AI solo come motore di sintesi sui dati già estratti — **zero re-parsing del PDF**.

---

## 1) Database — 5 tabelle + RLS

```sql
-- ============ LIBRERIA PRODOTTO (condivisa L1→L5) ============

CREATE TABLE public.prodotti_cga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_prodotto text NOT NULL,
  compagnia text,
  ramo text,
  edizione text,
  sommario_ai text,
  testo_completo text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nome_prodotto, compagnia, edizione)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prodotti_cga TO authenticated;
GRANT ALL ON public.prodotti_cga TO service_role;
ALTER TABLE public.prodotti_cga ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all_auth" ON public.prodotti_cga FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_admin" ON public.prodotti_cga FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.prodotti_garanzie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prodotto_id uuid NOT NULL REFERENCES public.prodotti_cga(id) ON DELETE CASCADE,
  garanzia text NOT NULL,
  massimale_standard numeric(12,2),
  franchigia_standard numeric(12,2),
  scoperto_percentuale numeric(5,2),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prodotti_garanzie TO authenticated;
GRANT ALL ON public.prodotti_garanzie TO service_role;
ALTER TABLE public.prodotti_garanzie ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all_auth" ON public.prodotti_garanzie FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_admin" ON public.prodotti_garanzie FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.prodotti_condizioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prodotto_id uuid NOT NULL REFERENCES public.prodotti_cga(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('apertura_sinistro','esclusione','obbligo_assicurato','termine_denuncia','altro')),
  titolo text,
  testo text NOT NULL,
  rilevante_sinistri boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prodotti_condizioni TO authenticated;
GRANT ALL ON public.prodotti_condizioni TO service_role;
ALTER TABLE public.prodotti_condizioni ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all_auth" ON public.prodotti_condizioni FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_admin" ON public.prodotti_condizioni FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ DATI PERSONALI PER CLIENTE (RLS via ufficio) ============

CREATE TABLE public.polizza_cga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid REFERENCES public.titoli(id) ON DELETE SET NULL,
  cliente_id uuid NOT NULL REFERENCES public.clienti(id) ON DELETE CASCADE,
  prodotto_id uuid NOT NULL REFERENCES public.prodotti_cga(id) ON DELETE RESTRICT,
  documento_id uuid REFERENCES public.documenti(id) ON DELETE SET NULL,
  sommario_personalizzato text,
  stato text NOT NULL DEFAULT 'in_elaborazione'
    CHECK (stato IN ('in_elaborazione','bozza','approvato')),
  approvato_da uuid REFERENCES auth.users(id),
  approvato_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.polizza_cga(cliente_id);
CREATE INDEX ON public.polizza_cga(titolo_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polizza_cga TO authenticated;
GRANT ALL ON public.polizza_cga TO service_role;
ALTER TABLE public.polizza_cga ENABLE ROW LEVEL SECURITY;
-- Stesso pattern visibilità clienti: admin/cfo vedono tutto, gli altri vedono se cliente è nella loro sede
CREATE POLICY "read_via_cliente" ON public.polizza_cga FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR EXISTS (
    SELECT 1 FROM public.clienti c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = polizza_cga.cliente_id
      AND (p.ufficio_id IS NULL OR c.ufficio_id = p.ufficio_id)
  )
);
CREATE POLICY "write_via_cliente" ON public.polizza_cga FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cfo')
  OR EXISTS (
    SELECT 1 FROM public.clienti c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = polizza_cga.cliente_id AND c.ufficio_id = p.ufficio_id
  )
) WITH CHECK (true);

CREATE TABLE public.polizza_garanzie_personali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  polizza_cga_id uuid NOT NULL REFERENCES public.polizza_cga(id) ON DELETE CASCADE,
  prodotto_garanzia_id uuid REFERENCES public.prodotti_garanzie(id) ON DELETE SET NULL,
  massimale_personalizzato numeric(12,2),
  franchigia_personalizzata numeric(12,2),
  scoperto_personalizzato numeric(5,2),
  note_personali text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.polizza_garanzie_personali(polizza_cga_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polizza_garanzie_personali TO authenticated;
GRANT ALL ON public.polizza_garanzie_personali TO service_role;
ALTER TABLE public.polizza_garanzie_personali ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_via_polizza" ON public.polizza_garanzie_personali FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.polizza_cga pc WHERE pc.id = polizza_cga_id)
);
CREATE POLICY "write_via_polizza" ON public.polizza_garanzie_personali FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.polizza_cga pc WHERE pc.id = polizza_cga_id)
) WITH CHECK (true);
```
> Le policy `read_via_polizza` ereditano la visibilità di `polizza_cga` perché RLS è applicata anche all'EXISTS.

---

## 2) Punto esatto di inserimento — `src/pages/ClienteDetail.tsx`

Tab Documenti, righe **1947-1974**. Modifiche **additive only**:

- **Pulsante "Analizza Polizza CGA"** → aggiunto **dentro** la Card "Scansione AI Documenti" (riga 1970), nella stessa riga flex degli `AiDocumentScanner`, come ultimo bottone (visibile per privati e aziende).
- **Sezione "Polizze Analizzate"** → nuova `<Card>` inserita **tra riga 1972 (`</Card>`) e riga 1973 (`<DocumentiTab/>`)**. Contiene:
  - tabella CGA approvate per il cliente (nome prodotto, compagnia, data, badge stato)
  - pannello `<ChiediAllaPolizzaPanel clienteId={id!} />` sotto la tabella
- **Nulla viene modificato** in `AiDocumentScanner`, `DocumentiTab`, o nella Card esistente al di fuori dell'aggiunta del bottone.

L6 Cliente (portale separato `/cliente`): la tab Documenti del portale mostrerà solo la lista CGA approvate in sola lettura, senza pulsante "Analizza" e senza chat.

---

## 3) Componenti nuovi

```
src/components/cga/
  AnalizzaPolizzaCgaButton.tsx     # apre dialog upload
  AnalizzaPolizzaCgaDialog.tsx     # upload PDF + select titolo + "Avvia Analisi AI"
  AnteprimaCgaDialog.tsx           # 2 sezioni Prodotto/Personali, badge "già in libreria"/"nuovo", Approva/Modifica/Scarta
  PolizzeCgaList.tsx               # tabella CGA approvate del cliente
  ChiediAllaPolizzaPanel.tsx       # select polizza + chat con esempi suggeriti

src/hooks/
  usePolizzeCgaByCliente.ts
  useChiediAllaPolizza.ts          # 1) query DB strutturato 2) chiamata edge function chat
```

---

## 4) Flusso AI

- **Estrazione**: riusa `supabase/functions/parse-polizza-completa` (già esistente). Aggiungo un nuovo tool schema lato edge — **niente nuova edge function**: estendo lo schema esistente per restituire blocchi `prodotto`, `garanzie_prodotto[]`, `condizioni_prodotto[]`, `dati_personali`, `garanzie_personali[]`.
- **Dedup prodotto**: lookup `prodotti_cga` su `(nome_prodotto, compagnia, edizione)` → se esiste, collego; altrimenti insert.
- **Chat "Chiedi alla Polizza"** — nuova edge function leggera `chiedi-polizza-cga`:
  1. Carica da DB: `polizza_cga` + `polizza_garanzie_personali` + `prodotti_garanzie` + `prodotti_condizioni` per la polizza scelta.
  2. Compone un **contesto strutturato JSON** (no PDF).
  3. Chiama Lovable AI Gateway / Gemini 2.5 Flash con system prompt che impone di citare la fonte (`dato personalizzato` vs `dato di prodotto`).
- Storico domande/risposte tenuto in stato React di sessione (non persistito in DB in v1).

---

## 5) Storage / sicurezza

- Bucket: `documenti_clienti` già esistente, nessuna modifica.
- `polizza_cga.documento_id` punta alla riga creata in `documenti` per il PDF.
- Nessuna modifica a `titoli`, `clienti`, `documenti`.

---

## 6) Out of scope (v1)

- Persistenza storico chat in DB.
- Embeddings/pgvector: i prodotti CGA sono pochi, query SQL diretta è sufficiente. Si potrà aggiungere in v2.
- Editing manuale delle garanzie standard di prodotto: solo Admin via DB in v1; UI dedicata in v2.

Confermi e procedo con la migration + componenti?
