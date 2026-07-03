import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Download, Building2, TrendingUp, Percent, Scale, Filter, RotateCcw, Send, ChevronRight, ChevronDown, CreditCard, FileText, AlertCircle, Loader2, Landmark, Euro, Mail, FileSpreadsheet, Printer, CalendarDays } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { DatePicker } from "@/components/contabilita/DatePicker";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { buildRimessaPdf, type RimessaPdfData } from "@/lib/rimessa-pdf";
import { validateIban } from "@/lib/validateIban";
import { filterContiBancariPerSede } from "@/lib/filterContiBancariPerSede";
import { getProvvigioneEC } from "@/lib/getProvvigioneEC";
import { isInCoperturaGarantita } from "@/lib/garantitoTitolo";

const formatIbanMask = (s: string) =>
  (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(.{4})/g, "$1 ").trim();

interface Filters {
  compagnia_id: string | null;
  ufficio_id: string | null;
  periodo_dal: Date | null;
  periodo_al: Date | null;
  tipo_pagamento: string | null;
}

interface TitoloDetail {
  id: string;
  numero_titolo: string | null;
  data_messa_cassa: string | null;
  data_copertura: string | null;
  premio_lordo: number;
  importo_incassato: number;
  conferimento_gestito: boolean;
  fondi_ricevuti: boolean;
  tipo_pagamento: string | null;
}

interface GroupedRow {
  compagnia_id: string;
  nome: string;
  codice: string;
  mail: string;
  lordo: number;
  provvigioni: number;
  data_min: string | null;
  data_max: string | null;
  titoli: TitoloDetail[];
}

interface PagaRimessaState {
  open: boolean;
  compagniaId: string;
  compagniaNome: string;
  iban: string; // IBAN destinazione (agenzia)
  contoMittenteId: string | null;
  ibanMittente: string;
  importoTotale: number;
  importoPagato: string;
  note: string;
  titoliIds?: string[];
  titoliCount: number;
  titoli: TitoloDetail[];
}

const defaultFilters: Filters = {
  compagnia_id: null, ufficio_id: null, periodo_dal: null, periodo_al: null, tipo_pagamento: null,
};

const ECCompagniaContabPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAgenzia = location.pathname.startsWith("/contabilita/ec-agenzia");
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const [filters, setFilters] = useState<Filters>({ ...defaultFilters });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedTitoli, setSelectedTitoli] = useState<Record<string, Set<string>>>({});
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [exportDate, setExportDate] = useState<Date | null>(null);
  const [pagaDialog, setPagaDialog] = useState<PagaRimessaState>({
    open: false, compagniaId: "", compagniaNome: "", iban: "", contoMittenteId: null, ibanMittente: "", importoTotale: 0, importoPagato: "", note: "", titoliCount: 0, titoli: [],
  });
  const set = (partial: Partial<Filters>) => setFilters((f) => ({ ...f, ...partial }));

  // Conti correnti Consulbrokers (tipo 'generico') — sorgente del bonifico verso l'agenzia
  const { data: contiMittenteRaw = [] } = useQuery({
    queryKey: ["conti-bancari-generico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conti_bancari")
        .select("id, etichetta, iban, intestato_a, banca, is_default, tipo, conti_bancari_uffici(ufficio_id)")
        .eq("tipo", "generico")
        .eq("attivo", true)
        .order("is_default", { ascending: false })
        .order("etichetta");
      if (error) throw error;
      return (data || []);
    },
  });
  const contiMittente = useMemo(
    () =>
      filterContiBancariPerSede(contiMittenteRaw, {
        ruolo: profile?.ruolo,
        ufficioId: profile?.ufficio_id,
      }),
    [contiMittenteRaw, profile?.ruolo, profile?.ufficio_id],
  );
  const contoMittenteDefault = contiMittente.find((c: any) => c.is_default) || contiMittente[0] || null;

  const fmtEuro = (n: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);

  const handleInviaEmail = async (r: GroupedRow, daRimettere: number) => {
    try {
      setSendingEmailId(r.compagnia_id);
      // Risolvi destinatario: rapporto.email_messe_a_cassa → compagnie.email_messe_a_cassa → mail → fallback
      const { data: comp } = await supabase
        .from("compagnie")
        .select("nome, email_messe_a_cassa, mail")
        .eq("id", r.compagnia_id)
        .maybeSingle();
      const { data: rapp } = await supabase
        .from("compagnia_rapporti")
        .select("email_messe_a_cassa")
        .eq("compagnia_id", r.compagnia_id)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();

      const to =
        (rapp as any)?.email_messe_a_cassa?.trim() ||
        (comp as any)?.email_messe_a_cassa?.trim() ||
        (comp as any)?.mail?.trim() ||
        r.mail?.trim() ||
        "pscarpelli@consulbrokers.it";

      const ragSoc = (comp as any)?.nome || r.nome;
      const oggi = format(new Date(), "dd/MM/yyyy");
      const periodoTxt =
        filters.periodo_dal && filters.periodo_al
          ? `per il periodo ${format(filters.periodo_dal, "dd/MM/yyyy")} - ${format(filters.periodo_al, "dd/MM/yyyy")}`
          : `aggiornato al ${oggi}`;

      const subject = `Estratto Conto Agenzia — ${ragSoc} — ${oggi}`;
      const body = `Spett.le ${ragSoc},

trasmettiamo l'estratto conto relativo ai titoli in attesa di rimessa ${periodoTxt}.

Numero titoli: ${r.titoli.length}
Totale lordo: ${fmtEuro(r.lordo)}
Totale provvigioni: ${fmtEuro(r.provvigioni)}
Totale da rimettere: ${fmtEuro(daRimettere)}

Per il dettaglio analitico vi invieremo a breve il documento PDF.

Restiamo a disposizione per ogni chiarimento.

Cordiali saluti,
Consulbrokers`;

      const { error } = await supabase.functions.invoke("send-email", {
        body: { to, subject, html: body, apply_branding: true },
      });
      if (error) throw error;

      // Log best-effort
      try {
        await supabase.from("log_attivita").insert({
          azione: "invio_ec_agenzia_email",
          entita_tipo: "agenzia",
          entita_id: r.compagnia_id,
          dettagli_json: {
            destinatario: to,
            num_titoli: r.titoli.length,
            totale_lordo: r.lordo,
            totale_provvigioni: r.provvigioni,
            da_rimettere: daRimettere,
          },
        } as any);
      } catch {}

      toast.success(`Email inviata a ${to}`);
    } catch (e: any) {
      toast.error("Errore invio email: " + (e?.message || e));
    } finally {
      setSendingEmailId(null);
    }
  };

  const toggleExpand = (compagniaId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(compagniaId)) next.delete(compagniaId);
      else next.add(compagniaId);
      return next;
    });
  };

  const toggleTitolo = (compagniaId: string, titoloId: string) => {
    setSelectedTitoli((prev) => {
      const current = new Set(prev[compagniaId] || []);
      if (current.has(titoloId)) current.delete(titoloId);
      else current.add(titoloId);
      return { ...prev, [compagniaId]: current };
    });
  };

  const toggleAllTitoli = (compagniaId: string, titoli: TitoloDetail[]) => {
    setSelectedTitoli((prev) => {
      const current = prev[compagniaId] || new Set();
      const allSelected = titoli.every((t) => current.has(t.id));
      if (allSelected) {
        return { ...prev, [compagniaId]: new Set() };
      }
      return { ...prev, [compagniaId]: new Set(titoli.map((t) => t.id)) };
    });
  };

  const { data: compagnie } = useQuery({
    queryKey: ["agenzie-ec"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome, codice, comune, mail, iban").eq("attiva", true).order("nome");
      return data || [];
    },
  });
  const { data: uffici } = useQuery({
    queryKey: ["uffici-ec"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return data || [];
    },
  });
  const { data, isLoading } = useQuery({
    queryKey: ["ec-agenzia-contab", filters],
    queryFn: async () => {
      // Fetch titoli already in rimessa_dettaglio to exclude them
      const { data: rimessiRaw } = await supabase
        .from("rimessa_dettaglio")
        .select("titolo_id");
      const rimessiSet = new Set((rimessiRaw || []).map((r) => r.titolo_id));

      let query = supabase
        .from("titoli")
        .select("id, numero_titolo, premio_lordo, importo_incassato, compagnia_id, ufficio_id, produttore_id, data_messa_cassa, data_copertura, provvigioni_firma, provvigioni_quietanza, sostituisce_polizza, conferimento_gestito, fondi_ricevuti, tipo_pagamento, pag_diretto_compagnia, coassicurazione, compagnie(nome, codice, mail)")
        .not("compagnia_id", "is", null);

      const incassateBase = ["stato.eq.incassato"];
      const coperturaBase = ["stato.eq.attivo", "conferimento_gestito.eq.true", "data_copertura.not.is.null", "data_messa_cassa.is.null"];
      if (filters.periodo_dal) {
        const dal = format(filters.periodo_dal, "yyyy-MM-dd");
        incassateBase.push(`data_messa_cassa.gte.${dal}`);
        coperturaBase.push(`data_copertura.gte.${dal}`);
      }
      if (filters.periodo_al) {
        const al = format(filters.periodo_al, "yyyy-MM-dd");
        incassateBase.push(`data_messa_cassa.lte.${al}`);
        coperturaBase.push(`data_copertura.lte.${al}`);
      }
      query = query.or(`and(${incassateBase.join(",")}),and(${coperturaBase.join(",")})`);

      if (filters.ufficio_id) query = query.eq("ufficio_id", filters.ufficio_id);

      const { data: titoli, error } = await query;
      if (error) throw error;

      const coassIds = (titoli || []).filter((t) => t.coassicurazione).map((t) => t.id);
      const ripartoByTitolo = new Map<string, any[]>();
      if (coassIds.length > 0) {
        const { data: riparti } = await supabase
          .from("dettaglio_riparto")
          .select("id, titolo_id, compagnia_id, quota_percentuale, totale, provv_netto, provv_addizionali, compagnie(nome, codice, mail)")
          .in("titolo_id", coassIds);
        for (const r of riparti || []) {
          const arr = ripartoByTitolo.get(r.titolo_id) || [];
          arr.push(r);
          ripartoByTitolo.set(r.titolo_id, arr);
        }
      }

      const grouped: Record<string, GroupedRow> = {};

      const pushTitoloToGroup = (
        cId: string,
        comp: { nome?: string | null; codice?: string | null; mail?: string | null } | null,
        t: any,
        lordoShare: number,
        incassatoShare: number,
        provvShare: number,
        dataEff: string | null,
      ) => {
        if (!cId) return;
        if (filters.compagnia_id && cId !== filters.compagnia_id) return;
        if (!grouped[cId]) {
          grouped[cId] = {
            compagnia_id: cId,
            nome: comp?.nome || "N/D",
            codice: comp?.codice || "",
            mail: comp?.mail || "",
            lordo: 0,
            provvigioni: 0,
            data_min: null,
            data_max: null,
            titoli: [],
          };
        }
        grouped[cId].lordo += lordoShare;
        grouped[cId].provvigioni += provvShare;
        grouped[cId].titoli.push({
          id: t.id,
          numero_titolo: t.numero_titolo,
          data_messa_cassa: t.data_messa_cassa,
          data_copertura: t.data_copertura,
          premio_lordo: lordoShare,
          importo_incassato: incassatoShare,
          conferimento_gestito: !!t.conferimento_gestito,
          fondi_ricevuti: t.fondi_ricevuti !== false,
          tipo_pagamento: t.tipo_pagamento || null,
        });
        if (dataEff) {
          if (!grouped[cId].data_min || dataEff < grouped[cId].data_min!) grouped[cId].data_min = dataEff;
          if (!grouped[cId].data_max || dataEff > grouped[cId].data_max!) grouped[cId].data_max = dataEff;
        }
      };

      for (const t of titoli || []) {
        // Exclude titles already included in a rimessa
        if (rimessiSet.has(t.id)) continue;

        if (filters.tipo_pagamento && t.tipo_pagamento !== filters.tipo_pagamento) continue;
        const dataEff = t.data_messa_cassa || t.data_copertura;

        // Pagamento diretto compagnia: il premio è stato pagato dal cliente
        // direttamente alla compagnia → il broker non deve il premio, resta
        // solo la provvigione. Escludiamo quindi il premio (e l'incassato) dall'E/C.
        const pagDiretto = !!t.pag_diretto_compagnia;

        if (t.coassicurazione && ripartoByTitolo.has(t.id)) {
          const riparti = ripartoByTitolo.get(t.id) || [];
          const premioLordo = pagDiretto ? 0 : Number(t.premio_lordo) || 0;
          const importoIncassato = pagDiretto ? 0 : Number(t.importo_incassato) || 0;
          const provvTot = getProvvigioneEC(t);
          for (const r of riparti) {
            const cId = r.compagnia_id as string;
            if (!cId) continue;
            const quota = Number(r.quota_percentuale) || 0;
            const factor = quota / 100;
            const lordoShare = pagDiretto ? 0 : (Number(r.totale) || premioLordo * factor);
            const incassatoShare = importoIncassato * factor;
            const provvShare = (Number(r.provv_netto) || 0) + (Number(r.provv_addizionali) || 0) || provvTot * factor;
            const comp = (r as any).compagnie || t.compagnie;
            pushTitoloToGroup(cId, comp, t, lordoShare, incassatoShare, provvShare, dataEff);
          }
          continue;
        }

        const cId = t.compagnia_id as string;
        if (!cId) continue;
        const comp = t.compagnie;
        pushTitoloToGroup(
          cId,
          comp,
          t,
          pagDiretto ? 0 : Number(t.premio_lordo) || 0,
          pagDiretto ? 0 : Number(t.importo_incassato) || 0,
          getProvvigioneEC(t),
          dataEff,
        );
      }
      return Object.values(grouped).sort((a, b) => b.lordo - a.lordo);
    },
  });

  const generateAndStorePdf = async (
    rimessaId: string,
    compagniaId: string,
    titoliIds: string[] | undefined,
    importoPagato: number,
    note: string,
    contoMittente: any,
    ibanDestinazione: string,
  ) => {
    try {
      // Sede Napoli
      const { data: sedeNapoli } = await supabase
        .from("uffici")
        .select("nome_ufficio, indirizzo, cap, citta, provincia, email, telefono")
        .or("nome_ufficio.ilike.%napoli%,citta.ilike.%napoli%")
        .eq("attivo", true)
        .limit(1)
        .maybeSingle();

      // Compagnia full
      const { data: compFull } = await supabase
        .from("compagnie")
        .select("nome, indirizzo, cap, comune, provincia, codice_fiscale, partita_iva, intestato_a")
        .eq("id", compagniaId)
        .maybeSingle();

      // Titoli con cliente, data
      let tq = supabase
        .from("titoli")
        .select("id, numero_titolo, premio_lordo, importo_incassato, data_messa_cassa, clienti(ragione_sociale, nome, cognome)")
        .eq("compagnia_id", compagniaId)
        .eq("stato", "incassato");
      if (titoliIds && titoliIds.length) tq = tq.in("id", titoliIds);
      const { data: titoliRows } = await tq;

      const titoli = (titoliRows || []).map((t: any) => {
        const c = t.clienti;
        const cliente = c?.ragione_sociale || `${c?.cognome || ""} ${c?.nome || ""}`.trim() || "—";
        return {
          numero_titolo: t.numero_titolo || "—",
          cliente,
          premio_lordo: Number(t.premio_lordo) || 0,
          importo_incassato: Number(t.importo_incassato) || 0,
          importo_rimessa: Number(t.importo_incassato) || 0,
          data_messa_cassa: t.data_messa_cassa,
        };
      });

      const pdfData: RimessaPdfData = {
        numeroRimessa: rimessaId.slice(0, 8).toUpperCase(),
        dataDocumento: format(new Date(), "dd/MM/yyyy"),
        sedeNome: sedeNapoli?.nome_ufficio || "Sede di Napoli",
        sedeIndirizzo: sedeNapoli?.indirizzo || "Via Mergellina, 2",
        sedeCap: sedeNapoli?.cap || "80122",
        sedeCitta: sedeNapoli?.citta || "Napoli",
        sedeProvincia: sedeNapoli?.provincia || "NA",
        sedeEmail: sedeNapoli?.email || undefined,
        sedeTelefono: sedeNapoli?.telefono || undefined,
        contoMittenteEtichetta: contoMittente?.etichetta || "",
        contoMittenteIban: contoMittente?.iban || "",
        contoMittenteIntestatoA: contoMittente?.intestato_a || "",
        contoMittenteBanca: contoMittente?.banca || undefined,
        agenziaNome: compFull?.nome || "",
        agenziaIndirizzo: compFull?.indirizzo || undefined,
        agenziaCap: compFull?.cap || undefined,
        agenziaCitta: compFull?.comune || undefined,
        agenziaProvincia: compFull?.provincia || undefined,
        agenziaCF: compFull?.codice_fiscale || undefined,
        agenziaPIVA: compFull?.partita_iva || undefined,
        ibanDestinazione: ibanDestinazione || undefined,
        intestatoADestinazione: compFull?.intestato_a || undefined,
        titoli,
        importoPagato,
        note: note || undefined,
      };

      const bytes = await buildRimessaPdf(pdfData);
      const path = `${rimessaId}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("rimesse-pdf")
        .upload(path, new Blob([bytes as BlobPart], { type: "application/pdf" }), { upsert: true, contentType: "application/pdf" });
      if (upErr) throw upErr;

      const { data: signed } = await supabase.storage.from("rimesse-pdf").createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl || path;

      await supabase.from("rimessa_premi").update({ pdf_url: url } as any).eq("id", rimessaId);

      // Apri il PDF
      const blobUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      window.open(blobUrl, "_blank");
    } catch (err: any) {
      console.error("[generateAndStorePdf]", err);
      toast.error("Rimessa salvata ma errore generazione PDF: " + (err.message || ""));
    }
  };

  const creaRimessaMutation = useMutation({
    mutationFn: async ({ compagniaId, titoliIds, ibanMittente, contoMittenteId, importoPagato, note }: { compagniaId: string; titoliIds?: string[]; ibanMittente: string; contoMittenteId: string; importoPagato: number; note: string }) => {
      const { data, error } = await supabase.functions.invoke("gestione-rimessa", {
        body: {
          action: "crea",
          compagnia_id: compagniaId,
          ufficio_id: profile?.ufficio_id || null,
          created_by: user?.id || null,
          data_da: filters.periodo_dal ? format(filters.periodo_dal, "yyyy-MM-dd") : undefined,
          data_a: filters.periodo_al ? format(filters.periodo_al, "yyyy-MM-dd") : undefined,
          titoli_ids: titoliIds || undefined,
          iban_utilizzato: ibanMittente,
          conto_bancario_mittente_id: contoMittenteId,
          importo_pagato: importoPagato,
          note: note || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (data, variables) => {
      const rimessaId = data?.rimessa?.id;
      const conto = contiMittente.find((c: any) => c.id === variables.contoMittenteId);
      // Genera e salva PDF prima di navigare
      if (rimessaId && conto) {
        await generateAndStorePdf(
          rimessaId,
          variables.compagniaId,
          variables.titoliIds,
          variables.importoPagato,
          variables.note,
          conto,
          pagaDialog.iban,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["ec-agenzia-contab"] });
      queryClient.invalidateQueries({ queryKey: ["rimessa_premi"] });
      queryClient.invalidateQueries({ queryKey: ["storico-rimesse"] });
      setSelectedTitoli((prev) => ({ ...prev, [variables.compagniaId]: new Set() }));
      setPagaDialog((prev) => ({ ...prev, open: false }));
      toast.success(`Rimessa pagata — ${data.titoli_count} titoli inclusi`);
      navigate("/contabilita/storico-rimesse");
    },
    onError: (e: any) => toast.error(e.message || "Errore nella creazione della rimessa"),
  });

  const mettiInPagamentoMutation = useMutation({
    mutationFn: async ({ compagniaId, titoliIds, note }: { compagniaId: string; titoliIds?: string[]; note: string }) => {
      const { data, error } = await supabase.functions.invoke("gestione-rimessa", {
        body: {
          action: "metti_in_pagamento",
          compagnia_id: compagniaId,
          ufficio_id: profile?.ufficio_id || null,
          created_by: user?.id || null,
          data_da: filters.periodo_dal ? format(filters.periodo_dal, "yyyy-MM-dd") : undefined,
          data_a: filters.periodo_al ? format(filters.periodo_al, "yyyy-MM-dd") : undefined,
          titoli_ids: titoliIds || undefined,
          note: note || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ec-agenzia-contab"] });
      queryClient.invalidateQueries({ queryKey: ["agenzie-in-pagamento"] });
      setSelectedTitoli((prev) => ({ ...prev, [variables.compagniaId]: new Set() }));
      setPagaDialog((prev) => ({ ...prev, open: false }));
      toast.success(`Rimessa preparata — ${data.titoli_count} titoli inclusi`);
      navigate("/contabilita/ec-agenzia/in-pagamento");
    },
    onError: (e: any) => toast.error(e.message || "Errore"),
  });

  const handleOpenPagaDialog = (compagniaId: string, daRimettere: number, titoli: TitoloDetail[]) => {
    const selected = selectedTitoli[compagniaId];
    const titoliIds = selected && selected.size > 0 ? Array.from(selected) : undefined;
    const count = titoliIds ? titoliIds.length : titoli.length;
    const comp = compagnie?.find((c) => c.id === compagniaId);

    setPagaDialog({
      open: true,
      compagniaId,
      compagniaNome: comp?.nome || "N/D",
      iban: formatIbanMask(comp?.iban || ""),
      contoMittenteId: contoMittenteDefault?.id || null,
      ibanMittente: contoMittenteDefault?.iban || "",
      importoTotale: daRimettere,
      importoPagato: daRimettere.toFixed(2),
      note: "",
      titoliIds,
      titoliCount: count,
      titoli,
    });
  };

  const handleConfermaPagamento = () => {
    if (isAgenzia) {
      // Flusso a 3 stadi: solo crea bozza in_pagamento
      mettiInPagamentoMutation.mutate({
        compagniaId: pagaDialog.compagniaId,
        titoliIds: pagaDialog.titoliIds,
        note: pagaDialog.note,
      });
      return;
    }
    const importo = parseFloat(pagaDialog.importoPagato);
    if (isNaN(importo) || importo <= 0) { toast.error("Inserire un importo valido"); return; }
    if (importo > pagaDialog.importoTotale) { toast.error("L'importo pagato non può superare l'importo da rimettere"); return; }
    if (!pagaDialog.contoMittenteId || !pagaDialog.ibanMittente) {
      toast.error("Selezionare il conto Consulbrokers da cui parte il pagamento");
      return;
    }
    const ibanCheck = validateIban(pagaDialog.iban);
    if (!ibanCheck.valid) { toast.error(ibanCheck.error || "IBAN destinazione non valido"); return; }
    creaRimessaMutation.mutate({
      compagniaId: pagaDialog.compagniaId,
      titoliIds: pagaDialog.titoliIds,
      ibanMittente: pagaDialog.ibanMittente,
      contoMittenteId: pagaDialog.contoMittenteId,
      importoPagato: importo,
      note: pagaDialog.note,
    });
  };

  const rows = data || [];
  const totLordo = rows.reduce((s, r) => s + r.lordo, 0);
  const totProvv = rows.reduce((s, r) => s + r.provvigioni, 0);
  const totDaRimettere = totLordo - totProvv;
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  const hasFilters = filters.compagnia_id || filters.ufficio_id || filters.periodo_dal || filters.periodo_al || filters.tipo_pagamento;

  const formatDateRange = (min: string | null, max: string | null) => {
    if (!min) return "—";
    const fmtD = (d: string) => format(new Date(d), "dd/MM/yyyy");
    if (!max || min === max) return fmtD(min);
    return `${fmtD(min)} – ${fmtD(max)}`;
  };

  // Righe filtrate per export: se è impostata exportDate usa solo quella come limite "al"
  const exportRows = useMemo(() => {
    if (!exportDate) return rows;
    const al = format(exportDate, "yyyy-MM-dd");
    return rows.map((r) => ({
      ...r,
      titoli: r.titoli.filter((t) => {
        const d = t.data_messa_cassa || t.data_copertura;
        return !d || d <= al;
      }),
    })).filter((r) => r.titoli.length > 0)
      .map((r) => {
        const lordo = r.titoli.reduce((s, t) => s + t.premio_lordo, 0);
        const provv = r.provvigioni * (lordo / (r.lordo || 1));
        return { ...r, lordo, provvigioni: provv };
      });
  }, [rows, exportDate]);

  const exportCSV = () => {
    const src = exportRows;
    const header = "Agenzia,Codice,Data,Mail,Lordo,Provvigioni,Da Rimettere\n";
    const csv = src.map((r) => `"${r.nome}","${r.codice}","${formatDateRange(r.data_min, r.data_max)}","${r.mail}",${r.lordo.toFixed(2)},${r.provvigioni.toFixed(2)},${(r.lordo - r.provvigioni).toFixed(2)}`).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ec_agenzie.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const src = exportRows;
    const wb = XLSX.utils.book_new();
    const dateLimitLabel = exportDate ? ` fino al ${format(exportDate, "dd/MM/yyyy")}` : "";

    // Foglio 1: riepilogo per agenzia
    const riepilogo = src.map((r) => ({
      Agenzia: r.nome,
      Codice: r.codice,
      "Periodo Dal": r.data_min ? format(new Date(r.data_min), "dd/MM/yyyy") : "",
      "Periodo Al": r.data_max ? format(new Date(r.data_max), "dd/MM/yyyy") : "",
      Mail: r.mail,
      "Totale Lordo (€)": Number(r.lordo.toFixed(2)),
      "Provvigioni (€)": Number(r.provvigioni.toFixed(2)),
      "Da Rimettere (€)": Number((r.lordo - r.provvigioni).toFixed(2)),
    }));
    const wsRiepilogo = XLSX.utils.json_to_sheet(riepilogo);
    wsRiepilogo["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsRiepilogo, "Riepilogo Agenzie");

    // Foglio 2: dettaglio titoli per agenzia
    const dettaglio = src.flatMap((r) =>
      r.titoli.map((t) => ({
        Agenzia: r.nome,
        Codice: r.codice,
        "N. Titolo": t.numero_titolo || "",
        "Data Messa a Cassa": t.data_messa_cassa ? format(new Date(t.data_messa_cassa), "dd/MM/yyyy") : (t.data_copertura ? format(new Date(t.data_copertura), "dd/MM/yyyy") : ""),
        "Premio Lordo (€)": Number(t.premio_lordo.toFixed(2)),
        "Importo Incassato (€)": Number(t.importo_incassato.toFixed(2)),
        "Tipo Pagamento": t.tipo_pagamento || "",
        "Copertura Garantita": t.conferimento_gestito ? "Sì" : "No",
      }))
    );
    const wsDettaglio = XLSX.utils.json_to_sheet(dettaglio);
    wsDettaglio["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsDettaglio, "Dettaglio Titoli");

    const fileName = `ec_agenzie${dateLimitLabel.replace(/ /g, "_").replace(/\//g, "-")}_${format(new Date(), "yyyyMMdd")}.xlsx`;
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 200);
  };

  const exportPDF = () => {
    const src = exportRows;
    const dateLimitLabel = exportDate ? `fino al ${format(exportDate, "dd/MM/yyyy")}` : `aggiornato al ${format(new Date(), "dd/MM/yyyy")}`;
    const totL = src.reduce((s, r) => s + r.lordo, 0);
    const totP = src.reduce((s, r) => s + r.provvigioni, 0);
    const totD = totL - totP;

    const rows_html = src.map((r) => {
      const dr = r.lordo - r.provvigioni;
      const titoli_html = r.titoli.map((t) => {
        const d = t.data_messa_cassa || t.data_copertura;
        return `<tr class="detail">
          <td></td><td>${t.numero_titolo || "—"}</td>
          <td>${d ? format(new Date(d), "dd/MM/yyyy") : "—"}</td>
          <td class="num">${fmt(t.premio_lordo)}</td>
          <td class="num">${fmt(t.importo_incassato)}</td>
          <td>${t.tipo_pagamento || "—"}</td>
          <td></td>
        </tr>`;
      }).join("");
      return `<tr class="group-row">
        <td><strong>${r.nome}</strong></td>
        <td>${r.codice}</td>
        <td>${formatDateRange(r.data_min, r.data_max)}</td>
        <td class="num">${fmt(r.lordo)}</td>
        <td class="num">${fmt(r.provvigioni)}</td>
        <td class="num teal"><strong>${fmt(dr)}</strong></td>
        <td>${r.titoli.length} titoli</td>
      </tr>${titoli_html}`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
    <title>E/C Agenzie — ${dateLimitLabel}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #111; }
      h1 { font-size: 16px; margin-bottom: 2px; }
      .subtitle { color: #666; font-size: 11px; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { background: #f0f0f0; border: 1px solid #ccc; padding: 5px 8px; text-align: left; font-size: 10px; }
      td { border: 1px solid #ddd; padding: 4px 8px; }
      tr.group-row td { background: #fafafa; font-weight: 500; }
      tr.detail td { background: #fff; font-size: 10px; color: #444; }
      tr.detail td:first-child { border: none; }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      .teal { color: #0d9488; }
      tfoot tr td { background: #e8f4f3; font-weight: bold; border-top: 2px solid #0d9488; }
      @media print { body { margin: 10mm; } }
    </style></head><body>
    <h1>E/C Agenzie</h1>
    <div class="subtitle">Estratto conto — ${dateLimitLabel}</div>
    <table>
      <thead><tr>
        <th>Agenzia</th><th>Codice</th><th>Periodo</th>
        <th class="num">Lordo</th><th class="num">Provvigioni</th>
        <th class="num">Da Rimettere</th><th>Titoli</th>
      </tr></thead>
      <tbody>${rows_html}</tbody>
      <tfoot><tr>
        <td colspan="3"><strong>TOTALE (${src.length} agenzie)</strong></td>
        <td class="num">${fmt(totL)}</td>
        <td class="num">${fmt(totP)}</td>
        <td class="num teal">${fmt(totD)}</td>
        <td></td>
      </tr></tfoot>
    </table>
    <script>window.onload = () => window.print();</script>
    </body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const kpiCards = [
    { label: "N. Agenzie", value: rows.length.toString(), icon: Building2, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
    { label: "Totale Lordo", value: fmt(totLordo), icon: TrendingUp, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" },
    { label: "Totale Provvigioni", value: fmt(totProvv), icon: Percent, color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
    { label: "Da Rimettere", value: fmt(totDaRimettere), icon: Scale, color: "text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">E/C Agenzie</h1>
            <p className="text-sm text-muted-foreground">Estratto conto verso agenzie/plurimandatarie — solo titoli ancora da rimettere</p>
          </div>
        </div>
        {/* Toolbar export: data limite + pulsanti */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 border rounded-md px-2 py-1 bg-background">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">Fino al</span>
            <DatePicker value={exportDate} onChange={setExportDate} placeholder="Tutte le date" />
            {exportDate && (
              <button className="ml-1 text-muted-foreground hover:text-foreground" onClick={() => setExportDate(null)} title="Rimuovi limite data">✕</button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!rows.length}>
                <Download className="mr-2 h-4 w-4" /> Esporta <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" /> Excel (riepilogo + dettaglio)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF}>
                <Printer className="mr-2 h-4 w-4 text-red-500" /> PDF / Stampa (tutte le agenzie)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportCSV}>
                <Download className="mr-2 h-4 w-4" /> CSV (riepilogo)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}><CardContent className="p-4 flex items-center gap-4">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", kpi.color)}><kpi.icon className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">{kpi.label}</p><p className="text-lg font-bold">{isLoading ? "..." : kpi.value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" /> <span>Filtri</span>
          {hasFilters && <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => setFilters({ ...defaultFilters })}><RotateCcw className="h-3 w-3 mr-1" /> Azzera</Button>}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <FilterSearchableSelect
            value={filters.compagnia_id}
            onValueChange={(v) => set({ compagnia_id: v })}
            options={(compagnie || []).map((c) => ({
              value: c.id,
              label: c.nome,
              description: c.codice || undefined,
              searchText: `${c.nome} ${c.codice || ""}`.trim(),
            }))}
            placeholder="Agenzia"
            allLabel="Tutte le agenzie"
            className="w-[240px]"
          />
          <FilterSearchableSelect value={filters.ufficio_id} onValueChange={(v) => set({ ufficio_id: v })} options={(uffici || []).map((u) => ({ value: u.id, label: u.nome_ufficio }))} placeholder="Sede" allLabel="Tutte le sedi" className="w-[200px]" />
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Periodo dal</Label><DatePicker value={filters.periodo_dal} onChange={(d) => set({ periodo_dal: d })} placeholder="Dal" /></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Periodo al</Label><DatePicker value={filters.periodo_al} onChange={(d) => set({ periodo_al: d })} placeholder="Al" /></div>
          <FilterSearchableSelect value={filters.tipo_pagamento} onValueChange={(v) => set({ tipo_pagamento: v })} options={[{ value: "contanti", label: "Contanti" }, { value: "pos", label: "POS" }, { value: "bonifico", label: "Bonifico" }, { value: "abbuono", label: "Abbuono" }, { value: "pagamento_diretto_compagnia", label: "Pag. diretto compagnia" }]} placeholder="Tipo Pagamento" allLabel="Tutti i pagamenti" className="w-[180px]" />
          
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Agenzia</TableHead><TableHead>Codice</TableHead><TableHead>Data</TableHead>
            <TableHead className="text-right">Lordo</TableHead><TableHead className="text-right">Provvigioni</TableHead>
            <TableHead className="text-right">Da Rimettere</TableHead>
            <TableHead className="w-[260px]">Azioni</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nessun titolo da rimettere</TableCell></TableRow>
            ) : rows.map((r) => {
              const daRimettere = r.lordo - r.provvigioni;
              const isExpanded = expandedRows.has(r.compagnia_id);
              const selected = selectedTitoli[r.compagnia_id] || new Set();
              const selectedCount = selected.size;
              return (
                <>
                  <TableRow key={r.compagnia_id} className="cursor-pointer" onClick={() => toggleExpand(r.compagnia_id)}>
                    <TableCell className="px-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell>{r.codice}</TableCell>
                    <TableCell className="text-sm">{formatDateRange(r.data_min, r.data_max)}</TableCell>
                    <TableCell className="text-right">{fmt(r.lordo)}</TableCell>
                    <TableCell className="text-right">{fmt(r.provvigioni)}</TableCell>
                    <TableCell className="text-right font-semibold text-teal-600 dark:text-teal-400">{fmt(daRimettere)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          title="Stampa Estratto Conto Agenzia"
                          onClick={() => {
                            const sel = selectedTitoli[r.compagnia_id];
                            const ids = sel && sel.size > 0 ? Array.from(sel).join(",") : "";
                            const qs = new URLSearchParams({ compagniaId: r.compagnia_id });
                            if (ids) qs.set("titoliIds", ids);
                            if (filters.periodo_dal) qs.set("periodoDal", format(filters.periodo_dal, "yyyy-MM-dd"));
                            if (filters.periodo_al) qs.set("periodoAl", format(filters.periodo_al, "yyyy-MM-dd"));
                            navigate(`/contabilita/ec-agenzia/pdf?${qs.toString()}`);
                          }}
                        >
                          <FileText className="h-3 w-3" /> Stampa E/C
                        </Button>
                        {isAgenzia && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            title="Invia Estratto Conto via email all'agenzia"
                            disabled={sendingEmailId === r.compagnia_id}
                            onClick={() => handleInviaEmail(r, daRimettere)}
                          >
                            {sendingEmailId === r.compagnia_id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Mail className="h-3 w-3" />
                            )}
                            Invia Mail
                          </Button>
                        )}
                        {daRimettere > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            disabled={creaRimessaMutation.isPending || mettiInPagamentoMutation.isPending}
                            onClick={() => handleOpenPagaDialog(r.compagnia_id, daRimettere, r.titoli)}
                          >
                            {isAgenzia ? <Send className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}
                            {isAgenzia
                              ? (selectedCount > 0 ? `Metti in pagamento (${selectedCount})` : "Metti in pagamento")
                              : (selectedCount > 0 ? `Paga (${selectedCount})` : "Paga Rimessa")}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${r.compagnia_id}-header`} className="bg-muted/30 hover:bg-muted/30">
                      <TableCell></TableCell>
                      <TableCell colSpan={7}>
                        <div className="py-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Checkbox
                              checked={r.titoli.length > 0 && r.titoli.every((t) => selected.has(t.id))}
                              onCheckedChange={() => toggleAllTitoli(r.compagnia_id, r.titoli)}
                            />
                            <span className="text-xs font-medium text-muted-foreground">Seleziona tutti ({r.titoli.length} titoli)</span>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[40px] h-8"></TableHead>
                                <TableHead className="h-8 text-xs">N. Titolo</TableHead>
                                {!isAgenzia && <TableHead className="h-8 text-xs">Data Messa a Cassa</TableHead>}
                                <TableHead className="h-8 text-xs text-right">Premio Lordo</TableHead>
                                <TableHead className="h-8 text-xs text-right">Importo Incassato</TableHead>
                                <TableHead className="h-8 text-xs">Tipo Pagamento</TableHead>
                                {!isAgenzia && <TableHead className="h-8 text-xs">Modalità Incasso</TableHead>}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {r.titoli.map((t) => {
                                const inCopertura = isInCoperturaGarantita(t);
                                const dataEff = t.data_messa_cassa || t.data_copertura;
                                const tipoPagLabel = t.tipo_pagamento === "contanti" ? "Contanti" : t.tipo_pagamento === "pos" ? "POS" : t.tipo_pagamento === "bonifico" ? "Bonifico" : t.tipo_pagamento === "carta_credito" ? "POS" : t.tipo_pagamento === "garantito" ? "Garantito" : t.tipo_pagamento === "abbuono" ? "Abbuono" : t.tipo_pagamento === "pagamento_diretto_compagnia" ? "Pag. diretto" : "—";
                                const tipoPagColor = t.tipo_pagamento === "contanti" ? "secondary" : t.tipo_pagamento === "pos" || t.tipo_pagamento === "carta_credito" ? "default" : t.tipo_pagamento === "bonifico" ? "outline" : t.tipo_pagamento === "garantito" ? "default" : t.tipo_pagamento === "pagamento_diretto_compagnia" ? "outline" : "secondary";
                                return (
                                <TableRow key={t.id} className={cn("hover:bg-muted/50", inCopertura && "bg-orange-50/80 hover:bg-orange-100/60")}>
                                  <TableCell className="py-1 px-2">
                                    <Checkbox
                                      checked={selected.has(t.id)}
                                      onCheckedChange={() => toggleTitolo(r.compagnia_id, t.id)}
                                    />
                                  </TableCell>
                                  <TableCell className="py-1 text-sm">{t.numero_titolo || "—"}</TableCell>
                                  {!isAgenzia && (
                                    <TableCell className="py-1 text-sm">{dataEff ? format(new Date(dataEff), "dd/MM/yyyy") : "—"}</TableCell>
                                  )}
                                  <TableCell className="py-1 text-sm text-right">{fmt(t.premio_lordo)}</TableCell>
                                  <TableCell className="py-1 text-sm text-right">{fmt(t.importo_incassato)}</TableCell>
                                  <TableCell className="py-1">
                                    <Badge variant={tipoPagColor as any} className="text-[10px] h-5">{tipoPagLabel}</Badge>
                                  </TableCell>
                                  {!isAgenzia && (
                                    <TableCell className="py-1">
                                      {t.conferimento_gestito ? (
                                        <Badge variant={t.fondi_ricevuti ? "default" : "destructive"} className="text-[10px] h-5">
                                          {t.fondi_ricevuti ? "Cop. Garantita ✓" : "In Attesa Fondi"}
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-[10px] h-5">Incasso diretto</Badge>
                                      )}
                                    </TableCell>
                                  )}
                                </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
          {rows.length > 0 && <TableFooter><TableRow>
            <TableCell></TableCell>
            <TableCell colSpan={3} className="font-bold">Totale</TableCell>
            <TableCell className="text-right font-bold">{fmt(totLordo)}</TableCell><TableCell className="text-right font-bold">{fmt(totProvv)}</TableCell>
            <TableCell className="text-right font-bold text-teal-600 dark:text-teal-400">{fmt(totDaRimettere)}</TableCell>
            <TableCell></TableCell>
          </TableRow></TableFooter>}
        </Table>
      </div>

      {/* Dialog Conferma & Paga Rimessa (unico step) */}
      <Dialog open={pagaDialog.open} onOpenChange={(open) => setPagaDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {isAgenzia ? <Send className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
              </span>
              {isAgenzia ? "Metti in pagamento" : "Conferma Rimessa & Genera PDF"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isAgenzia
                ? "Crea una bozza di rimessa che potrai gestire dalla pagina Agenzie in Pagamento."
                : "Conferma il pagamento della rimessa e genera il PDF della distinta."}
            </DialogDescription>
          </DialogHeader>

          {/* Riepilogo compagnia */}
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold truncate">{pagaDialog.compagniaNome}</span>
              <Badge variant="secondary" className="shrink-0">{pagaDialog.titoliCount} titoli</Badge>
            </div>
            <span className="font-semibold text-primary shrink-0">{fmt(pagaDialog.importoTotale)}</span>
          </div>

          <div className="space-y-5 py-1">
            {!isAgenzia && (
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Coordinate bonifico
              </h3>

              <div className="space-y-2">
                <Label>Conto Consulbrokers (mittente)</Label>
                <SearchableSelect
                  options={contiMittente.map((c: any) => ({
                    value: c.id,
                    label: `${c.etichetta}${c.is_default ? " ⭐" : ""}`,
                    description: c.iban,
                    searchText: c.iban,
                  }))}
                  value={pagaDialog.contoMittenteId || ""}
                  onValueChange={(id) => {
                    const c = contiMittente.find((x: any) => x.id === id);
                    setPagaDialog((prev) => ({
                      ...prev,
                      contoMittenteId: id || null,
                      ibanMittente: c?.iban || "",
                    }));
                  }}
                  placeholder="— Seleziona conto —"
                  searchPlaceholder="Cerca conto o IBAN..."
                />
                {pagaDialog.ibanMittente && (
                  <p className="text-xs font-mono text-muted-foreground pl-1">
                    <span className="opacity-70">IBAN:</span> {pagaDialog.ibanMittente}
                  </p>
                )}
                {contiMittente.length === 0 && (
                  <Alert variant="default" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Nessun conto Consulbrokers (tipo "generico") configurato. Aggiungili in Anagrafiche → Conti bancari.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {(() => {
                const ibanCheck = validateIban(pagaDialog.iban);
                const showError = pagaDialog.iban.trim().length > 0 && !ibanCheck.valid;
                return (
                  <div className="space-y-2">
                    <Label>IBAN Agenzia (destinazione)</Label>
                    <div className="relative">
                      <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={pagaDialog.iban}
                        onChange={(e) =>
                          setPagaDialog((prev) => ({ ...prev, iban: formatIbanMask(e.target.value) }))
                        }
                        placeholder="IT60 X054 2811 1010 0000 0123 456"
                        maxLength={42}
                        autoCapitalize="characters"
                        spellCheck={false}
                        className={cn(
                          "pl-9 font-mono tracking-wider",
                          showError && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                    </div>
                    {!pagaDialog.iban.trim() ? (
                      <Alert variant="default" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          IBAN non trovato per questa compagnia. Inserirlo manualmente.
                        </AlertDescription>
                      </Alert>
                    ) : showError ? (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {ibanCheck.error}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">IBAN valido ✓</p>
                    )}
                  </div>
                );
              })()}
            </div>
            )}
            {!isAgenzia && (
            <>
            {(() => {
              const importoNum = parseFloat(pagaDialog.importoPagato);
              const importoInvalid = pagaDialog.importoPagato.trim() === "" || isNaN(importoNum) || importoNum <= 0;
              const importoOver = !isNaN(importoNum) && importoNum > pagaDialog.importoTotale;
              const importoError = importoInvalid
                ? "Inserire un importo maggiore di 0"
                : importoOver
                  ? `Massimo consentito ${fmt(pagaDialog.importoTotale)}`
                  : null;
              const isParziale = !importoError && importoNum < pagaDialog.importoTotale;
              return (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Da rimettere
                      </Label>
                      <p className="text-xl font-bold text-primary leading-tight">
                        {fmt(pagaDialog.importoTotale)}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-card p-3 space-y-1">
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Da pagare
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={pagaDialog.importoTotale}
                          value={pagaDialog.importoPagato}
                          onChange={(e) => setPagaDialog((prev) => ({ ...prev, importoPagato: e.target.value }))}
                          className={cn(
                            "h-8 pr-7 text-base font-semibold",
                            importoError && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        <Euro className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                  {importoError ? (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {importoError}
                    </p>
                  ) : isParziale ? (
                    <Alert variant="default" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Pagamento parziale — rimarranno{" "}
                        <span className="font-semibold">{fmt(pagaDialog.importoTotale - importoNum)}</span> da pagare.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </>
              );
            })()}
            </>
            )}

            <div className="space-y-2">
              <Label>Note (opzionale)</Label>
              <Textarea
                value={pagaDialog.note}
                onChange={(e) => setPagaDialog((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Es. Bonifico mensile periodo..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPagaDialog((prev) => ({ ...prev, open: false }))}>
              Annulla
            </Button>
            {(() => {
              if (isAgenzia) {
                const isPending = mettiInPagamentoMutation.isPending;
                return (
                  <Button onClick={handleConfermaPagamento} disabled={isPending || pagaDialog.titoliCount === 0}>
                    {isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Preparazione...</>
                    ) : (
                      <><Send className="h-4 w-4 mr-2" /> Metti in pagamento</>
                    )}
                  </Button>
                );
              }
              const importoNum = parseFloat(pagaDialog.importoPagato);
              const importoOk = !isNaN(importoNum) && importoNum > 0 && importoNum <= pagaDialog.importoTotale;
              const ibanOk = validateIban(pagaDialog.iban).valid;
              const contoOk = !!pagaDialog.contoMittenteId && !!pagaDialog.ibanMittente;
              const canSubmit = importoOk && ibanOk && contoOk && !creaRimessaMutation.isPending;
              return (
                <Button onClick={handleConfermaPagamento} disabled={!canSubmit}>
                  {creaRimessaMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generazione...</>
                  ) : (
                    <><FileText className="h-4 w-4 mr-2" /> Conferma e Genera PDF</>
                  )}
                </Button>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ECCompagniaContabPage;
