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
import { ArrowLeft, FileText, Percent, Clock, ExternalLink, ChevronDown, Calendar, Shield, DollarSign, RefreshCw, LayoutGrid, List, Users, ShieldCheck, StickyNote, Car, UserCheck, CheckSquare, Copy, ArrowRightLeft, XCircle, Download, Eye, Trash2, Pencil, Database, AlertTriangle, Info } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import DocumentiTab from "@/components/DocumentiTab";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import React, { useState, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/SearchableSelect";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RinnovoTitoloDialog } from "@/components/polizze/RinnovoTitoloDialog";
import { VociRcaCard } from "@/components/polizze/VociRcaCard";


const fmt = (v: any) => v ?? "—";
const fmtDate = (v: string | null) => v ? format(new Date(v), "dd/MM/yyyy", { locale: it }) : "—";
const fmtEuro = (v: number | null) => v != null ? `€ ${v.toFixed(2)}` : "—";
const fmtBool = (v: boolean | null) => v ? "Sì" : "No";

// Determina se il ramo della polizza è di tipo Auto/Veicoli (RCA, ARD, statistici RV*).
// In questo caso vanno mostrati i campi tecnici del veicolo.
const RAMI_AUTO_CODICI = new Set(["PI", "QA", "QAC", "QC", "QF", "QG", "QR", "QU", "DAB", "PJ"]);
const isRamoAuto = (ramo: any) => {
  if (!ramo) return false;
  const cod = String(ramo.codice || "").toUpperCase().trim();
  const desc = String(ramo.descrizione || "").toUpperCase();
  if (RAMI_AUTO_CODICI.has(cod)) return true;
  if (cod.startsWith("RV")) return true;
  if (/\bAUTO\b|\bAUTOVEIC|\bAUTOCARR|\bVEICOL/.test(desc)) return true;
  return false;
};

// Sotto-titolo per i blocchi interni alla sezione Veicolo
const SubBlockTitle = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mt-3 mb-2 pb-1 border-b border-border/60">
    {children}
  </h4>
);

