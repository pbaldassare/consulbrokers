import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { annullaMessaACassa } from "@/lib/annullaMessaACassa";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, FileText, Percent, Clock, ExternalLink, ChevronDown, Calendar, Shield, DollarSign, RefreshCw, LayoutGrid, List, Users, ShieldCheck, StickyNote, Car, UserCheck, CheckSquare, Copy, ArrowRightLeft, XCircle, Download, Eye, Trash2, Pencil } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import DocumentiTab from "@/components/DocumentiTab";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/SearchableSelect";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";


const fmt = (v: any) => v ?? "—";
const fmtDate = (v: string | null) => v ? format(new Date(v), "dd/MM/yyyy", { locale: it }) : "—";
const fmtEuro = (v: number | null) => v != null ? `€ ${v.toFixed(2)}` : "—";
const fmtBool = (v: boolean | null) => v ? "Sì" : "No";

const FieldRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between py-1">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-mono text-right">{value}</span>
  </div>
);

const SectionCollapsible = ({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 px-4 py-2.5 bg-primary/5 border border-border rounded-t-lg hover:bg-primary/10 transition-colors">
          <Icon className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold uppercase text-primary">{title}</span>
          <ChevronDown className={`w-4 h-4 ml-auto text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border border-t-0 border-border rounded-b-lg p-4">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const TitoloDetail = () => {
  // v2 - regolazione editabile
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();

  // --- Annulla Incasso dialog state ---
  const [annullaDialogOpen, setAnnullaDialogOpen] = useState(false);
  const [annullaPassword, setAnnullaPassword] = useState("");
  const [annullaLoading, setAnnullaLoading] = useState(false);

  // --- Conferimento Gestito dialog state ---
  const [conferimentoDialogOpen, setConferimentoDialogOpen] = useState(false);
  const [conferimentoAccettato, setConferimentoAccettato] = useState(false);
  const [conferimentoForm, setConferimentoForm] = useState({ dataMessaCassa: "", dataPagamento: "", dataDecorrenza: "", tipoPagamento: "contanti", banca: "" });

  const { data: titolo, isLoading } = useQuery({
    queryKey: ["titolo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("*, prodotti(nome_prodotto, compagnie(nome)), uffici(nome_ufficio), produttore:profiles!titoli_produttore_id_fkey(nome, cognome, ruolo), cliente:profiles!titoli_cliente_id_fkey(nome, cognome), cliente_anagrafica:clienti!titoli_cliente_anagrafica_id_fkey(id, tipo_cliente, nome, cognome, ragione_sociale, attivita, gruppo_statistico, gruppo_finanziario_id, gruppi_finanziari(nome)), compagnia_diretta:compagnie!titoli_compagnia_id_fkey(id, nome, codice), ramo:rami!titoli_ramo_id_fkey(id, codice, descrizione), commerciale:profiles!titoli_commerciale_id_fkey(nome, cognome, ruolo)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: movimentiPolizza = [] } = useQuery({
    queryKey: ["movimenti-polizza", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimenti_polizza")
        .select("*")
        .eq("titolo_id", id!)
        .order("riga", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: veicolo } = useQuery({
    queryKey: ["veicolo-polizza", id],
    queryFn: async () => {
      const { data } = await supabase.from("veicoli_polizza").select("*").eq("titolo_id", id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: premiGaranzia = [] } = useQuery({
    queryKey: ["premi-garanzia", id],
    queryFn: async () => {
      const { data } = await supabase.from("premi_garanzia_polizza").select("*").eq("titolo_id", id!).order("ordine");
      return data || [];
    },
    enabled: !!id,
  });

  const { data: conducente } = useQuery({
    queryKey: ["conducente-polizza", id],
    queryFn: async () => {
      const { data } = await supabase.from("conducenti_polizza").select("*").eq("titolo_id", id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: provvigioni = [] } = useQuery({
    queryKey: ["provvigioni", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provvigioni_generate")
        .select("*, profiles(nome, cognome)")
        .eq("titolo_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: riparto = [] } = useQuery({
    queryKey: ["riparto", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dettaglio_riparto")
        .select("*, compagnie(nome, codice)")
        .eq("titolo_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: appendiciPolizza = [] } = useQuery({
    queryKey: ["appendici-polizza", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appendici_polizza")
        .select("*")
        .eq("titolo_id", id!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  // --- Cassa dialog state ---
  const [cassaDialogOpen, setCassaDialogOpen] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [cassaForm, setCassaForm] = useState({ dataMessaCassa: todayStr, dataPagamento: todayStr, dataDecorrenza: todayStr, tipoPagamento: "contanti", banca: "" });

  const bancheItaliane = [
    "Intesa Sanpaolo", "UniCredit", "BNL - BNP Paribas", "BPER Banca", "Banco BPM",
    "Monte dei Paschi di Siena", "Crédit Agricole Italia", "Poste Italiane",
    "Banca Mediolanum", "Banca Sella", "Fineco Bank", "CheBanca!", "ING Italia",
    "Deutsche Bank Italia", "Banca Popolare di Sondrio", "Altro",
  ];

  // --- Regolazione edit state ---
  const [editingReg, setEditingReg] = useState(false);
  const [regForm, setRegForm] = useState({
    regolazione: false, periodicita: "", tipo_scadenza: "",
    giorni_presentazione: 0, tipo_lettera_regolazione: "", libro_matricola: "",
  });

  // --- Commerciale edit state ---
  const [editingComm, setEditingComm] = useState(false);
  const [commForm, setCommForm] = useState({ anagrafica_commerciale_id: "" as string | null, percentuale_commerciale: 100 });

  const { data: anagraficheComm = [] } = useQuery({
    queryKey: ["anagrafiche-commerciali"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali" as any)
        .select("id, ragione_sociale, cognome, nome, percentuale_base, tipo")
        .eq("attivo", true)
        .in("tipo", ["corrispondente", "account_executive", "executive", "produttore_sede"])
        .order("ragione_sociale");
      return (data || []).map((a: any) => ({
        value: a.id,
        label: a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`.trim(),
        percentuale_base: a.percentuale_base ?? 0,
      }));
    },
    enabled: editingComm,
  });

  const startEditComm = () => {
    if (titolo) {
      setCommForm({
        anagrafica_commerciale_id: (titolo as any).anagrafica_commerciale_id ?? null,
        percentuale_commerciale: titolo.percentuale_commerciale ?? 100,
      });
    }
    setEditingComm(true);
  };

  const saveCommMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("titoli")
        .update({
          anagrafica_commerciale_id: commForm.anagrafica_commerciale_id || null,
          percentuale_commerciale: commForm.percentuale_commerciale,
        } as any)
        .eq("id", id!);
      if (error) throw error;
      // Ricalcola provvigioni se incassato
      if (titolo?.stato === "incassato") {
        await supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: id } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["provvigioni", id] });
      toast.success("Commerciale aggiornato");
      setEditingComm(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startEditReg = () => {
    if (titolo) {
      setRegForm({
        regolazione: titolo.regolazione ?? false,
        periodicita: titolo.periodicita ?? "",
        tipo_scadenza: titolo.tipo_scadenza ?? "",
        giorni_presentazione: titolo.giorni_presentazione ?? 0,
        tipo_lettera_regolazione: titolo.tipo_lettera_regolazione ?? "",
        libro_matricola: titolo.libro_matricola ?? "",
      });
    }
    setEditingReg(true);
  };

  const saveRegMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("titoli")
        .update({
          regolazione: regForm.regolazione,
          periodicita: regForm.periodicita || null,
          tipo_scadenza: regForm.tipo_scadenza || null,
          giorni_presentazione: regForm.giorni_presentazione,
          tipo_lettera_regolazione: regForm.tipo_lettera_regolazione || null,
          libro_matricola: regForm.libro_matricola || null,
        })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      toast.success("Regolazione aggiornata");
      setEditingReg(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const periodicitaOpts = [
    { value: "annuale", label: "Annuale" },
    { value: "semestrale", label: "Semestrale" },
    { value: "trimestrale", label: "Trimestrale" },
    { value: "mensile", label: "Mensile" },
  ];
  const tipoScadenzaOpts = [
    { value: "no_scadenza", label: "No scadenza" },
    { value: "a_scadenza", label: "A scadenza" },
  ];
  const tipoLetteraOpts = [
    { value: "standard", label: "Standard" },
    { value: "personalizzata", label: "Personalizzata" },
    { value: "nessuna", label: "Nessuna" },
  ];

  // --- Contratto edit state ---
  const [editingContratto, setEditingContratto] = useState(false);
  const [contrattoForm, setContrattoForm] = useState({
    tipo_portafoglio: "",
    cig_rif: "",
    vincolo: "",
    targa_telaio: "",
    descrizione_polizza: "",
    prodotto_id: "" as string | null,
    specialist: "",
    produttore_id: "" as string | null,
    ufficio_id: "" as string | null,
  });

  const tipoPortafoglioOpts = [
    { value: "NUOVA EMISSIONE", label: "NUOVA EMISSIONE" },
    { value: "PORTAFOGLIO PREESISTENTE", label: "PORTAFOGLIO PREESISTENTE" },
    { value: "POLIZZE FAMIGLIA FIORE", label: "POLIZZE FAMIGLIA FIORE" },
    { value: "gestione", label: "Gestione" },
  ];

  const { data: prodottiOpts = [] } = useQuery({
    queryKey: ["prodotti-by-compagnia", titolo?.compagnia_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("prodotti")
        .select("id, nome_prodotto")
        .eq("compagnia_id", titolo!.compagnia_id!)
        .order("nome_prodotto");
      return (data || []).map((p: any) => ({ value: p.id, label: p.nome_prodotto }));
    },
    enabled: editingContratto && !!titolo?.compagnia_id,
  });

  const { data: produttoriOpts = [] } = useQuery({
    queryKey: ["produttori-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, cognome")
        .eq("attivo", true)
        .eq("ruolo", "produttore")
        .order("cognome");
      return (data || []).map((p: any) => ({
        value: p.id,
        label: `${p.cognome || ""} ${p.nome || ""}`.trim(),
      }));
    },
    enabled: editingContratto,
  });

  const { data: specialistOpts = [] } = useQuery({
    queryKey: ["specialist-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, cognome")
        .eq("attivo", true)
        .eq("ruolo", "backoffice")
        .order("cognome");
      return (data || []).map((p: any) => ({
        value: `${p.cognome || ""} ${p.nome || ""}`.trim(),
        label: `${p.cognome || ""} ${p.nome || ""}`.trim(),
      }));
    },
    enabled: editingContratto,
  });

  const { data: ufficiOpts = [] } = useQuery({
    queryKey: ["uffici-attivi"],
    queryFn: async () => {
      const { data } = await supabase
        .from("uffici")
        .select("id, nome_ufficio")
        .eq("attivo", true)
        .order("nome_ufficio");
      return (data || []).map((u: any) => ({ value: u.id, label: u.nome_ufficio }));
    },
    enabled: editingContratto,
  });

  const startEditContratto = () => {
    if (titolo) {
      setContrattoForm({
        tipo_portafoglio: (titolo as any).tipo_portafoglio ?? "",
        cig_rif: (titolo as any).cig_rif ?? "",
        vincolo: (titolo as any).vincolo ?? "",
        targa_telaio: (titolo as any).targa_telaio ?? "",
        descrizione_polizza: (titolo as any).descrizione_polizza ?? "",
        prodotto_id: (titolo as any).prodotto_id ?? null,
        specialist: (titolo as any).specialist ?? "",
        produttore_id: (titolo as any).produttore_id ?? null,
        ufficio_id: (titolo as any).ufficio_id ?? null,
      });
    }
    setEditingContratto(true);
  };

  const saveContrattoMutation = useMutation({
    mutationFn: async () => {
      // Compute diff vs current titolo for activity log
      const before: Record<string, any> = {};
      const after: Record<string, any> = {};
      const fields: (keyof typeof contrattoForm)[] = [
        "tipo_portafoglio", "cig_rif", "vincolo", "targa_telaio",
        "descrizione_polizza", "prodotto_id", "specialist", "produttore_id", "ufficio_id",
      ];
      fields.forEach((f) => {
        const oldV = (titolo as any)?.[f] ?? null;
        const newV = (contrattoForm[f] as any) || null;
        if (oldV !== newV) { before[f] = oldV; after[f] = newV; }
      });

      const { error } = await supabase
        .from("titoli")
        .update({
          tipo_portafoglio: contrattoForm.tipo_portafoglio || null,
          cig_rif: contrattoForm.cig_rif || null,
          vincolo: contrattoForm.vincolo || null,
          targa_telaio: contrattoForm.targa_telaio || null,
          descrizione_polizza: contrattoForm.descrizione_polizza || null,
          prodotto_id: contrattoForm.prodotto_id || null,
          specialist: contrattoForm.specialist || null,
          produttore_id: contrattoForm.produttore_id || null,
          ufficio_id: contrattoForm.ufficio_id || null,
        } as any)
        .eq("id", id!);
      if (error) throw error;

      if (Object.keys(after).length > 0) {
        await logAttivita({
          azione: "modifica_contratto",
          entita_tipo: "titolo",
          entita_id: id!,
          dettagli_json: { campi_modificati: Object.keys(after), before, after },
          severity: "info",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", id] });
      toast.success("Contratto aggiornato");
      setEditingContratto(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // --- Periodo edit state ---
  const [editingPeriodo, setEditingPeriodo] = useState(false);
  const [periodoForm, setPeriodoForm] = useState({
    durata_da: "" as string,
    durata_a: "" as string,
    anni_durata: "" as string,
    rate: "" as string,
    garanzia_da: "" as string,
    garanzia_a: "" as string,
    data_competenza: "" as string,
    data_scadenza: "" as string,
    limite_mora: "" as string,
    mora_giorni: "" as string,
    tipo_rinnovo: "" as string,
    disdetta_mesi: "" as string,
  });

  const tipoRinnovoOpts = [
    { value: "tacito_rinnovo", label: "Tacito Rinnovo" },
    { value: "scadenza_annuale", label: "Scadenza Annuale" },
    { value: "disdetta", label: "Disdetta" },
    { value: "nessuno", label: "Nessuno" },
  ];

  const startEditPeriodo = () => {
    if (titolo) {
      const t: any = titolo;
      setPeriodoForm({
        durata_da: t.durata_da ?? "",
        durata_a: t.durata_a ?? "",
        anni_durata: t.anni_durata != null ? String(t.anni_durata) : "",
        rate: t.rate != null ? String(t.rate) : "",
        garanzia_da: t.garanzia_da ?? "",
        garanzia_a: t.garanzia_a ?? "",
        data_competenza: t.data_competenza ?? "",
        data_scadenza: t.data_scadenza ?? "",
        limite_mora: t.limite_mora ?? "",
        mora_giorni: t.mora_giorni != null ? String(t.mora_giorni) : "",
        tipo_rinnovo: t.tipo_rinnovo ?? "",
        disdetta_mesi: t.disdetta_mesi != null ? String(t.disdetta_mesi) : "",
      });
    }
    setEditingPeriodo(true);
  };

  // Auto-suggested anni_durata from durata_da/_a
  const suggestedAnniDurata = (() => {
    if (!periodoForm.durata_da || !periodoForm.durata_a) return null;
    const d1 = new Date(periodoForm.durata_da);
    const d2 = new Date(periodoForm.durata_a);
    const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    return Math.round((months / 12) * 10) / 10;
  })();
  const isPoliennaleEdit = suggestedAnniDurata != null && suggestedAnniDurata > 1.08;

  const savePeriodoMutation = useMutation({
    mutationFn: async () => {
      // Validations
      const errs: string[] = [];
      const dDa = periodoForm.durata_da ? new Date(periodoForm.durata_da) : null;
      const dA = periodoForm.durata_a ? new Date(periodoForm.durata_a) : null;
      const gDa = periodoForm.garanzia_da ? new Date(periodoForm.garanzia_da) : null;
      const gA = periodoForm.garanzia_a ? new Date(periodoForm.garanzia_a) : null;
      if (dDa && dA && dDa > dA) errs.push("Durata Da non può essere successiva a Durata A");
      if (gDa && gA && gDa > gA) errs.push("Garanzia Da non può essere successiva a Garanzia A");
      if (dDa && gDa && gDa < dDa) errs.push("Garanzia Da deve essere ≥ Durata Da");
      if (dA && gA && gA > dA) errs.push("Garanzia A deve essere ≤ Durata A");
      if (errs.length) throw new Error(errs.join(" • "));

      const before: Record<string, any> = {};
      const after: Record<string, any> = {};
      const fields: (keyof typeof periodoForm)[] = [
        "durata_da", "durata_a", "anni_durata", "rate", "garanzia_da", "garanzia_a",
        "data_competenza", "data_scadenza", "limite_mora", "mora_giorni", "tipo_rinnovo", "disdetta_mesi",
      ];
      const numericFields = new Set(["anni_durata", "rate", "mora_giorni", "disdetta_mesi"]);
      const payload: Record<string, any> = {};
      fields.forEach((f) => {
        const raw = periodoForm[f];
        const newV = raw === "" || raw == null ? null : (numericFields.has(f as string) ? Number(raw) : raw);
        const oldV = (titolo as any)?.[f] ?? null;
        if (oldV !== newV) { before[f] = oldV; after[f] = newV; }
        payload[f] = newV;
      });

      const { error } = await supabase.from("titoli").update(payload as any).eq("id", id!);
      if (error) throw error;

      if (Object.keys(after).length > 0) {
        await logAttivita({
          azione: "modifica_periodo",
          entita_tipo: "titolo",
          entita_id: id!,
          dettagli_json: { campi_modificati: Object.keys(after), before, after },
          severity: "info",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", id] });
      toast.success("Periodo aggiornato");
      setEditingPeriodo(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const changeStatoMutation = useMutation({
    mutationFn: async (params: string | { nuovoStato: string; cassaData?: typeof cassaForm }) => {
      const nuovoStato = typeof params === "string" ? params : params.nuovoStato;
      const cassaData = typeof params === "string" ? undefined : params.cassaData;
      const isConferimento = typeof params !== "string" && (params as any).conferimentoGestito;
      const vecchioStato = titolo?.stato;
      const updatePayload: any = { stato: nuovoStato, updated_at: new Date().toISOString() };
      if (nuovoStato === "incassato" && cassaData) {
        updatePayload.data_messa_cassa = cassaData.dataMessaCassa;
        updatePayload.data_pagamento = cassaData.dataPagamento;
        updatePayload.data_decorrenza_rinnovo = cassaData.dataDecorrenza;
        updatePayload.tipo_pagamento = cassaData.tipoPagamento;
        if (cassaData.tipoPagamento === "bonifico" && cassaData.banca) {
          updatePayload.banca_pagamento = cassaData.banca;
        }
        if (isConferimento) {
          updatePayload.conferimento_gestito = true;
          updatePayload.fondi_ricevuti = false;
          updatePayload.data_conferimento_gestito = new Date().toISOString().slice(0, 10);
        }
      } else if ((nuovoStato === "attivo" || nuovoStato === "annullato") && vecchioStato === "incassato") {
        // Reset dei campi messa a cassa quando si esce dallo stato 'incassato'
        updatePayload.data_messa_cassa = null;
        updatePayload.data_pagamento = null;
        updatePayload.data_decorrenza_rinnovo = null;
        updatePayload.data_incasso = null;
        updatePayload.importo_incassato = null;
        updatePayload.tipo_pagamento = null;
        updatePayload.banca_pagamento = null;
        updatePayload.conferimento_gestito = false;
        updatePayload.fondi_ricevuti = true;
        updatePayload.data_conferimento_gestito = null;
      }
      const { error } = await supabase.from("titoli").update(updatePayload).eq("id", id!);
      if (error) throw error;
      if (user) {
        await logAttivita({ azione: isConferimento ? "conferimento_gestito" : "cambio_stato_titolo", entita_tipo: "titolo", entita_id: id!, dettagli_json: { stato_precedente: vecchioStato, nuovo_stato: nuovoStato, conferimento_gestito: !!isConferimento } });
      }
      if (nuovoStato === "incassato") {
        await supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: id } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["provvigioni", id] });
      toast.success("Stato aggiornato");
      setCassaDialogOpen(false);
      setConferimentoDialogOpen(false);
    },
    onError: (err: any) => toast.error("Errore"),
  });

  const segnaFondiRicevutiMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("titoli").update({ fondi_ricevuti: true, updated_at: new Date().toISOString() }).eq("id", id!);
      if (error) throw error;
      if (user) {
        await logAttivita({ azione: "fondi_ricevuti", entita_tipo: "titolo", entita_id: id!, dettagli_json: { conferimento_gestito: true } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      toast.success("Fondi segnati come ricevuti");
    },
    onError: () => toast.error("Errore"),
  });

  const annullaFondiMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("titoli").update({ fondi_ricevuti: false, updated_at: new Date().toISOString() }).eq("id", id!);
      if (error) throw error;
      if (user) {
        await logAttivita({ azione: "fondi_ricevuti_annullato", entita_tipo: "titolo", entita_id: id!, dettagli_json: { conferimento_gestito: true } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      toast.success("Fondi riportati in attesa");
    },
    onError: () => toast.error("Errore"),
  });

  const updateDateMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: string | null }) => {
      const { error } = await supabase.from("titoli").update({ [field]: value || null, updated_at: new Date().toISOString() } as any).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      toast.success("Data aggiornata");
    },
    onError: () => toast.error("Errore aggiornamento data"),
  });

  if (isLoading) return <p className="text-muted-foreground p-8">Caricamento...</p>;
  if (!titolo) return <p className="text-destructive p-8">Titolo non trovato</p>;

  const t = titolo as any;

  // Polizza poliennale: durata > 13 mesi tra decorrenza e scadenza
  const isPoliennale = (() => {
    if (!t.data_decorrenza || !t.data_scadenza) return false;
    const start = new Date(t.data_decorrenza);
    const end = new Date(t.data_scadenza);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return months > 13;
  })();
  // Mostra "Messa a Cassa" solo se mai incassata, oppure se poliennale attiva (rate residue)
  const showMessaACassa = !t.data_messa_cassa || (isPoliennale && t.stato === "attivo");

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/carico")}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Polizza {t.numero_titolo || t.id.slice(0, 8)}</h1>
          <p className="text-muted-foreground text-sm">{t.prodotti?.nome_prodotto} — {(t.compagnia_diretta as any)?.nome || t.prodotti?.compagnie?.nome || "N/D"}</p>
        </div>
        <Badge variant={t.stato === "incassato" ? "default" : t.stato === "stornato" ? "destructive" : "secondary"} className="ml-auto text-sm">
          {t.stato}
        </Badge>
      </div>

      {/* Operazioni — nascosto solo per polizze in stato terminale (scaduto/sospeso) */}
      {!(t.stato === "scaduto" || t.stato === "sospeso") && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Operazioni</CardTitle></CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => navigate(`/portafoglio/sospensione?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}`)}>
              <Clock className="w-4 h-4 mr-1" /> Sospensione
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/portafoglio/riattivazione?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}`)}>
              <CheckSquare className="w-4 h-4 mr-1" /> Riattivazione
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/portafoglio/duplicazione?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}`)}>
              <Copy className="w-4 h-4 mr-1" /> Duplicazione
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/portafoglio/appendici?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}`)}>
              <FileText className="w-4 h-4 mr-1" /> Appendici
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/portafoglio/storno?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}`)}>
              <ArrowRightLeft className="w-4 h-4 mr-1" /> Storno
            </Button>
            <Button variant="outline" size="sm" onClick={() => document.getElementById("regolazione-section")?.scrollIntoView({ behavior: "smooth" })}>
              <RefreshCw className="w-4 h-4 mr-1" /> Regolazione
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10">
                  <XCircle className="w-4 h-4 mr-1" /> Annullamento
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Conferma Annullamento</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sei sicuro di voler annullare la polizza {t.numero_titolo}? Questa azione è irreversibile.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={() => changeStatoMutation.mutate("annullato")} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Conferma Annullamento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {/* MESSA A CASSA — nascosta se già incassata, salvo polizze poliennali attive (rate residue) */}
      {(t.stato === "attivo" || t.stato === "incassato") && showMessaACassa && (
        <Card className={t.stato === "incassato" ? "border-yellow-400 bg-yellow-50" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Messa a Cassa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              {t.stato === "incassato" ? (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Data Messa a Cassa</label>
                    <Input type="date" className="mt-1" value={t.data_messa_cassa || ""} onChange={(e) => updateDateMutation.mutate({ field: "data_messa_cassa", value: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Data Pagamento</label>
                    <Input type="date" className="mt-1" value={t.data_pagamento || ""} onChange={(e) => updateDateMutation.mutate({ field: "data_pagamento", value: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Data Decorrenza Rinnovo</label>
                    <Input type="date" className="mt-1" value={t.data_decorrenza_rinnovo || ""} onChange={(e) => updateDateMutation.mutate({ field: "data_decorrenza_rinnovo", value: e.target.value })} />
                  </div>
                  <div>
                    <FieldRow label="Tipo Pagamento" value={fmt(t.tipo_pagamento)} />
                  </div>
                  {t.tipo_pagamento === "bonifico" && t.banca_pagamento && (
                    <div>
                      <FieldRow label="Banca" value={fmt(t.banca_pagamento)} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <FieldRow label="Data Messa a Cassa" value="—" />
                  <FieldRow label="Data Pagamento" value="—" />
                  <FieldRow label="Data Decorrenza Rinnovo" value="—" />
                </>
              )}
            </div>
            {/* Badges conferimento gestito */}
            {t.stato === "incassato" && t.conferimento_gestito && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-orange-500 text-white hover:bg-orange-600">Garantito</Badge>
                {!t.fondi_ricevuti ? (
                  <>
                    <Badge variant="destructive">In Attesa Fondi</Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="h-7 text-xs border-green-500 text-green-600 hover:bg-green-50" disabled={segnaFondiRicevutiMutation.isPending}>
                          <CheckSquare className="w-3 h-3 mr-1" /> Segna Fondi Ricevuti
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Conferma ricezione fondi</AlertDialogTitle>
                          <AlertDialogDescription>Confermi che i fondi per questo titolo sono stati effettivamente ricevuti?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={() => segnaFondiRicevutiMutation.mutate()}>Conferma</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                ) : (
                  <>
                    <Badge className="bg-green-600 text-white hover:bg-green-700">Fondi Ricevuti</Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="h-7 text-xs border-red-400 text-red-500 hover:bg-red-50" disabled={annullaFondiMutation.isPending}>
                          <XCircle className="w-3 h-3 mr-1" /> Annulla Fondi Ricevuti
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Annullare ricezione fondi?</AlertDialogTitle>
                          <AlertDialogDescription>Sei sicuro di voler riportare questo titolo in stato "In Attesa Fondi"?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => annullaFondiMutation.mutate()}>Conferma annullamento</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {t.stato === "attivo" && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  setCassaForm({ dataMessaCassa: today, dataPagamento: today, dataDecorrenza: today, tipoPagamento: "contanti", banca: "" });
                  setCassaDialogOpen(true);
                }} disabled={changeStatoMutation.isPending}>
                  <CheckSquare className="w-4 h-4 mr-1" /> Incassa
                </Button>
              )}
              {t.stato === "attivo" && (
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  setConferimentoForm({ dataMessaCassa: today, dataPagamento: today, dataDecorrenza: today, tipoPagamento: "contanti", banca: "" });
                  setConferimentoAccettato(false);
                  setConferimentoDialogOpen(true);
                }} disabled={changeStatoMutation.isPending}>
                  <Shield className="w-4 h-4 mr-1" /> Garantito
                </Button>
              )}
              {(t.stato === "incassato" || t.data_messa_cassa) && isAdmin && (
                <Button variant="outline" size="sm" className="text-orange-600 border-orange-400 hover:bg-orange-50" onClick={() => { setAnnullaPassword(""); setAnnullaDialogOpen(true); }} disabled={changeStatoMutation.isPending}>
                  <XCircle className="w-4 h-4 mr-1" /> Annulla {t.stato === "incassato" ? "Incasso" : "Messa a Cassa"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog Conferma Messa a Cassa */}
      <Dialog open={cassaDialogOpen} onOpenChange={setCassaDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Conferma Messa a Cassa</DialogTitle>
            <DialogDescription>Polizza {t.numero_titolo || t.id.slice(0, 8)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Data Messa a Cassa</Label>
                <Input type="date" value={cassaForm.dataMessaCassa} onChange={(e) => setCassaForm(f => ({ ...f, dataMessaCassa: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Data Pagamento</Label>
                <Input type="date" value={cassaForm.dataPagamento} onChange={(e) => setCassaForm(f => ({ ...f, dataPagamento: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Data Decorrenza Rinnovo</Label>
                <Input type="date" value={cassaForm.dataDecorrenza} onChange={(e) => setCassaForm(f => ({ ...f, dataDecorrenza: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Tipo Pagamento</Label>
              <Select value={cassaForm.tipoPagamento} onValueChange={(v) => setCassaForm(f => ({ ...f, tipoPagamento: v, banca: "" }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contanti">Contanti</SelectItem>
                  <SelectItem value="pos">POS</SelectItem>
                  <SelectItem value="bonifico">Bonifico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cassaForm.tipoPagamento === "bonifico" && (
              <div>
                <Label className="text-xs">Banca</Label>
                <Select value={cassaForm.banca} onValueChange={(v) => setCassaForm(f => ({ ...f, banca: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleziona banca..." /></SelectTrigger>
                  <SelectContent>
                    {bancheItaliane.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">
                ⚠️ Attenzione: questa operazione è irreversibile. Una volta confermata, non sarà possibile annullare l'incasso.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCassaDialogOpen(false)}>Annulla</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={changeStatoMutation.isPending || (cassaForm.tipoPagamento === "bonifico" && !cassaForm.banca)} onClick={() => changeStatoMutation.mutate({ nuovoStato: "incassato", cassaData: cassaForm })}>
              <CheckSquare className="w-4 h-4 mr-1" /> Conferma Incasso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Garantito */}
      <Dialog open={conferimentoDialogOpen} onOpenChange={setConferimentoDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Garantito</DialogTitle>
            <DialogDescription>Polizza {t.numero_titolo || t.id.slice(0, 8)} — Incasso senza fondi in cassa</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-orange-400 bg-orange-50 p-3 text-sm text-orange-800 space-y-2">
              <p className="font-semibold">⚠️ Dichiarazione di Responsabilità — Circolare 02 Consulbrokers</p>
              <p className="font-medium">Procedura operativa 03, punto 3:</p>
              <p>Le polizze, una volta inserite <strong>NON DEVONO ESSERE GARANTITE</strong>, ma dovranno essere effettivamente incassate; casi particolari devono essere concordati <strong>PER ISCRITTO</strong> con la Direzione seguendo i criteri di seguito esposti:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Coperture fino ad euro <strong>1.000,00</strong>: occorre l'autorizzazione dell'Amministratore Delegato</li>
                <li>Coperture fino ad euro <strong>10.000,00</strong>: occorre l'autorizzazione di due Amministratori Delegati</li>
                <li>Coperture oltre euro <strong>10.000,00</strong>: occorre l'autorizzazione del CDA</li>
              </ul>
              <p>Tutto quanto non regolarizzato alla data di chiusura del mese non verrà rimesso alle compagnie entro il giorno 10 del mese successivo.</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="conferimento-accettato" checked={conferimentoAccettato} onCheckedChange={(v) => setConferimentoAccettato(!!v)} />
              <Label htmlFor="conferimento-accettato" className="text-sm font-medium">Dichiaro di aver ottenuto l'autorizzazione necessaria e di assumermi la responsabilità dell'incasso</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data Messa a Cassa</Label>
                <Input type="date" value={conferimentoForm.dataMessaCassa} onChange={(e) => setConferimentoForm(f => ({ ...f, dataMessaCassa: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Data Decorrenza Rinnovo</Label>
                <Input type="date" value={conferimentoForm.dataDecorrenza} onChange={(e) => setConferimentoForm(f => ({ ...f, dataDecorrenza: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tipo pagamento e data pagamento verranno compilati successivamente, al momento dell'incasso effettivo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConferimentoDialogOpen(false)}>Annulla</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={!conferimentoAccettato || changeStatoMutation.isPending}
              onClick={() => changeStatoMutation.mutate({ nuovoStato: "incassato", cassaData: { ...conferimentoForm, dataPagamento: "", tipoPagamento: "", banca: "" }, conferimentoGestito: true } as any)}
            >
              <Shield className="w-4 h-4 mr-1" /> Conferma Garantito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={annullaDialogOpen} onOpenChange={setAnnullaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conferma Annullamento Incasso</DialogTitle>
            <DialogDescription>Verifica la tua identità per procedere.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">
                ⚠️ Operazione riservata agli amministratori. Inserisci la tua password per confermare l'annullamento dell'incasso.
              </p>
            </div>
            <div>
              <Label className="text-xs">Password</Label>
              <Input type="password" value={annullaPassword} onChange={(e) => setAnnullaPassword(e.target.value)} placeholder="Inserisci la tua password" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnullaDialogOpen(false)}>Annulla</Button>
            <Button variant="destructive" disabled={!annullaPassword || annullaLoading} onClick={async () => {
              setAnnullaLoading(true);
              try {
                const { error } = await supabase.auth.signInWithPassword({ email: user?.email || "", password: annullaPassword });
                if (error) {
                  toast.error("Password non corretta");
                  return;
                }
                const res = await annullaMessaACassa(id!);
                if (!res.ok) {
                  toast.error(res.error || "Operazione fallita");
                  return;
                }
                toast.success(
                  `Incasso annullato (${res.provvigioniEliminate ?? 0} provv., ${res.movimentiEliminati ?? 0} mov. rimossi)`
                );
                queryClient.invalidateQueries({ queryKey: ["titolo", id] });
                queryClient.invalidateQueries({ queryKey: ["provvigioni", id] });
                queryClient.invalidateQueries({ queryKey: ["dashboard-ufficio"] });
                queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
                queryClient.invalidateQueries({ queryKey: ["portafoglio-carico-totale"] });
                queryClient.invalidateQueries({ queryKey: ["portafoglio"] });
                setAnnullaDialogOpen(false);
              } catch {
                toast.error("Errore di verifica");
              } finally {
                setAnnullaLoading(false);
              }
            }}>
              Conferma Annullamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SectionCollapsible title="Contratto" icon={FileText}>
        <div className="flex justify-end mb-2 gap-2">
          {!editingContratto ? (
            <Button variant="ghost" size="sm" onClick={startEditContratto}>
              <Pencil className="w-4 h-4 mr-1" /> Modifica
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditingContratto(false)}>Annulla</Button>
              <Button size="sm" onClick={() => saveContrattoMutation.mutate()} disabled={saveContrattoMutation.isPending}>
                {saveContrattoMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </>
          )}
        </div>

        {!editingContratto ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
            <FieldRow label="Compagnia" value={
              <span>{(t.compagnia_diretta as any)?.codice || ""} - {(t.compagnia_diretta as any)?.nome || t.prodotti?.compagnie?.nome || "—"}</span>
            } />
            <FieldRow label="Ramo" value={`${(t.ramo as any)?.codice || ""} ${(t.ramo as any)?.descrizione || "—"}`} />
            <FieldRow label="Prodotto" value={fmt(t.prodotti?.nome_prodotto)} />
            <FieldRow label="Specialist" value={fmt(t.specialist)} />
            <FieldRow label="Tipo Portafoglio" value={fmt(t.tipo_portafoglio)} />
            <FieldRow label="Numero Polizza" value={fmt(t.numero_titolo)} />
            <FieldRow label="Riga" value={fmt(t.riga)} />
            <FieldRow label="Appendice" value={fmt(t.appendice)} />
            {t.cliente_anagrafica && (
              <>
                <div className="col-span-2 flex justify-between py-1">
                  <span className="text-xs text-muted-foreground">Cliente</span>
                  <Button variant="link" className="h-auto p-0 text-sm" onClick={() => navigate(`/archivi/clienti/${(t.cliente_anagrafica as any).id}`)}>
                    {(t.cliente_anagrafica as any).tipo_cliente === "privato"
                      ? `${(t.cliente_anagrafica as any).cognome || ""} ${(t.cliente_anagrafica as any).nome || ""}`.trim()
                      : (t.cliente_anagrafica as any).ragione_sociale || "—"}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </div>
                <FieldRow label="Attività" value={fmt((t.cliente_anagrafica as any).attivita)} />
                <FieldRow label="Gr. Finanziario" value={fmt((t.cliente_anagrafica as any).gruppi_finanziari?.nome)} />
                <FieldRow label="Gr. Statistico" value={fmt((t.cliente_anagrafica as any).gruppo_statistico)} />
              </>
            )}
            <FieldRow label="Produttore" value={t.produttore ? `${(t.produttore as any).nome} ${(t.produttore as any).cognome}` : "—"} />
            <FieldRow label="Ufficio" value={fmt(t.uffici?.nome_ufficio)} />
            <FieldRow label="CIG/Rif." value={fmt(t.cig_rif)} />
            <FieldRow label="Vincolo" value={fmt(t.vincolo)} />
            <FieldRow label="Targa/Telaio" value={fmt(t.targa_telaio)} />
            {t.descrizione_polizza && <div className="col-span-full"><FieldRow label="Descrizione" value={t.descrizione_polizza} /></div>}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* Read-only fields */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">🔒 Compagnia</Label>
              <div className="text-sm font-mono py-2">{(t.compagnia_diretta as any)?.codice || ""} - {(t.compagnia_diretta as any)?.nome || "—"}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">🔒 Ramo</Label>
              <div className="text-sm font-mono py-2">{(t.ramo as any)?.codice || ""} {(t.ramo as any)?.descrizione || "—"}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">🔒 Numero Polizza</Label>
              <div className="text-sm font-mono py-2">{fmt(t.numero_titolo)}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">🔒 Riga</Label>
              <div className="text-sm font-mono py-2">{fmt(t.riga)}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">🔒 Appendice</Label>
              <div className="text-sm font-mono py-2">{fmt(t.appendice)}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">🔒 Cliente</Label>
              <div className="text-sm font-mono py-2">
                {t.cliente_anagrafica
                  ? ((t.cliente_anagrafica as any).tipo_cliente === "privato"
                    ? `${(t.cliente_anagrafica as any).cognome || ""} ${(t.cliente_anagrafica as any).nome || ""}`.trim()
                    : (t.cliente_anagrafica as any).ragione_sociale || "—")
                  : "—"}
              </div>
            </div>

            {/* Editable fields */}
            <div className="space-y-1">
              <Label className="text-xs">Tipo Portafoglio</Label>
              <SearchableSelect
                options={tipoPortafoglioOpts}
                value={contrattoForm.tipo_portafoglio}
                onValueChange={(v) => setContrattoForm(p => ({ ...p, tipo_portafoglio: v }))}
                placeholder="Seleziona tipo portafoglio"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Prodotto</Label>
              <SearchableSelect
                options={prodottiOpts}
                value={contrattoForm.prodotto_id || ""}
                onValueChange={(v) => setContrattoForm(p => ({ ...p, prodotto_id: v || null }))}
                placeholder="Seleziona prodotto"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Specialist</Label>
              <SearchableSelect
                options={specialistOpts}
                value={contrattoForm.specialist}
                onValueChange={(v) => setContrattoForm(p => ({ ...p, specialist: v }))}
                placeholder="Seleziona specialist"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Produttore</Label>
              <SearchableSelect
                options={produttoriOpts}
                value={contrattoForm.produttore_id || ""}
                onValueChange={(v) => setContrattoForm(p => ({ ...p, produttore_id: v || null }))}
                placeholder="Seleziona produttore"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Sede</Label>
              <SearchableSelect
                options={ufficiOpts}
                value={contrattoForm.ufficio_id || ""}
                onValueChange={(v) => setContrattoForm(p => ({ ...p, ufficio_id: v || null }))}
                placeholder="Seleziona sede"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">CIG/Rif.</Label>
              <Input
                value={contrattoForm.cig_rif}
                onChange={(e) => setContrattoForm(p => ({ ...p, cig_rif: e.target.value }))}
                maxLength={100}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Vincolo</Label>
              <Input
                value={contrattoForm.vincolo}
                onChange={(e) => setContrattoForm(p => ({ ...p, vincolo: e.target.value }))}
                maxLength={200}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Targa/Telaio</Label>
              <Input
                value={contrattoForm.targa_telaio}
                onChange={(e) => setContrattoForm(p => ({ ...p, targa_telaio: e.target.value.toUpperCase() }))}
                maxLength={50}
              />
            </div>

            <div className="col-span-full space-y-1">
              <Label className="text-xs">Descrizione</Label>
              <Textarea
                value={contrattoForm.descrizione_polizza}
                onChange={(e) => setContrattoForm(p => ({ ...p, descrizione_polizza: e.target.value }))}
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>
        )}
      </SectionCollapsible>

      {/* PERIODO */}
      <SectionCollapsible title="Periodo" icon={Calendar}>
        <div className="flex justify-end mb-2 gap-2">
          {!editingPeriodo ? (
            <Button variant="ghost" size="sm" onClick={startEditPeriodo}>
              <Pencil className="w-4 h-4 mr-1" /> Modifica
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditingPeriodo(false)}>Annulla</Button>
              <Button size="sm" onClick={() => savePeriodoMutation.mutate()} disabled={savePeriodoMutation.isPending}>
                {savePeriodoMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </>
          )}
        </div>

        {!editingPeriodo ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
            <FieldRow label="Durata Da" value={fmtDate(t.durata_da)} />
            <FieldRow label="Durata A" value={fmtDate(t.durata_a)} />
            <FieldRow label="Anni Durata" value={fmt(t.anni_durata)} />
            <FieldRow label="Rate" value={fmt(t.rate)} />
            <FieldRow label="Garanzia Da" value={fmtDate(t.garanzia_da)} />
            <FieldRow label="Garanzia A" value={fmtDate(t.garanzia_a)} />
            <FieldRow label="Data Competenza" value={fmtDate(t.data_competenza)} />
            <FieldRow label="Data Scadenza" value={fmtDate(t.data_scadenza)} />
            <FieldRow label="Limite Mora" value={fmtDate(t.limite_mora)} />
            <FieldRow label="GG Mora" value={fmt(t.mora_giorni)} />
            <FieldRow label="Tipo Rinnovo" value={fmt(t.tipo_rinnovo)} />
            <FieldRow label="Disdetta (mesi)" value={fmt(t.disdetta_mesi)} />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
            {([
              ["durata_da", "Durata Da"],
              ["durata_a", "Durata A"],
              ["garanzia_da", "Garanzia Da"],
              ["garanzia_a", "Garanzia A"],
              ["data_competenza", "Data Competenza"],
              ["data_scadenza", "Data Scadenza"],
              ["limite_mora", "Limite Mora"],
            ] as const).map(([field, label]) => (
              <div key={field}>
                <Label className="text-xs">{label}</Label>
                <Input
                  type="date"
                  value={(periodoForm as any)[field]?.slice(0, 10) || ""}
                  onChange={(e) => setPeriodoForm(p => {
                    const next: any = { ...p, [field]: e.target.value };
                    if (field === "garanzia_a" && e.target.value) {
                      if (!p.data_scadenza) next.data_scadenza = e.target.value;
                      const mora = Number(p.mora_giorni) || 0;
                      if (mora > 0 && !p.limite_mora) {
                        const d = new Date(e.target.value);
                        d.setDate(d.getDate() + mora);
                        next.limite_mora = d.toISOString().slice(0, 10);
                      }
                    }
                    return next;
                  })}
                />
              </div>
            ))}

            <div>
              <Label className="text-xs">Anni Durata</Label>
              <Input
                type="number"
                step="0.1"
                value={periodoForm.anni_durata}
                onChange={(e) => setPeriodoForm(p => ({ ...p, anni_durata: e.target.value }))}
              />
              {suggestedAnniDurata != null && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">Suggerito: {suggestedAnniDurata}</span>
                  {isPoliennaleEdit && <Badge variant="secondary" className="text-[10px]">Poliennale</Badge>}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Rate annuali</Label>
              <Input
                type="number"
                value={periodoForm.rate}
                onChange={(e) => setPeriodoForm(p => ({ ...p, rate: e.target.value }))}
                placeholder="1, 2, 4, 6, 12"
              />
              {periodoForm.rate && ![1, 2, 4, 6, 12].includes(Number(periodoForm.rate)) && (
                <span className="text-[10px] text-yellow-600">Valore non standard</span>
              )}
            </div>

            <div>
              <Label className="text-xs">GG Mora</Label>
              <Input
                type="number"
                value={periodoForm.mora_giorni}
                onChange={(e) => setPeriodoForm(p => ({ ...p, mora_giorni: e.target.value }))}
                placeholder="15"
              />
            </div>

            <div>
              <Label className="text-xs">Disdetta (mesi)</Label>
              <Input
                type="number"
                value={periodoForm.disdetta_mesi}
                onChange={(e) => setPeriodoForm(p => ({ ...p, disdetta_mesi: e.target.value }))}
                placeholder="3"
              />
            </div>

            <div className="col-span-2">
              <Label className="text-xs">Tipo Rinnovo</Label>
              <SearchableSelect
                options={tipoRinnovoOpts}
                value={periodoForm.tipo_rinnovo}
                onValueChange={(v) => setPeriodoForm(p => ({ ...p, tipo_rinnovo: v }))}
                placeholder="Seleziona tipo rinnovo"
              />
            </div>
          </div>
        )}
      </SectionCollapsible>

      {/* REGOLAZIONE */}
      <SectionCollapsible title="Regolazione" icon={Shield} defaultOpen={false}>
        <div className="flex justify-end mb-2 gap-2">
          {!editingReg ? (
            <Button variant="ghost" size="sm" onClick={startEditReg}>
              <Pencil className="w-4 h-4 mr-1" /> Modifica
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditingReg(false)}>Annulla</Button>
              <Button size="sm" onClick={() => saveRegMutation.mutate()} disabled={saveRegMutation.isPending}>
                {saveRegMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </>
          )}
        </div>

        {!editingReg ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
            <FieldRow label="Regolazione" value={fmtBool(t.regolazione)} />
            <FieldRow label="Periodicità" value={fmt(t.periodicita)} />
            <FieldRow label="Tipo Scadenza" value={fmt(t.tipo_scadenza)} />
            <FieldRow label="GG Presentazione" value={fmt(t.giorni_presentazione)} />
            <FieldRow label="Tipo Lettera" value={fmt(t.tipo_lettera_regolazione)} />
            <FieldRow label="Libro Matricola" value={fmt(t.libro_matricola)} />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="reg-check"
                checked={regForm.regolazione}
                onCheckedChange={(v) => setRegForm(p => ({ ...p, regolazione: !!v }))}
              />
              <Label htmlFor="reg-check">Regolazione attiva</Label>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Periodicità</Label>
              <SearchableSelect
                options={periodicitaOpts}
                value={regForm.periodicita}
                onValueChange={(v) => setRegForm(p => ({ ...p, periodicita: v }))}
                placeholder="Seleziona periodicità"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo Scadenza</Label>
              <SearchableSelect
                options={tipoScadenzaOpts}
                value={regForm.tipo_scadenza}
                onValueChange={(v) => setRegForm(p => ({ ...p, tipo_scadenza: v }))}
                placeholder="Seleziona tipo scadenza"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">GG Presentazione</Label>
              <Input
                type="number"
                value={regForm.giorni_presentazione}
                onChange={(e) => setRegForm(p => ({ ...p, giorni_presentazione: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo Lettera</Label>
              <SearchableSelect
                options={tipoLetteraOpts}
                value={regForm.tipo_lettera_regolazione}
                onValueChange={(v) => setRegForm(p => ({ ...p, tipo_lettera_regolazione: v }))}
                placeholder="Seleziona tipo lettera"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Libro Matricola</Label>
              <RadioGroup
                value={regForm.libro_matricola}
                onValueChange={(v) => setRegForm(p => ({ ...p, libro_matricola: v }))}
                className="flex gap-4 mt-1"
              >
                {["no", "auto", "altro"].map(v => (
                  <div key={v} className="flex items-center gap-1">
                    <RadioGroupItem value={v} id={`lm-${v}`} />
                    <Label htmlFor={`lm-${v}`} className="text-sm capitalize">{v}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        )}
      </SectionCollapsible>

      {/* COMMERCIALE & SPLIT */}
      <SectionCollapsible title="Commerciale & Provvigioni" icon={Percent}>
        {editingComm ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Commerciale</Label>
                <SearchableSelect
                  options={[{ value: "__none__", label: "— Nessuno (Sede) —" }, ...anagraficheComm]}
                  value={commForm.anagrafica_commerciale_id || "__none__"}
                  onValueChange={(v) => {
                    const sel = anagraficheComm.find((a: any) => a.value === v);
                    setCommForm({
                      anagrafica_commerciale_id: v === "__none__" ? null : v,
                      percentuale_commerciale: sel ? sel.percentuale_base || 100 : 100,
                    });
                  }}
                  placeholder="Seleziona commerciale..."
                />
              </div>
              <div>
                <Label className="text-xs">% Commerciale</Label>
                <Input
                  type="number" min={0} max={100}
                  value={commForm.percentuale_commerciale}
                  onChange={(e) => setCommForm({ ...commForm, percentuale_commerciale: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveCommMutation.mutate()} disabled={saveCommMutation.isPending}>
                {saveCommMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingComm(false)}>Annulla</Button>
            </div>
          </div>
        ) : (
          <>
            {(() => {
              const percComm = t.percentuale_commerciale ?? 100;
              const provvQ = t.provvigioni_quietanza;
              const commName = t.produttore_nome || (t.commerciale ? `${(t.commerciale as any).nome} ${(t.commerciale as any).cognome}` : "Sede");
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
                  <FieldRow label="Commerciale" value={commName} />
                  <FieldRow label="% Commerciale" value={`${percComm}%`} />
                  {provvQ != null && provvQ > 0 && (
                    <>
                      <FieldRow label="Provv. Commerciale" value={fmtEuro(provvQ * percComm / 100)} />
                      <FieldRow label="Provv. Consul" value={fmtEuro(provvQ * (100 - percComm) / 100)} />
                    </>
                  )}
                </div>
              );
            })()}
            <Button size="sm" variant="outline" className="mt-3" onClick={startEditComm}>
              <Pencil className="w-3 h-3 mr-1" /> Modifica
            </Button>
          </>
        )}
      </SectionCollapsible>

      {/* IMPORTI */}
      <SectionCollapsible title="Importi" icon={DollarSign}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Firma</h4>
            <div className="space-y-0">
              <FieldRow label="Premio Netto" value={fmtEuro(t.premio_netto)} />
              <FieldRow label="Addizionali" value={fmtEuro(t.addizionali)} />
              <FieldRow label="Tasse" value={fmtEuro(t.tasse)} />
              <FieldRow label="Premio Lordo" value={fmtEuro(t.premio_lordo)} />
              <FieldRow label="Provvigioni" value={fmtEuro(t.provvigioni_firma)} />
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Quietanza</h4>
            <div className="space-y-0">
              <FieldRow label="Premio Netto" value={fmtEuro(t.premio_netto_quietanza)} />
              <FieldRow label="Addizionali" value={fmtEuro(t.addizionali_quietanza)} />
              <FieldRow label="Tasse" value={fmtEuro(t.tasse_quietanza)} />
              <FieldRow label="Totale" value={fmtEuro(t.premio_netto_quietanza != null && t.addizionali_quietanza != null && t.tasse_quietanza != null ? t.premio_netto_quietanza + t.addizionali_quietanza + t.tasse_quietanza : null)} />
              <FieldRow label="Provvigioni" value={fmtEuro(t.provvigioni_quietanza)} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 mt-3 pt-3 border-t">
          <FieldRow label="Valuta" value={fmt(t.valuta)} />
          <FieldRow label="Cambio" value={fmt(t.cambio)} />
          <FieldRow label="Indicizzata" value={fmtBool(t.indicizzata)} />
          <FieldRow label="Rimborso" value={fmtBool(t.rimborso)} />
          <FieldRow label="Pag. Diretto Comp." value={fmtBool(t.pag_diretto_compagnia)} />
          <FieldRow label="Formato Elettronico" value={fmtBool(t.formato_elettronico)} />
          <FieldRow label="Incassato" value={fmtEuro(t.importo_incassato)} />
          <FieldRow label="Data Incasso" value={fmtDate(t.data_incasso)} />
        </div>
      </SectionCollapsible>

      {/* SOSTITUZIONI / STORNI */}
      {(t.sostituisce_polizza || t.storno_polizza) && (
        <SectionCollapsible title="Sostituzioni / Storni" icon={RefreshCw} defaultOpen={false}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
            <FieldRow label="Sostituisce Polizza" value={fmt(t.sostituisce_polizza)} />
            <FieldRow label="Riga" value={fmt(t.sostituisce_riga)} />
            <FieldRow label="Appendice" value={fmt(t.sostituisce_appendice)} />
            <FieldRow label="Storno Polizza" value={fmt(t.storno_polizza)} />
            <FieldRow label="Riga" value={fmt(t.storno_riga)} />
            <FieldRow label="Appendice" value={fmt(t.storno_appendice)} />
          </div>
        </SectionCollapsible>
      )}

      {/* DETTAGLIO RIPARTO */}
      <SectionCollapsible title="Dettaglio Riparto" icon={LayoutGrid} defaultOpen={false}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compagnia</TableHead>
              <TableHead className="text-right">Quota %</TableHead>
              <TableHead className="text-right">Netto</TableHead>
              <TableHead className="text-right">Add.</TableHead>
              <TableHead className="text-right">Tasse</TableHead>
              <TableHead className="text-right">Totale</TableHead>
              <TableHead className="text-right">Provv. Netto</TableHead>
              <TableHead>Pag.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(riparto as any[]).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.compagnie?.nome || "—"}</TableCell>
                <TableCell className="text-right font-mono">{r.quota_percentuale}%</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.netto)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.addizionali)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.tasse)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.totale)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.provv_netto)}</TableCell>
                <TableCell>{r.tipo_pagamento || "—"}</TableCell>
              </TableRow>
            ))}
            {riparto.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nessun riparto</TableCell></TableRow>}
          </TableBody>
        </Table>
      </SectionCollapsible>

      {/* DETTAGLIO MOVIMENTI */}
      <SectionCollapsible title="Dettaglio Movimenti" icon={List}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rg</TableHead>
                <TableHead className="w-16">App</TableHead>
                <TableHead>Data Mov.</TableHead>
                <TableHead>Effetto</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead>Rinnovo</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Val</TableHead>
                <TableHead className="text-right">Premio</TableHead>
                <TableHead className="text-right">Provv.</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-12">Inc</TableHead>
                <TableHead>Copertura</TableHead>
                <TableHead>Incasso</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(movimentiPolizza as any[]).map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.riga}</TableCell>
                  <TableCell className="font-mono text-xs">{m.appendice}</TableCell>
                  <TableCell className="text-xs">{fmtDate(m.data_movimento)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(m.data_effetto)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(m.data_scadenza)}</TableCell>
                  <TableCell className="text-xs">{fmt(m.tipo_rinnovo)}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{fmt(m.descrizione)}</TableCell>
                  <TableCell className="text-xs">{m.valuta || "EUR"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtEuro(m.premio)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtEuro(m.provvigioni)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{m.tipo}</Badge></TableCell>
                  <TableCell className="text-center">{m.incassato ? "✓" : ""}</TableCell>
                  <TableCell className="text-xs">{fmtDate(m.data_copertura)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(m.data_incasso)}</TableCell>
                  <TableCell><Badge variant={m.stato === "attivo" ? "default" : "secondary"} className="text-[10px]">{m.stato}</Badge></TableCell>
                </TableRow>
              ))}
              {movimentiPolizza.length === 0 && (
                <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground">Nessun movimento registrato</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCollapsible>

      {/* === SEZIONI RCA AUTO === */}
      {(veicolo as any) && (
        <SectionCollapsible title="Dati Veicolo" icon={Car}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
            <FieldRow label="Settore" value={fmt((veicolo as any).settore)} />
            <FieldRow label="Tipo" value={fmt((veicolo as any).tipo_veicolo)} />
            <FieldRow label="Uso" value={fmt((veicolo as any).uso)} />
            <FieldRow label="Targa" value={fmt((veicolo as any).targa)} />
            <FieldRow label="Marca" value={fmt((veicolo as any).marca)} />
            <FieldRow label="Modello" value={fmt((veicolo as any).modello)} />
            <FieldRow label="Versione" value={fmt((veicolo as any).versione)} />
            <FieldRow label="Veicolo" value={fmt((veicolo as any).veicolo_descrizione)} />
            <FieldRow label="Telaio" value={fmt((veicolo as any).telaio)} />
            <FieldRow label="Immatricolazione" value={fmtDate((veicolo as any).data_immatricolazione)} />
            <FieldRow label="Anno Acquisto" value={fmt((veicolo as any).anno_acquisto)} />
            <FieldRow label="Prov. Circolazione" value={fmt((veicolo as any).provincia_circolazione)} />
            <FieldRow label="Classe B/M" value={fmt((veicolo as any).classe_bm)} />
            <FieldRow label="Massimale 1" value={fmtEuro((veicolo as any).massimale_1)} />
            <FieldRow label="Massimale 2" value={fmtEuro((veicolo as any).massimale_2)} />
            <FieldRow label="Massimale 3" value={fmtEuro((veicolo as any).massimale_3)} />
            <FieldRow label="Peius" value={fmtBool((veicolo as any).peius)} />
            <FieldRow label="Franchigia" value={fmtEuro((veicolo as any).franchigia)} />
            <FieldRow label="Temporanea" value={fmtBool((veicolo as any).temporanea)} />
            <FieldRow label="Carico/Scarico" value={fmtBool((veicolo as any).carico_scarico)} />
            <FieldRow label="CV" value={fmt((veicolo as any).cv)} />
            <FieldRow label="KW" value={fmt((veicolo as any).kw)} />
            <FieldRow label="CC" value={fmt((veicolo as any).cc)} />
            <FieldRow label="Posti" value={fmt((veicolo as any).posti)} />
            <FieldRow label="Peso Mot." value={fmt((veicolo as any).peso_motrice)} />
            <FieldRow label="Peso Rim." value={fmt((veicolo as any).peso_rimorchio)} />
            <FieldRow label="Peso Tot." value={fmt((veicolo as any).peso_totale)} />
            <FieldRow label="Tipologia Guida" value={fmt((veicolo as any).tipologia_guida)} />
            <FieldRow label="Alimentazione" value={fmt((veicolo as any).tipo_alimentazione)} />
          </div>
        </SectionCollapsible>
      )}

      {(premiGaranzia as any[]).length > 0 && (
        <SectionCollapsible title="Premi per Garanzia" icon={ShieldCheck}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Garanzia</TableHead>
                <TableHead className="text-right">Capitale</TableHead>
                <TableHead className="text-right">Tasso</TableHead>
                <TableHead className="text-right">Firma</TableHead>
                <TableHead className="text-right">Rata</TableHead>
                <TableHead className="text-right">Annuo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(premiGaranzia as any[]).map((pg: any) => (
                <TableRow key={pg.id}>
                  <TableCell className="font-medium">{pg.garanzia}</TableCell>
                  <TableCell className="text-right font-mono">{fmtEuro(pg.capitale)}</TableCell>
                  <TableCell className="text-right font-mono">{pg.tasso ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{fmtEuro(pg.firma)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtEuro(pg.rata)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtEuro(pg.annuo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCollapsible>
      )}

      {(conducente as any) && (
        <SectionCollapsible title="Dati Conducente" icon={UserCheck}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
            <FieldRow label="Nome" value={fmt((conducente as any).nome)} />
            <FieldRow label="Cognome" value={fmt((conducente as any).cognome)} />
            <FieldRow label="Indirizzo" value={fmt((conducente as any).indirizzo)} />
            <FieldRow label="CAP" value={fmt((conducente as any).cap)} />
            <FieldRow label="Città" value={fmt((conducente as any).citta)} />
            <FieldRow label="Provincia" value={fmt((conducente as any).provincia)} />
            <FieldRow label="Data Nascita" value={fmtDate((conducente as any).data_nascita)} />
            <FieldRow label="Tipo Patente" value={fmt((conducente as any).tipo_patente)} />
            <FieldRow label="Rilascio Patente" value={fmtDate((conducente as any).data_rilascio_patente)} />
            {(conducente as any).note && <div className="col-span-full"><FieldRow label="Note" value={(conducente as any).note} /></div>}
          </div>
        </SectionCollapsible>
      )}

      {t.note && (
        <Card>
          <CardContent className="pt-4">
            <span className="text-xs text-muted-foreground">Note:</span>
            <p className="text-sm mt-1">{t.note}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="movimenti">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="movimenti"><List className="w-4 h-4 mr-1" />Movimenti ({movimentiPolizza.length})</TabsTrigger>
          <TabsTrigger value="provvigioni"><Percent className="w-4 h-4 mr-1" />Provvigioni ({provvigioni.length})</TabsTrigger>
          <TabsTrigger value="appendici"><FileText className="w-4 h-4 mr-1" />Appendici ({appendiciPolizza.length})</TabsTrigger>
          <TabsTrigger value="garanzie"><ShieldCheck className="w-4 h-4 mr-1" />Garanzie</TabsTrigger>
          <TabsTrigger value="familiari"><Users className="w-4 h-4 mr-1" />Familiari</TabsTrigger>
          <TabsTrigger value="note"><StickyNote className="w-4 h-4 mr-1" />Note</TabsTrigger>
          <TabsTrigger value="documenti"><FileText className="w-4 h-4 mr-1" />Documenti</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="timeline"><Clock className="w-4 h-4 mr-1" />Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="movimenti">
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              I movimenti sono visualizzati nella sezione sopra. Questa tab potrà contenere funzionalità di gestione avanzata (aggiunta rinnovi, appendici, storni).
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="provvigioni">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Beneficiario</TableHead>
                    <TableHead>Percentuale</TableHead>
                    <TableHead>Importo €</TableHead>
                    <TableHead>Calcolata il</TableHead>
                    <TableHead>Pagata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {provvigioni.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.profiles ? `${p.profiles.nome} ${p.profiles.cognome}` : "—"}</TableCell>
                      <TableCell className="font-mono">{p.percentuale}%</TableCell>
                      <TableCell className="font-mono">€ {p.importo_provvigione?.toFixed(2)}</TableCell>
                      <TableCell>{p.calcolata_il ? format(new Date(p.calcolata_il), "dd/MM/yyyy HH:mm", { locale: it }) : "—"}</TableCell>
                      <TableCell><Badge variant={p.pagata ? "default" : "secondary"}>{p.pagata ? "Sì" : "No"}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {provvigioni.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nessuna provvigione generata</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="appendici">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Appendici registrate per questa polizza</p>
                <Button size="sm" onClick={() => navigate(`/portafoglio/appendici?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}`)}>
                  <FileText className="w-4 h-4 mr-1" /> Nuova Appendice
                </Button>
              </div>
              {appendiciPolizza.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nessuna appendice registrata.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">N°</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Effetto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Oggetto</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead className="w-28">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(appendiciPolizza as any[]).map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono font-bold">{a.numero_appendice}</TableCell>
                        <TableCell className="text-sm">{a.data_appendice ? format(new Date(a.data_appendice), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                        <TableCell className="text-sm">{a.data_effetto ? format(new Date(a.data_effetto), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{a.tipo}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{a.oggetto || "—"}</TableCell>
                        <TableCell className="text-sm">{a.nome_file || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Modifica" onClick={() => navigate(`/portafoglio/appendici?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}&appendiceId=${a.id}`)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {a.testo && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Visualizza testo" onClick={() => {
                                const w = window.open("", "_blank");
                                if (w) { w.document.write(`<pre style="white-space:pre-wrap;font-family:sans-serif;padding:2rem">${a.testo}</pre>`); }
                              }}>
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {a.file_path && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Download" onClick={async () => {
                                const { data, error } = await supabase.storage.from("documenti_titoli").download(a.file_path);
                                if (error || !data) return;
                                const url = URL.createObjectURL(data);
                                const link = document.createElement("a");
                                link.href = url; link.download = a.nome_file || "file"; link.click();
                                URL.revokeObjectURL(url);
                              }}>
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="garanzie">
          <Card><CardContent className="pt-6 text-sm text-muted-foreground">Sezione Garanzie — in fase di sviluppo. Qui verranno mostrate le coperture e garanzie della polizza.</CardContent></Card>
        </TabsContent>
        <TabsContent value="familiari">
          <Card><CardContent className="pt-6 text-sm text-muted-foreground">Sezione Familiari — in fase di sviluppo. Qui verranno mostrati assicurati e beneficiari collegati alla polizza.</CardContent></Card>
        </TabsContent>
        <TabsContent value="note">
          <Card><CardContent className="pt-6"><p className="text-sm whitespace-pre-wrap">{t.note || "Nessuna nota."}</p></CardContent></Card>
        </TabsContent>
        <TabsContent value="documenti">
          <Card><CardContent className="pt-6"><DocumentiTab entitaTipo="titolo" entitaId={id!} bucketName="documenti_titoli" /></CardContent></Card>
        </TabsContent>
        <TabsContent value="chat">
          <Card><CardContent className="pt-6"><ChatTab entitaTipo="titolo" entitaId={id!} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="timeline">
          <Card><CardContent className="pt-6"><TimelineTab entitaTipo="titolo" entitaId={id!} /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TitoloDetail;