const FieldRow = React.forwardRef<HTMLDivElement, { label: string; value: React.ReactNode }>(({ label, value }, ref) => (
  <div ref={ref} className="flex justify-between py-1">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-mono text-right">{value}</span>
  </div>
));
FieldRow.displayName = "FieldRow";

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

  // --- Rinnovo dialog state ---
  const [rinnovoDialogOpen, setRinnovoDialogOpen] = useState(false);

  // --- Conferimento Gestito dialog state ---
  const [conferimentoDialogOpen, setConferimentoDialogOpen] = useState(false);
  const [conferimentoAccettato, setConferimentoAccettato] = useState(false);
  const [conferimentoForm, setConferimentoForm] = useState({ dataMessaCassa: "", dataPagamento: "", dataDecorrenza: "", tipoPagamento: "contanti", banca: "" });

  const { data: titolo, isLoading } = useQuery({
    queryKey: ["titolo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("*, prodotti(nome_prodotto, compagnie(nome)), uffici(nome_ufficio), produttore:profiles!titoli_produttore_id_fkey(nome, cognome, ruolo), cliente:profiles!titoli_cliente_id_fkey(nome, cognome), cliente_anagrafica:clienti!titoli_cliente_anagrafica_id_fkey(id, tipo_cliente, nome, cognome, ragione_sociale, attivita, gruppo_statistico, gruppo_finanziario_id, gruppi_finanziari(nome)), compagnia_diretta:compagnie!titoli_compagnia_id_fkey(id, nome, codice), ramo:rami!titoli_ramo_id_fkey(id, codice, descrizione), commerciale:profiles!titoli_commerciale_id_fkey(nome, cognome, ruolo), anagrafica_commerciale:anagrafiche_professionali!titoli_anagrafica_commerciale_id_fkey(id, ragione_sociale, nome, cognome)")
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

  // Admin anagrafica id (Consulbrokers SPA / casa madre) — dynamic from settings
  const { data: adminAnagraficaId } = useQuery({
    queryKey: ["admin_anagrafica_id"],
    queryFn: async () => {
      const { data } = await supabase
        .from("impostazioni_sistema")
        .select("valore_json")
        .eq("chiave", "admin_anagrafica_id")
        .maybeSingle();
      return ((data?.valore_json as any)?.anagrafica_id as string | null) ?? null;
    },
  });

  const { data: riparto = [] } = useQuery({
    queryKey: ["riparto", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dettaglio_riparto")
        .select("*, agenzie(nome, codice)")
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
      // Determina il nome leggibile da scrivere su produttore_nome (campo testo legacy usato in molte viste)
      let nomeLeggibile: string | null = null;
      if (commForm.anagrafica_commerciale_id) {
        const sel = (anagraficheComm as any[]).find((a: any) => a.value === commForm.anagrafica_commerciale_id);
        nomeLeggibile = sel?.label || null;
      }
      const { data, error } = await supabase
        .from("titoli")
        .update({
          anagrafica_commerciale_id: commForm.anagrafica_commerciale_id || null,
          percentuale_commerciale: commForm.percentuale_commerciale,
          produttore_nome: nomeLeggibile,
        } as any)
        .eq("id", id!)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Nessuna riga aggiornata: verifica i permessi (RLS).");
      }
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
    prodotto_nome: "",
    specialist: "",
    produttore_nome: "",
    ufficio_id: "" as string | null,
    compagnia_id: "" as string | null,
    ramo_id: "" as string | null,
  });

  const tipoPortafoglioOpts = [
    { value: "NUOVA EMISSIONE", label: "NUOVA EMISSIONE" },
    { value: "PORTAFOGLIO PREESISTENTE", label: "PORTAFOGLIO PREESISTENTE" },
    { value: "POLIZZE FAMIGLIA FIORE", label: "POLIZZE FAMIGLIA FIORE" },
    { value: "gestione", label: "Gestione" },
  ];

  const { data: produttoriOpts = [] } = useQuery({
    queryKey: ["produttori-anagrafiche"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, nome, cognome, ragione_sociale, tipo")
        .in("tipo", ["account_executive", "corrispondente", "responsabile_sede"])
        .eq("attivo", true)
        .order("cognome");
      return (data || []).map((p: any) => {
        const label = p.ragione_sociale || `${p.cognome || ""} ${p.nome || ""}`.trim();
        return { value: label, label };
      });
    },
    enabled: editingContratto,
  });

  const { data: compagnieOpts = [] } = useQuery({
    queryKey: ["agenzie-attive-titolo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("compagnie")
        .select("id, nome, codice, gruppo_compagnia")
        .eq("attiva", true)
        .order("nome");
      return (data || []).map((c: any) => ({
        value: c.id,
        label: `${c.codice ? c.codice + " - " : ""}${c.nome}`,
        description: c.gruppo_compagnia ? `Gruppo: ${c.gruppo_compagnia}` : undefined,
        searchText: c.gruppo_compagnia || undefined,
      }));
    },
    enabled: editingContratto,
  });

  const { data: ramiOpts = [] } = useQuery({
    queryKey: ["rami-attivi-titolo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rami")
        .select("id, codice, descrizione")
        .eq("attivo", true)
        .order("codice");
      return (data || []).map((r: any) => ({
        value: r.id,
        label: `${r.codice} - ${r.descrizione}`,
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
        prodotto_nome: (titolo as any).prodotto_nome ?? "",
        specialist: (titolo as any).specialist ?? "",
        produttore_nome: (titolo as any).produttore_nome ?? "",
        ufficio_id: (titolo as any).ufficio_id ?? null,
        compagnia_id: (titolo as any).compagnia_id ?? null,
        ramo_id: (titolo as any).ramo_id ?? null,
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
        "descrizione_polizza", "prodotto_nome", "specialist", "produttore_nome",
        "ufficio_id", "compagnia_id", "ramo_id",
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
          prodotto_nome: contrattoForm.prodotto_nome || null,
          specialist: contrattoForm.specialist || null,
          produttore_nome: contrattoForm.produttore_nome || null,
          ufficio_id: contrattoForm.ufficio_id || null,
          compagnia_id: contrattoForm.compagnia_id || null,
          ramo_id: contrattoForm.ramo_id || null,
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
    tacito_rinnovo: true as boolean,
    disdetta_mesi: "" as string,
  });

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
        tacito_rinnovo: t.tacito_rinnovo ?? true,
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
        "data_competenza", "data_scadenza", "limite_mora", "mora_giorni", "tacito_rinnovo", "disdetta_mesi",
      ];
      const numericFields = new Set(["anni_durata", "rate", "mora_giorni", "disdetta_mesi"]);
      const booleanFields = new Set(["tacito_rinnovo"]);
      const payload: Record<string, any> = {};
      fields.forEach((f) => {
        const raw = periodoForm[f];
        let newV: any;
        if (booleanFields.has(f as string)) {
          newV = Boolean(raw);
        } else {
          newV = raw === "" || raw == null ? null : (numericFields.has(f as string) ? Number(raw) : raw);
        }
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

  // --- Importi edit state ---
  const [editingImporti, setEditingImporti] = useState(false);
  const [vociRcaTotali, setVociRcaTotali] = useState<{ netto: number; tasse: number; lordo: number } | null>(null);
  const vociRcaSyncTimer = useRef<any>(null);
  const vociRcaQuietanzaTimer = useRef<any>(null);
  const [importiForm, setImportiForm] = useState({
    premio_netto: "" as string,
    addizionali: "" as string,
    tasse: "" as string,
    premio_lordo: "" as string,
    provvigioni_firma: "" as string,
    premio_netto_quietanza: "" as string,
    addizionali_quietanza: "" as string,
    tasse_quietanza: "" as string,
    provvigioni_quietanza: "" as string,
    valuta: "EUR" as string,
    cambio: "" as string,
    indicizzata: false as boolean,
    rimborso: false as boolean,
  });
  const [lordoFirmaTouched, setLordoFirmaTouched] = useState(false);

  // Helper: ricalcola lordo firma da netto+add+tasse
  const recalcLordoFirma = (netto: string, addiz: string, tasse: string) => {
    const n = parseFloat(netto);
    const a = parseFloat(addiz);
    const t = parseFloat(tasse);
    if (isNaN(n) && isNaN(a) && isNaN(t)) return "";
    return ((isNaN(n) ? 0 : n) + (isNaN(a) ? 0 : a) + (isNaN(t) ? 0 : t)).toFixed(2);
  };

  const valutaOpts = [
    { value: "EUR", label: "EUR €" },
    { value: "USD", label: "USD $" },
    { value: "GBP", label: "GBP £" },
    { value: "CHF", label: "CHF" },
  ];

  const startEditImporti = () => {
    if (titolo) {
      const t: any = titolo;
      setImportiForm({
        premio_netto: t.premio_netto != null ? String(t.premio_netto) : "",
        addizionali: t.addizionali != null ? String(t.addizionali) : "",
        tasse: t.tasse != null ? String(t.tasse) : "",
        premio_lordo: t.premio_lordo != null ? String(t.premio_lordo) : "",
        provvigioni_firma: t.provvigioni_firma != null ? String(t.provvigioni_firma) : "",
        premio_netto_quietanza: t.premio_netto_quietanza != null ? String(t.premio_netto_quietanza) : "",
        addizionali_quietanza: t.addizionali_quietanza != null ? String(t.addizionali_quietanza) : "",
        tasse_quietanza: t.tasse_quietanza != null ? String(t.tasse_quietanza) : "",
        provvigioni_quietanza: t.provvigioni_quietanza != null ? String(t.provvigioni_quietanza) : "",
        valuta: t.valuta ?? "EUR",
        cambio: t.cambio != null ? String(t.cambio) : "",
        indicizzata: !!t.indicizzata,
        rimborso: !!t.rimborso,
      });
    }
    setLordoFirmaTouched(false);
    setEditingImporti(true);
  };

  // Auto-calculated lordo (firma) suggestion
  const suggestedLordoFirma = (() => {
    const n = parseFloat(importiForm.premio_netto);
    const a = parseFloat(importiForm.addizionali);
    const ta = parseFloat(importiForm.tasse);
    if (isNaN(n) && isNaN(a) && isNaN(ta)) return null;
    return (isNaN(n) ? 0 : n) + (isNaN(a) ? 0 : a) + (isNaN(ta) ? 0 : ta);
  })();
  const suggestedLordoQuietanza = (() => {
    const n = parseFloat(importiForm.premio_netto_quietanza);
    const a = parseFloat(importiForm.addizionali_quietanza);
    const ta = parseFloat(importiForm.tasse_quietanza);
    if (isNaN(n) && isNaN(a) && isNaN(ta)) return null;
    return (isNaN(n) ? 0 : n) + (isNaN(a) ? 0 : a) + (isNaN(ta) ? 0 : ta);
  })();

  const saveImportiMutation = useMutation({
    mutationFn: async () => {
      const numericFields = [
        "premio_netto", "addizionali", "tasse", "premio_lordo", "provvigioni_firma",
        "premio_netto_quietanza", "addizionali_quietanza", "tasse_quietanza", "provvigioni_quietanza",
        "cambio",
      ] as const;

      // Validations
      const errs: string[] = [];
      numericFields.forEach((f) => {
        const v = (importiForm as any)[f];
        if (v !== "" && v != null) {
          const n = Number(v);
          if (isNaN(n)) errs.push(`${f}: valore non numerico`);
          else if (n < 0 && f !== "cambio") errs.push(`${f}: deve essere ≥ 0`);
        }
      });
      // Cambio rimosso dalla UI: forziamo sempre 1
      importiForm.cambio = "1";

      if (errs.length) throw new Error(errs.join(" • "));

      // Warnings (non-blocking)
      const lordoTyped = parseFloat(importiForm.premio_lordo);
      if (!isNaN(lordoTyped) && suggestedLordoFirma != null && Math.abs(lordoTyped - suggestedLordoFirma) > 0.01) {
        toast.warning(`Premio Lordo (${lordoTyped.toFixed(2)}) ≠ Netto+Add+Tasse (${suggestedLordoFirma.toFixed(2)})`);
      }
      const provF = parseFloat(importiForm.provvigioni_firma);
      const nettoF = parseFloat(importiForm.premio_netto);
      if (!isNaN(provF) && !isNaN(nettoF) && provF > nettoF) {
        toast.warning("Provvigioni Firma > Premio Netto Firma");
      }

      const before: Record<string, any> = {};
      const after: Record<string, any> = {};
      const payload: Record<string, any> = {};
      const allFields = [
        ...numericFields,
        "valuta", "indicizzata", "rimborso",
      ] as const;
      allFields.forEach((f) => {
        const raw = (importiForm as any)[f];
        let newV: any;
        if (typeof raw === "boolean") newV = raw;
        else if (raw === "" || raw == null) newV = null;
        else if ((numericFields as readonly string[]).includes(f)) newV = Number(raw);
        else newV = raw;
        const oldV = (titolo as any)?.[f] ?? (typeof raw === "boolean" ? false : null);
        if (oldV !== newV) { before[f] = oldV; after[f] = newV; }
        payload[f] = newV;
      });

      // === Auto-coherence: ricalcolo premio_lordo se incoerente ===
      const autoFixes: string[] = [];
      const nettoFirmaNew = payload.premio_netto;
      const tasseFirmaNew = payload.tasse;
      const addizFirmaNew = payload.addizionali;
      if (nettoFirmaNew != null || tasseFirmaNew != null || addizFirmaNew != null) {
        const computedLordo =
          (Number(nettoFirmaNew) || 0) + (Number(tasseFirmaNew) || 0) + (Number(addizFirmaNew) || 0);
        const currentLordo = payload.premio_lordo;
        if (currentLordo == null || Math.abs(Number(currentLordo) - computedLordo) > 0.01) {
          const oldLordo = (titolo as any)?.premio_lordo ?? null;
          if (oldLordo !== computedLordo) {
            before.premio_lordo = oldLordo;
            after.premio_lordo = computedLordo;
          }
          payload.premio_lordo = computedLordo;
          autoFixes.push("Premio Lordo ricalcolato");
        }
      }

      // === Sincronizzazione Firma → Quietanza ===
      // Se l'utente ha modificato un campo Firma e il corrispondente Quietanza non è stato toccato
      // (cioè è rimasto uguale al valore in DB), propaghiamo il nuovo valore Firma anche alla Quietanza.
      const syncPairs: Array<[string, string]> = [
        ["premio_netto", "premio_netto_quietanza"],
        ["tasse", "tasse_quietanza"],
        ["addizionali", "addizionali_quietanza"],
        ["provvigioni_firma", "provvigioni_quietanza"],
      ];
      let syncedQuietanza = false;
      syncPairs.forEach(([firmaKey, quietKey]) => {
        const firmaOld = (titolo as any)?.[firmaKey] ?? null;
        const firmaNew = payload[firmaKey];
        const quietOld = (titolo as any)?.[quietKey] ?? null;
        const quietNew = payload[quietKey];
        const firmaChanged = firmaOld !== firmaNew;
        const quietUntouched = quietOld === quietNew;
        if (firmaChanged && quietUntouched && firmaNew !== quietNew) {
          payload[quietKey] = firmaNew;
          before[quietKey] = quietOld;
          after[quietKey] = firmaNew;
          syncedQuietanza = true;
        }
      });

      // Se ho sincronizzato netto/tasse/addiz quietanza, ricalcolo anche eventuale lordo quietanza coerente
      // (qui non c'è premio_lordo_quietanza nello schema, ma teniamo il flag per il toast)
      if (syncedQuietanza) autoFixes.push("Quietanza allineata alla Firma");

      const { error } = await supabase.from("titoli").update(payload as any).eq("id", id!);
      if (error) throw error;

      if (Object.keys(after).length > 0) {
        await logAttivita({
          azione: "modifica_importi",
          entita_tipo: "titolo",
          entita_id: id!,
          dettagli_json: { campi_modificati: Object.keys(after), before, after },
          severity: "info",
        });
      }

      return { autoFixes };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", id] });
      toast.success("Importi aggiornati");
      if (res?.autoFixes?.length) {
        toast.info(res.autoFixes.join(" • "));
      }
      setEditingImporti(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // --- Veicolo edit state ---
  const [editingVeicolo, setEditingVeicolo] = useState(false);
  const [veicoloForm, setVeicoloForm] = useState<any>({});

  const TIPI_VEICOLO_OPTS = [
    "AUTOVETTURA","AUTOTASSAMETRO","AUTOBUS","AUTOCARRO","CICLOMOTORE","MOTOCICLO",
    "MACCHINA OPERATRICE","MACCHINA AGRICOLA","NATANTE","RIMORCHIO","CARRELLO",
    "AUTOARTICOLATO","CAMPER","QUADRICICLO",
  ].map((v) => ({ value: v, label: v }));
  const CLASSI_BM_OPTS = Array.from({ length: 18 }, (_, i) => ({ value: String(i + 1), label: `Classe ${i + 1}` }));
  const ALIMENTAZIONE_OPTS = ["BENZINA","DIESEL","GPL","METANO","ELETTRICA","IBRIDA","IBRIDA PLUG-IN","BIFUEL","ALTRO"].map((v) => ({ value: v, label: v }));
  const TIPOLOGIA_GUIDA_OPTS = ["LIBERA","ESCLUSIVA","ESPERTA"].map((v) => ({ value: v, label: v }));

  const startEditVeicolo = () => {
    const v: any = veicolo || { titolo_id: id };
    setVeicoloForm({
      settore: v.settore ?? "",
      tipo_veicolo: v.tipo_veicolo ?? "",
      uso: v.uso ?? "",
      targa: v.targa ?? "",
      marca: v.marca ?? "",
      modello: v.modello ?? "",
      versione: v.versione ?? "",
      veicolo_descrizione: v.veicolo_descrizione ?? "",
      telaio: v.telaio ?? "",
      data_immatricolazione: v.data_immatricolazione ?? "",
      anno_acquisto: v.anno_acquisto != null ? String(v.anno_acquisto) : "",
      provincia_circolazione: v.provincia_circolazione ?? "",
      classe_bm: v.classe_bm ?? "",
      massimale_1: v.massimale_1 != null ? String(v.massimale_1) : "",
      massimale_2: v.massimale_2 != null ? String(v.massimale_2) : "",
      massimale_3: v.massimale_3 != null ? String(v.massimale_3) : "",
      peius: !!v.peius,
      franchigia: v.franchigia != null ? String(v.franchigia) : "",
      temporanea: !!v.temporanea,
      carico_scarico: !!v.carico_scarico,
      rimorchio: !!v.rimorchio,
      competizione: !!v.competizione,
      cv: v.cv != null ? String(v.cv) : "",
      kw: v.kw != null ? String(v.kw) : "",
      cc: v.cc != null ? String(v.cc) : "",
      posti: v.posti != null ? String(v.posti) : "",
      peso_motrice: v.peso_motrice != null ? String(v.peso_motrice) : "",
      peso_rimorchio: v.peso_rimorchio != null ? String(v.peso_rimorchio) : "",
      peso_totale: v.peso_totale != null ? String(v.peso_totale) : "",
      tipologia_guida: v.tipologia_guida ?? "",
      tipo_alimentazione: v.tipo_alimentazione ?? "",
    });
    setEditingVeicolo(true);
  };

  const saveVeicoloMutation = useMutation({
    mutationFn: async () => {
      const intFields = ["anno_acquisto","cv","kw","cc","posti","peso_motrice","peso_rimorchio","peso_totale"];
      const numFields = ["massimale_1","massimale_2","massimale_3","franchigia"];
      const boolFields = ["peius","temporanea","carico_scarico","rimorchio","competizione"];
      const payload: any = { titolo_id: id };
      Object.keys(veicoloForm).forEach((k) => {
        const raw = veicoloForm[k];
        if (boolFields.includes(k)) payload[k] = !!raw;
        else if (intFields.includes(k)) payload[k] = raw === "" || raw == null ? null : parseInt(raw, 10);
        else if (numFields.includes(k)) payload[k] = raw === "" || raw == null ? null : Number(raw);
        else payload[k] = raw === "" ? null : raw;
      });
      // Validations
      const errs: string[] = [];
      [...intFields, ...numFields].forEach((f) => {
        if (payload[f] != null && (isNaN(payload[f]) || payload[f] < 0)) errs.push(`${f}: deve essere ≥ 0`);
      });
      if (payload.targa) payload.targa = String(payload.targa).toUpperCase().trim();
      if (payload.telaio) payload.telaio = String(payload.telaio).toUpperCase().trim();
      if (payload.telaio && payload.telaio.length !== 17) errs.push("Telaio (VIN) deve avere 17 caratteri");
      if (errs.length) throw new Error(errs.join(" • "));

      const { error } = await supabase.from("veicoli_polizza").upsert(payload, { onConflict: "titolo_id" });
      if (error) throw error;

      await logAttivita({
        azione: veicolo ? "modifica_veicolo" : "crea_veicolo",
        entita_tipo: "titolo",
        entita_id: id!,
        dettagli_json: { campi: Object.keys(veicoloForm) },
        severity: "info",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["veicolo-polizza", id] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", id] });
      toast.success("Dati veicolo salvati");
      setEditingVeicolo(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // --- Premi Garanzia edit state ---
  const [editingPremi, setEditingPremi] = useState(false);
  const [premiRows, setPremiRows] = useState<any[]>([]);

  const startEditPremi = () => {
    const rows = (premiGaranzia as any[]).map((p) => ({
      id: p.id,
      garanzia: p.garanzia ?? "",
      capitale: p.capitale != null ? String(p.capitale) : "",
      tasso: p.tasso != null ? String(p.tasso) : "",
      firma: p.firma != null ? String(p.firma) : "",
      rata: p.rata != null ? String(p.rata) : "",
      annuo: p.annuo != null ? String(p.annuo) : "",
      ordine: p.ordine ?? 0,
      _existing: true,
    }));
    setPremiRows(rows);
    setEditingPremi(true);
  };

  const addPremiRow = () => {
    setPremiRows((prev) => [
      ...prev,
      { garanzia: "", capitale: "", tasso: "", firma: "", rata: "", annuo: "", ordine: prev.length, _existing: false, _new: true },
    ]);
  };

  const removePremiRow = (idx: number) => {
    setPremiRows((prev) => prev.map((r, i) => (i === idx ? { ...r, _deleted: true } : r)));
  };

  const updatePremiRow = (idx: number, field: string, value: any) => {
    setPremiRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const savePremiMutation = useMutation({
    mutationFn: async () => {
      const errs: string[] = [];
      const numFields = ["capitale","tasso","firma","rata","annuo"];
      premiRows.forEach((r, i) => {
        if (r._deleted) return;
        if (!r.garanzia || !String(r.garanzia).trim()) errs.push(`Riga ${i + 1}: garanzia obbligatoria`);
        numFields.forEach((f) => {
          if (r[f] !== "" && r[f] != null) {
            const n = Number(r[f]);
            if (isNaN(n) || n < 0) errs.push(`Riga ${i + 1}: ${f} non valido`);
          }
        });
      });
      if (errs.length) throw new Error(errs.join(" • "));

      // Delete removed existing rows
      const toDelete = premiRows.filter((r) => r._deleted && r._existing).map((r) => r.id);
      if (toDelete.length) {
        const { error } = await supabase.from("premi_garanzia_polizza").delete().in("id", toDelete);
        if (error) throw error;
      }
      // Upsert remaining
      const toUpsert = premiRows
        .filter((r) => !r._deleted)
        .map((r, i) => ({
          ...(r._existing ? { id: r.id } : {}),
          titolo_id: id,
          garanzia: String(r.garanzia).trim(),
          capitale: r.capitale === "" ? null : Number(r.capitale),
          tasso: r.tasso === "" ? null : Number(r.tasso),
          firma: r.firma === "" ? null : Number(r.firma),
          rata: r.rata === "" ? null : Number(r.rata),
          annuo: r.annuo === "" ? null : Number(r.annuo),
          ordine: i,
        }));
      if (toUpsert.length) {
        const { error } = await supabase.from("premi_garanzia_polizza").upsert(toUpsert as any);
        if (error) throw error;
      }

      await logAttivita({
        azione: "modifica_premi_garanzia",
        entita_tipo: "titolo",
        entita_id: id!,
        dettagli_json: { righe_totali: toUpsert.length, righe_eliminate: toDelete.length },
        severity: "info",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["premi-garanzia", id] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", id] });
      toast.success("Premi per garanzia salvati");
      setEditingPremi(false);
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
          <p className="text-muted-foreground text-sm">{(t as any).prodotto_nome || t.prodotti?.nome_prodotto || ""} — {(t.compagnia_diretta as any)?.nome || t.prodotti?.compagnie?.nome || "N/D"}</p>
        </div>
        {t.stato === "in_attesa_rinnovo" ? (
          <Badge className="ml-auto text-sm bg-orange-500 hover:bg-orange-600 text-white" title="Diventerà attivo quando la polizza precedente sarà messa a cassa">
            In attesa rinnovo
          </Badge>
        ) : (
          <Badge variant={t.stato === "incassato" ? "default" : t.stato === "stornato" ? "destructive" : "secondary"} className="ml-auto text-sm">
            {t.stato}
          </Badge>
        )}
      </div>

      {/* Card dedicata: rinnovo in attesa di messa a cassa della polizza precedente */}
      {t.stato === "in_attesa_rinnovo" && (
        <Card className="border-orange-400 bg-orange-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" /> Rinnovo in attesa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Questo titolo è un rinnovo della polizza{" "}
              <span className="font-mono font-semibold">{t.sostituisce_polizza}</span>
              {t.sostituisce_riga != null ? <> / riga {t.sostituisce_riga}</> : null}.
              Diventerà <strong>attivo automaticamente</strong> quando la polizza precedente verrà messa a cassa,
              e solo allora apparirà nel <em>Carico del Mese</em> di scadenza.
            </p>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="text-orange-700 border-orange-400 hover:bg-orange-100"
                onClick={async () => {
                  if (!confirm("Forzare l'attivazione di questo rinnovo senza attendere la messa a cassa della polizza precedente?")) return;
                  const { error } = await (supabase.from("titoli") as any).update({ stato: "attivo", updated_at: new Date().toISOString() }).eq("id", id);
                  if (error) { toast.error("Errore: " + error.message); return; }
                  await logAttivita({ azione: "forza_attivazione_rinnovo", entita_tipo: "titolo", entita_id: id!, dettagli_json: { polizza_precedente: t.sostituisce_polizza } });
                  toast.success("Rinnovo attivato");
                  queryClient.invalidateQueries({ queryKey: ["titolo"] });
                  queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
                }}
              >
                Forza attivazione
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Operazioni — per polizze sospese mostra solo Riattivazione; nascosto per scaduto */}
      {t.stato === "sospeso" ? (
        <Card className="border-yellow-400 bg-yellow-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-700" /> Polizza Sospesa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Questa polizza è attualmente sospesa. Puoi riattivarla per ripristinare la copertura.
            </p>
            <Button size="sm" onClick={() => navigate(`/portafoglio/riattivazione?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}`)}>
              <CheckSquare className="w-4 h-4 mr-1" /> Riattiva Polizza
            </Button>
          </CardContent>
        </Card>
      ) : t.stato !== "scaduto" && (
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
            <Button
              size="sm"
              onClick={() => setRinnovoDialogOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-1" /> Rinnovo
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
            <Button variant="outline" size="sm" onClick={() => navigate(`/portafoglio/doc-precontrattuale?titoloId=${encodeURIComponent(t.id)}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}`)}>
              <FileText className="w-4 h-4 mr-1" /> Precontrattuale
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

      {/* Dove sono salvati i dati — sezione informativa sulla persistenza delle operazioni ciclo vita */}
      <Collapsible>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  Dove sono salvati i dati
                  <span className="text-xs font-normal text-muted-foreground">
                    (reference tabelle aggiornate per ogni operazione)
                  </span>
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3 text-sm">
              {[
                {
                  icon: RefreshCw,
                  nome: "Regolazione",
                  header: "titoli — campi: regolazione=true, tipo_scadenza, periodicita, scadenza_regolazione",
                  movimento: "— nessun movimento dedicato (è una proprietà del titolo, non un evento)",
                  collegate: "attivita_log",
                  note: null,
                },
                {
                  icon: Clock,
                  nome: "Sospensione",
                  header: "titoli — campi: stato='sospeso', data_sospensione",
                  movimento: "movimenti_polizza — tipo_documento='SO', data_movimento, note",
                  collegate: "attivita_log",
                  note: null,
                },
                {
                  icon: CheckSquare,
                  nome: "Riattivazione",
                  header: "titoli — campi: stato='attivo', data_riattivazione",
                  movimento: "movimenti_polizza — tipo_documento='RA', data_movimento, note",
                  collegate: "attivita_log",
                  note: null,
                },
                {
                  icon: ArrowRightLeft,
                  nome: "Sostituzione / Rinnovo",
                  header: "titoli — nuovo record (numero_titolo nuovo) + sostituito_da_id sul vecchio titolo",
                  movimento: "movimenti_polizza — tipo_documento='RN' sul nuovo titolo",
                  collegate: "attivita_log (su entrambi i titoli, vecchio e nuovo)",
                  note: null,
                },
                {
                  icon: FileText,
                  nome: "Appendice",
                  header: "titoli — invariato (la polizza non cambia)",
                  movimento: "movimenti_polizza — tipo_documento='AP' (riferimento all'appendice)",
                  collegate: "appendici_polizza (record principale) + Storage (file PDF allegato)",
                  note: null,
                },
                {
                  icon: XCircle,
                  nome: "Storno",
                  header: "titoli — campi: stato='scaduto', data_storno",
                  movimento: "— (gap noto: nessun movimento dedicato 'ST' viene attualmente generato)",
                  collegate: "attivita_log",
                  note: "Lo storno aggiorna solo lo stato del titolo. Non viene creata una riga in movimenti_polizza con tipo_documento='ST'.",
                },
              ].map((op) => {
                const Icon = op.icon;
                return (
                  <div key={op.nome} className="border rounded-md p-3 bg-muted/30">
                    <div className="flex items-center gap-2 mb-2 font-semibold">
                      <Icon className="w-4 h-4 text-primary" />
                      <span>{op.nome}</span>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground pl-6">
                      <div><span className="font-medium text-foreground">Tabella header:</span> <code className="font-mono text-[11px]">{op.header}</code></div>
                      <div><span className="font-medium text-foreground">Movimento:</span> <code className="font-mono text-[11px]">{op.movimento}</code></div>
                      <div><span className="font-medium text-foreground">Tabelle collegate:</span> <code className="font-mono text-[11px]">{op.collegate}</code></div>
                      {op.note && (
                        <div className="flex gap-1 mt-2 pt-2 border-t border-border/50 text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{op.note}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
            {/* Banner informativo: spiega perché Incassa/Garantito non sono disponibili */}
            {t.data_messa_cassa && !isPoliennale && (
              <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Polizza già messa a cassa il {new Date(t.data_messa_cassa).toLocaleDateString("it-IT")}.</strong>{" "}
                  Le azioni <em>Incassa</em> e <em>Garantito</em> non sono disponibili: una polizza non può essere incassata due volte.
                  {isAdmin && " Per registrare un nuovo incasso, annulla prima la messa a cassa precedente."}
                </div>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {/* Incassa/Garantito visibili solo se polizza attiva E non ancora messa a cassa
                  (oppure poliennale attiva con rate residue da incassare).
                  Una polizza già incassata NON può essere incassata di nuovo. */}
              {t.stato === "attivo" && (!t.data_messa_cassa || isPoliennale) && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  setCassaForm({ dataMessaCassa: today, dataPagamento: today, dataDecorrenza: today, tipoPagamento: "contanti", banca: "" });
                  setCassaDialogOpen(true);
                }} disabled={changeStatoMutation.isPending}>
                  <CheckSquare className="w-4 h-4 mr-1" /> Incassa
                </Button>
              )}
              {t.stato === "attivo" && (!t.data_messa_cassa || isPoliennale) && (
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

      {/* Dialog Rinnovo Polizza */}
      <RinnovoTitoloDialog open={rinnovoDialogOpen} onOpenChange={setRinnovoDialogOpen} titolo={t} />

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
              <p>Tutto quanto non regolarizzato alla data di chiusura del mese non verrà rimesso alle agenzie entro il giorno 10 del mese successivo.</p>
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
            <FieldRow label="Agenzia / Agenzia di rif." value={
              <span>{(t.compagnia_diretta as any)?.codice || ""} - {(t.compagnia_diretta as any)?.nome || t.prodotti?.compagnie?.nome || "—"}</span>
            } />
            <FieldRow label="Ramo" value={`${(t.ramo as any)?.codice || ""} ${(t.ramo as any)?.descrizione || "—"}`} />
            <FieldRow label="Prodotto" value={fmt((t as any).prodotto_nome || t.prodotti?.nome_prodotto)} />
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
            <FieldRow label="Produttore" value={fmt((t as any).produttore_nome || (t.produttore ? `${(t.produttore as any).nome || ""} ${(t.produttore as any).cognome || ""}`.trim() : ""))} />
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
              <Label className="text-xs">Agenzia / Agenzia di rif.</Label>
              <SearchableSelect
                options={compagnieOpts}
                value={contrattoForm.compagnia_id || ""}
                onValueChange={(v) => setContrattoForm(p => ({ ...p, compagnia_id: v || null }))}
                placeholder="— Seleziona agenzia / agenzia —"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ramo</Label>
              <SearchableSelect
                options={ramiOpts}
                value={contrattoForm.ramo_id || ""}
                onValueChange={(v) => setContrattoForm(p => ({ ...p, ramo_id: v || null }))}
                placeholder="Seleziona ramo"
              />
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
              <Input
                type="text"
                placeholder="Es. Tutela Legale, Cyber Risk…"
                value={contrattoForm.prodotto_nome}
                onChange={(e) => setContrattoForm(p => ({ ...p, prodotto_nome: e.target.value }))}
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
                value={contrattoForm.produttore_nome}
                onValueChange={(v) => setContrattoForm(p => ({ ...p, produttore_nome: v }))}
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
            <FieldRow label="Tacito Rinnovo" value={t.tacito_rinnovo ? "Sì" : "No"} />
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
              <Label className="text-xs">Tacito Rinnovo</Label>
              <div className="flex items-center gap-2 h-9">
                <Switch
                  checked={periodoForm.tacito_rinnovo}
                  onCheckedChange={(v) => setPeriodoForm(p => ({ ...p, tacito_rinnovo: v }))}
                />
                <span className="text-sm text-muted-foreground">
                  {periodoForm.tacito_rinnovo ? "Sì" : "No"}
                </span>
              </div>
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
              const anagComm: any = (t as any).anagrafica_commerciale;
              const anagCommName = anagComm
                ? (anagComm.ragione_sociale || `${anagComm.cognome || ""} ${anagComm.nome || ""}`.trim())
                : null;
              const commName = anagCommName || t.produttore_nome || (t.commerciale ? `${(t.commerciale as any).nome} ${(t.commerciale as any).cognome}` : "Sede");
              const anagCommId = (t as any).anagrafica_commerciale_id as string | null;
              const commercialeIsAdmin = !!adminAnagraficaId && !!anagCommId && anagCommId === adminAnagraficaId;
              const importoComm = provvQ != null ? provvQ * percComm / 100 : 0;
              const importoAdmin = provvQ != null ? provvQ * (100 - percComm) / 100 : 0;
              return (
                <div className="space-y-3">
                  {commercialeIsAdmin && (
                    <div className="text-xs px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-900">
                      Commerciale = Consulbrokers SPA (admin) → split <strong>solo statistico</strong>: l'intera quota va a Consulbrokers SPA.
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
                    <FieldRow label="Commerciale" value={commName} />
                    <FieldRow label="% Commerciale" value={`${percComm}%`} />
                    {provvQ != null && provvQ > 0 && (
                      <>
                        <FieldRow
                          label={commercialeIsAdmin ? "Provv. Commerciale (statistica)" : "Provv. Commerciale"}
                          value={fmtEuro(importoComm)}
                        />
                        <FieldRow
                          label="Provv. Consulbrokers SPA"
                          value={fmtEuro(commercialeIsAdmin ? provvQ : importoAdmin)}
                        />
                      </>
                    )}
                  </div>
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
        <div className="flex justify-end mb-2 gap-2">
          {!editingImporti ? (
            <Button variant="ghost" size="sm" onClick={startEditImporti}>
              <Pencil className="w-4 h-4 mr-1" /> Modifica
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditingImporti(false)}>Annulla</Button>
              <Button size="sm" onClick={() => saveImportiMutation.mutate()} disabled={saveImportiMutation.isPending}>
                {saveImportiMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </>
          )}
        </div>

        {!editingImporti ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Premio alla firma odierno</h4>
                <div className="space-y-0">
                  <FieldRow label="Premio Netto" value={fmtEuro(t.premio_netto)} />
                  <FieldRow label="Addizionali" value={fmtEuro(t.addizionali)} />
                  <FieldRow label="Tasse" value={fmtEuro(t.tasse)} />
                  <FieldRow label="Premio Lordo" value={fmtEuro(t.premio_lordo)} />
                  <FieldRow label="Provvigioni" value={fmtEuro(t.provvigioni_firma)} />
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Premio prossima quietanza</h4>
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
              <FieldRow label="Indicizzata" value={fmtBool(t.indicizzata)} />
              <FieldRow label="Rimborso" value={fmtBool(t.rimborso)} />
              <FieldRow label="Pag. Diretto Comp." value={fmtBool(t.pag_diretto_compagnia)} />
              <FieldRow label="Formato Elettronico" value={fmtBool(t.formato_elettronico)} />
              <FieldRow label="Incassato" value={fmtEuro(t.importo_incassato)} />
              <FieldRow label="Data Incasso" value={fmtDate(t.data_incasso)} />
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* FIRMA */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Premio alla firma odierno</h4>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Premio Netto (€)</Label>
                    <Input type="number" step="0.01" value={importiForm.premio_netto}
                      onChange={(e) => {
                        const v = e.target.value;
                        setImportiForm((prev) => ({
                          ...prev,
                          premio_netto: v,
                          ...(lordoFirmaTouched ? {} : { premio_lordo: recalcLordoFirma(v, prev.addizionali, prev.tasse) }),
                        }));
                      }} />
                  </div>
                  <div>
                    <Label className="text-xs">Addizionali (€)</Label>
                    <Input type="number" step="0.01" value={importiForm.addizionali}
                      onChange={(e) => {
                        const v = e.target.value;
                        setImportiForm((prev) => ({
                          ...prev,
                          addizionali: v,
                          ...(lordoFirmaTouched ? {} : { premio_lordo: recalcLordoFirma(prev.premio_netto, v, prev.tasse) }),
                        }));
                      }} />
                  </div>
                  <div>
                    <Label className="text-xs">Tasse (€)</Label>
                    <Input type="number" step="0.01" value={importiForm.tasse}
                      onChange={(e) => {
                        const v = e.target.value;
                        setImportiForm((prev) => ({
                          ...prev,
                          tasse: v,
                          ...(lordoFirmaTouched ? {} : { premio_lordo: recalcLordoFirma(prev.premio_netto, prev.addizionali, v) }),
                        }));
                      }} />
                  </div>
                  <div>
                    <Label className="text-xs">Premio Lordo (€)</Label>
                    <Input type="number" step="0.01" value={importiForm.premio_lordo}
                      onChange={(e) => {
                        setLordoFirmaTouched(true);
                        setImportiForm({ ...importiForm, premio_lordo: e.target.value });
                      }} />
                    {!lordoFirmaTouched ? (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Aggiornato automaticamente da Netto + Addizionali + Tasse
                      </p>
                    ) : suggestedLordoFirma != null && Math.abs((parseFloat(importiForm.premio_lordo) || 0) - suggestedLordoFirma) > 0.01 ? (
                      <button type="button"
                        className="text-[11px] text-amber-600 hover:text-amber-700 mt-0.5 text-left"
                        onClick={() => {
                          setLordoFirmaTouched(false);
                          setImportiForm({ ...importiForm, premio_lordo: suggestedLordoFirma.toFixed(2) });
                        }}>
                        ⚠ Valore manuale ≠ calcolato (€ {suggestedLordoFirma.toFixed(2)}) — clicca per riallineare
                      </button>
                    ) : null}
                  </div>
                  <div>
                    <Label className="text-xs">Provvigioni (€)</Label>
                    <Input type="number" step="0.01" value={importiForm.provvigioni_firma}
                      onChange={(e) => setImportiForm({ ...importiForm, provvigioni_firma: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* QUIETANZA */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Premio prossima quietanza</h4>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Premio Netto (€)</Label>
                    <Input type="number" step="0.01" value={importiForm.premio_netto_quietanza}
                      onChange={(e) => setImportiForm({ ...importiForm, premio_netto_quietanza: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Addizionali (€)</Label>
                    <Input type="number" step="0.01" value={importiForm.addizionali_quietanza}
                      onChange={(e) => setImportiForm({ ...importiForm, addizionali_quietanza: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Tasse (€)</Label>
                    <Input type="number" step="0.01" value={importiForm.tasse_quietanza}
                      onChange={(e) => setImportiForm({ ...importiForm, tasse_quietanza: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Totale (calcolato)</Label>
                    <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted text-sm font-mono">
                      {suggestedLordoQuietanza != null ? `€ ${suggestedLordoQuietanza.toFixed(2)}` : "—"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Provvigioni (€)</Label>
                    <Input type="number" step="0.01" value={importiForm.provvigioni_quietanza}
                      onChange={(e) => setImportiForm({ ...importiForm, provvigioni_quietanza: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            {/* VALUTA & FLAGS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t">
              <div>
                <Label className="text-xs">Valuta</Label>
                <SearchableSelect
                  options={valutaOpts}
                  value={importiForm.valuta}
                  onValueChange={(v) => setImportiForm({ ...importiForm, valuta: v, cambio: "1" })}
                  placeholder="Valuta"
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={importiForm.indicizzata}
                  onCheckedChange={(c) => setImportiForm({ ...importiForm, indicizzata: c })} />
                <Label className="text-xs">Indicizzata</Label>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={importiForm.rimborso}
                  onCheckedChange={(c) => setImportiForm({ ...importiForm, rimborso: c })} />
                <Label className="text-xs">Rimborso</Label>
              </div>
            </div>

            <div className="text-xs text-muted-foreground pt-2 border-t">
              <strong>Read-only:</strong> Pag. Diretto Agenzia, Formato Elettronico, Incassato, Data Incasso (gestiti da Messa a Cassa / configurazione prodotto)
            </div>
          </div>
        )}

        {/* Composizione voci RCA Auto - Firma + Quietanza, integrate nella sezione Importi */}
        {isRamoAuto((t as any).ramo) && (
          <div className="mt-6 pt-4 border-t-2 border-dashed border-teal-200 dark:border-teal-900 space-y-4">
            <p className="text-xs text-muted-foreground">
              ℹ️ Per le polizze <strong>RCA Auto</strong> i premi sono calcolati come somma delle singole garanzie. La <strong>Quietanza</strong> è inizialmente uno specchio della <strong>Firma</strong> e si aggiorna automaticamente; ogni voce della Quietanza modificata a mano viene marcata come "personalizzata" e non viene più sovrascritta.
            </p>
            <div className="space-y-4">
              <VociRcaCard
                tipoPremio="firma"
                titoloId={t.id}
                premioLordoTitolo={(t as any).premio_lordo}
                provinciaCliente={(t as any).cliente_anagrafica?.provincia_residenza || (t as any).cliente_anagrafica?.provincia}
                onTotaliChange={(tot) => {
                  setVociRcaTotali(tot);
                  if (editingImporti) return;
                  if (vociRcaSyncTimer.current) clearTimeout(vociRcaSyncTimer.current);
                  vociRcaSyncTimer.current = setTimeout(async () => {
                    const curNetto = Number((titolo as any)?.premio_netto ?? 0);
                    const curTasse = Number((titolo as any)?.tasse ?? 0);
                    const curLordo = Number((titolo as any)?.premio_lordo ?? 0);
                    if (
                      Math.abs(curNetto - tot.netto) < 0.01 &&
                      Math.abs(curTasse - tot.tasse) < 0.01 &&
                      Math.abs(curLordo - tot.lordo) < 0.01
                    ) return;
                    const { error } = await supabase
                      .from("titoli")
                      .update({ premio_netto: tot.netto, tasse: tot.tasse, premio_lordo: tot.lordo })
                      .eq("id", t.id);
                    if (!error) queryClient.invalidateQueries({ queryKey: ["titolo", t.id] });
                  }, 800);
                }}
              />
              <VociRcaCard
                tipoPremio="quietanza"
                titoloId={t.id}
                provinciaCliente={(t as any).cliente_anagrafica?.provincia_residenza || (t as any).cliente_anagrafica?.provincia}
                onTotaliChange={(tot) => {
                  if (editingImporti) return;
                  if (vociRcaQuietanzaTimer.current) clearTimeout(vociRcaQuietanzaTimer.current);
                  vociRcaQuietanzaTimer.current = setTimeout(async () => {
                    const curNetto = Number((titolo as any)?.premio_netto_quietanza ?? 0);
                    const curTasse = Number((titolo as any)?.tasse_quietanza ?? 0);
                    if (
                      Math.abs(curNetto - tot.netto) < 0.01 &&
                      Math.abs(curTasse - tot.tasse) < 0.01
                    ) return;
                    const { error } = await supabase
                      .from("titoli")
                      .update({
                        premio_netto_quietanza: tot.netto,
                        tasse_quietanza: tot.tasse,
                        addizionali_quietanza: 0,
                      })
                      .eq("id", t.id);
                    if (!error) queryClient.invalidateQueries({ queryKey: ["titolo", t.id] });
                  }, 800);
                }}
              />
            </div>
          </div>
        )}
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
              <TableHead>Agenzia</TableHead>
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

      {/* === SEZIONE DATI VEICOLO / RCA AUTO ===
          Visibile solo se il ramo della polizza è di tipo Auto/Veicoli,
          oppure (caso legacy) se esiste già un record veicoli_polizza collegato. */}
      {(isRamoAuto((t as any).ramo) || veicolo) && (
      <SectionCollapsible title="Dati Veicolo (RCA Auto)" icon={Car}>
        <div className="flex justify-between items-center mb-2 gap-2">
          <div>
            {!isRamoAuto((t as any).ramo) && veicolo && (
              <Badge variant="outline" className="text-xs">Dati legacy — ramo non auto</Badge>
            )}
          </div>
          <div className="flex gap-2">
          {!editingVeicolo ? (
            <Button variant="ghost" size="sm" onClick={startEditVeicolo}>
              <Pencil className="w-4 h-4 mr-1" /> {veicolo ? "Modifica" : "Aggiungi"}
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditingVeicolo(false)}>Annulla</Button>
              <Button size="sm" onClick={() => saveVeicoloMutation.mutate()} disabled={saveVeicoloMutation.isPending}>
                {saveVeicoloMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </>
          )}
          </div>
        </div>

        {!editingVeicolo ? (
          (veicolo as any) ? (
            <div className="space-y-2">
              {/* 1. Identificazione veicolo */}
              <SubBlockTitle>Identificazione veicolo</SubBlockTitle>
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
              </div>

              {/* 2. Dati tecnici */}
              <SubBlockTitle>Dati tecnici</SubBlockTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
                <FieldRow label="CV" value={fmt((veicolo as any).cv)} />
                <FieldRow label="KW" value={fmt((veicolo as any).kw)} />
                <FieldRow label="CC" value={fmt((veicolo as any).cc)} />
                <FieldRow label="Posti" value={fmt((veicolo as any).posti)} />
                <FieldRow label="Peso Mot." value={fmt((veicolo as any).peso_motrice)} />
                <FieldRow label="Peso Rim." value={fmt((veicolo as any).peso_rimorchio)} />
                <FieldRow label="Peso Tot." value={fmt((veicolo as any).peso_totale)} />
                <FieldRow label="Alimentazione" value={fmt((veicolo as any).tipo_alimentazione)} />
                <FieldRow label="Tipologia Guida" value={fmt((veicolo as any).tipologia_guida)} />
              </div>

              {/* 3. Garanzie e massimali */}
              <SubBlockTitle>Garanzie e massimali</SubBlockTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
                <FieldRow label="Massimale 1" value={fmtEuro((veicolo as any).massimale_1)} />
                <FieldRow label="Massimale 2" value={fmtEuro((veicolo as any).massimale_2)} />
                <FieldRow label="Massimale 3" value={fmtEuro((veicolo as any).massimale_3)} />
                <FieldRow label="Franchigia" value={fmtEuro((veicolo as any).franchigia)} />
                <FieldRow label="Peius" value={fmtBool((veicolo as any).peius)} />
                <FieldRow label="Temporanea" value={fmtBool((veicolo as any).temporanea)} />
                <FieldRow label="Carico/Scarico" value={fmtBool((veicolo as any).carico_scarico)} />
                <FieldRow label="Rimorchio" value={fmtBool((veicolo as any).rimorchio)} />
                <FieldRow label="Competizione" value={fmtBool((veicolo as any).competizione)} />
              </div>

              {/* 4. Bonus / Malus */}
              <SubBlockTitle>Bonus / Malus</SubBlockTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
                <FieldRow label="Classe B/M (CU)" value={fmt((veicolo as any).classe_bm)} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Nessun dato veicolo. Clicca "Aggiungi" per inserirli.</p>
          )
        ) : (
          <div className="space-y-3">
            {/* 1. Identificazione veicolo */}
            <SubBlockTitle>Identificazione veicolo</SubBlockTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div><Label className="text-xs">Settore</Label><Input value={veicoloForm.settore} onChange={(e) => setVeicoloForm({ ...veicoloForm, settore: e.target.value })} /></div>
              <div><Label className="text-xs">Tipo Veicolo</Label><SearchableSelect options={TIPI_VEICOLO_OPTS} value={veicoloForm.tipo_veicolo} onValueChange={(v) => setVeicoloForm({ ...veicoloForm, tipo_veicolo: v })} placeholder="Seleziona..." /></div>
              <div><Label className="text-xs">Uso</Label><Input value={veicoloForm.uso} onChange={(e) => setVeicoloForm({ ...veicoloForm, uso: e.target.value })} /></div>
              <div><Label className="text-xs">Targa</Label><Input value={veicoloForm.targa} onChange={(e) => setVeicoloForm({ ...veicoloForm, targa: e.target.value.toUpperCase() })} /></div>
              <div><Label className="text-xs">Marca</Label><Input value={veicoloForm.marca} onChange={(e) => setVeicoloForm({ ...veicoloForm, marca: e.target.value.toUpperCase() })} /></div>
              <div><Label className="text-xs">Modello</Label><Input value={veicoloForm.modello} onChange={(e) => setVeicoloForm({ ...veicoloForm, modello: e.target.value.toUpperCase() })} /></div>
              <div><Label className="text-xs">Versione</Label><Input value={veicoloForm.versione} onChange={(e) => setVeicoloForm({ ...veicoloForm, versione: e.target.value })} /></div>
              <div><Label className="text-xs">Descrizione Veicolo</Label><Input value={veicoloForm.veicolo_descrizione} onChange={(e) => setVeicoloForm({ ...veicoloForm, veicolo_descrizione: e.target.value })} /></div>
              <div><Label className="text-xs">Telaio (VIN)</Label><Input maxLength={17} value={veicoloForm.telaio} onChange={(e) => setVeicoloForm({ ...veicoloForm, telaio: e.target.value.toUpperCase() })} /></div>
              <div><Label className="text-xs">Immatricolazione</Label><Input type="date" value={veicoloForm.data_immatricolazione || ""} onChange={(e) => setVeicoloForm({ ...veicoloForm, data_immatricolazione: e.target.value })} /></div>
              <div><Label className="text-xs">Anno Acquisto</Label><Input type="number" value={veicoloForm.anno_acquisto} onChange={(e) => setVeicoloForm({ ...veicoloForm, anno_acquisto: e.target.value })} /></div>
              <div><Label className="text-xs">Prov. Circolazione</Label><Input maxLength={2} value={veicoloForm.provincia_circolazione} onChange={(e) => setVeicoloForm({ ...veicoloForm, provincia_circolazione: e.target.value.toUpperCase() })} /></div>
            </div>

            {/* 2. Dati tecnici */}
            <SubBlockTitle>Dati tecnici</SubBlockTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div><Label className="text-xs">CV</Label><Input type="number" value={veicoloForm.cv} onChange={(e) => setVeicoloForm({ ...veicoloForm, cv: e.target.value })} /></div>
              <div><Label className="text-xs">KW</Label><Input type="number" value={veicoloForm.kw} onChange={(e) => setVeicoloForm({ ...veicoloForm, kw: e.target.value })} /></div>
              <div><Label className="text-xs">CC</Label><Input type="number" value={veicoloForm.cc} onChange={(e) => setVeicoloForm({ ...veicoloForm, cc: e.target.value })} /></div>
              <div><Label className="text-xs">Posti</Label><Input type="number" value={veicoloForm.posti} onChange={(e) => setVeicoloForm({ ...veicoloForm, posti: e.target.value })} /></div>
              <div><Label className="text-xs">Peso Motrice (kg)</Label><Input type="number" value={veicoloForm.peso_motrice} onChange={(e) => setVeicoloForm({ ...veicoloForm, peso_motrice: e.target.value })} /></div>
              <div><Label className="text-xs">Peso Rimorchio (kg)</Label><Input type="number" value={veicoloForm.peso_rimorchio} onChange={(e) => setVeicoloForm({ ...veicoloForm, peso_rimorchio: e.target.value })} /></div>
              <div><Label className="text-xs">Peso Totale (kg)</Label><Input type="number" value={veicoloForm.peso_totale} onChange={(e) => setVeicoloForm({ ...veicoloForm, peso_totale: e.target.value })} /></div>
              <div><Label className="text-xs">Alimentazione</Label><SearchableSelect options={ALIMENTAZIONE_OPTS} value={veicoloForm.tipo_alimentazione} onValueChange={(v) => setVeicoloForm({ ...veicoloForm, tipo_alimentazione: v })} placeholder="Seleziona..." /></div>
              <div><Label className="text-xs">Tipologia Guida</Label><SearchableSelect options={TIPOLOGIA_GUIDA_OPTS} value={veicoloForm.tipologia_guida} onValueChange={(v) => setVeicoloForm({ ...veicoloForm, tipologia_guida: v })} placeholder="Seleziona..." /></div>
            </div>

            {/* 3. Garanzie e massimali */}
            <SubBlockTitle>Garanzie e massimali</SubBlockTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div><Label className="text-xs">Massimale 1 €</Label><Input type="number" step="0.01" value={veicoloForm.massimale_1} onChange={(e) => setVeicoloForm({ ...veicoloForm, massimale_1: e.target.value })} /></div>
              <div><Label className="text-xs">Massimale 2 €</Label><Input type="number" step="0.01" value={veicoloForm.massimale_2} onChange={(e) => setVeicoloForm({ ...veicoloForm, massimale_2: e.target.value })} /></div>
              <div><Label className="text-xs">Massimale 3 €</Label><Input type="number" step="0.01" value={veicoloForm.massimale_3} onChange={(e) => setVeicoloForm({ ...veicoloForm, massimale_3: e.target.value })} /></div>
              <div><Label className="text-xs">Franchigia €</Label><Input type="number" step="0.01" value={veicoloForm.franchigia} onChange={(e) => setVeicoloForm({ ...veicoloForm, franchigia: e.target.value })} /></div>
              <div className="flex items-center gap-2 pt-5"><Switch checked={veicoloForm.peius} onCheckedChange={(v) => setVeicoloForm({ ...veicoloForm, peius: v })} /><Label className="text-xs">Peius</Label></div>
              <div className="flex items-center gap-2 pt-5"><Switch checked={veicoloForm.temporanea} onCheckedChange={(v) => setVeicoloForm({ ...veicoloForm, temporanea: v })} /><Label className="text-xs">Temporanea</Label></div>
              <div className="flex items-center gap-2 pt-5"><Switch checked={veicoloForm.carico_scarico} onCheckedChange={(v) => setVeicoloForm({ ...veicoloForm, carico_scarico: v })} /><Label className="text-xs">Carico/Scarico</Label></div>
              <div className="flex items-center gap-2 pt-5"><Switch checked={!!veicoloForm.rimorchio} onCheckedChange={(v) => setVeicoloForm({ ...veicoloForm, rimorchio: v })} /><Label className="text-xs">Rimorchio</Label></div>
              <div className="flex items-center gap-2 pt-5"><Switch checked={!!veicoloForm.competizione} onCheckedChange={(v) => setVeicoloForm({ ...veicoloForm, competizione: v })} /><Label className="text-xs">Competizione</Label></div>
            </div>

            {/* 4. Bonus / Malus */}
            <SubBlockTitle>Bonus / Malus</SubBlockTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div><Label className="text-xs">Classe B/M (CU)</Label><SearchableSelect options={CLASSI_BM_OPTS} value={veicoloForm.classe_bm} onValueChange={(v) => setVeicoloForm({ ...veicoloForm, classe_bm: v })} placeholder="Seleziona..." /></div>
            </div>
          </div>
        )}
      </SectionCollapsible>
      )}

      <SectionCollapsible title="Premi per Garanzia" icon={ShieldCheck}>
        <div className="flex justify-end mb-2 gap-2">
          {!editingPremi ? (
            <Button variant="ghost" size="sm" onClick={startEditPremi}>
              <Pencil className="w-4 h-4 mr-1" /> Modifica
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={addPremiRow}>+ Aggiungi riga</Button>
              <Button variant="outline" size="sm" onClick={() => setEditingPremi(false)}>Annulla</Button>
              <Button size="sm" onClick={() => savePremiMutation.mutate()} disabled={savePremiMutation.isPending}>
                {savePremiMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </>
          )}
        </div>

        {!editingPremi ? (
          (premiGaranzia as any[]).length > 0 ? (
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
          ) : (
            <p className="text-sm text-muted-foreground italic">Nessuna garanzia. Clicca "Modifica" per aggiungerne.</p>
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Garanzia *</TableHead>
                <TableHead>Capitale €</TableHead>
                <TableHead>Tasso ‰</TableHead>
                <TableHead>Firma €</TableHead>
                <TableHead>Rata €</TableHead>
                <TableHead>Annuo €</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {premiRows.filter((r) => !r._deleted).map((r, displayIdx) => {
                const realIdx = premiRows.findIndex((row) => row === r);
                return (
                  <TableRow key={r.id ?? `new-${displayIdx}`}>
                    <TableCell><Input value={r.garanzia} onChange={(e) => updatePremiRow(realIdx, "garanzia", e.target.value)} placeholder="Es. RCA, Furto..." /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={r.capitale} onChange={(e) => updatePremiRow(realIdx, "capitale", e.target.value)} /></TableCell>
                    <TableCell><Input type="number" step="0.001" value={r.tasso} onChange={(e) => updatePremiRow(realIdx, "tasso", e.target.value)} /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={r.firma} onChange={(e) => updatePremiRow(realIdx, "firma", e.target.value)} /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={r.rata} onChange={(e) => updatePremiRow(realIdx, "rata", e.target.value)} /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={r.annuo} onChange={(e) => updatePremiRow(realIdx, "annuo", e.target.value)} /></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => removePremiRow(realIdx)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                );
              })}
              {premiRows.filter((r) => !r._deleted).length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground italic">Nessuna riga. Clicca "+ Aggiungi riga".</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </SectionCollapsible>

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
          {/* Voci RCA spostate dentro la sezione Importi */}
          <TabsTrigger value="familiari"><Users className="w-4 h-4 mr-1" />Familiari</TabsTrigger>
          <TabsTrigger value="note"><StickyNote className="w-4 h-4 mr-1" />Note</TabsTrigger>
          <TabsTrigger value="documenti"><FileText className="w-4 h-4 mr-1" />Documenti</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="timeline"><Clock className="w-4 h-4 mr-1" />Log Attività</TabsTrigger>
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
        {/* Voci RCA: integrate dentro la sezione Importi sopra */}
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
