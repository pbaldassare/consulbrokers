import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Briefcase, Users, UserCog, Building2, Trash2, ShieldAlert } from "lucide-react";
import { FiscalCodeInput } from "@/components/ui/FiscalCodeInput";
import { assertFiscalValid } from "@/lib/assertFiscalValid";
import { DateInput } from "@/components/ui/date-input";
import { cn } from "@/lib/utils";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import SediManager from "@/components/anagrafiche/SediManager";
import SchedaTab from "@/components/shared/SchedaTab";
import SpecialistList from "@/components/anagrafiche/SpecialistList";
import SpecialistSinistriList from "@/components/anagrafiche/SpecialistSinistriList";
import ProduttoreProvvigioniRamoTab from "@/components/anagrafiche/ProduttoreProvvigioniRamoTab";
import DeleteWithImpactDialog from "@/components/common/DeleteWithImpactDialog";
import { ValidatedInput } from "@/components/ui/validated-input";
import { matchesAnagraficaListSearch } from "@/lib/searchNoEmail";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/SearchableSelect";
import { RUOLI_COMMERCIALI, labelRuoli, ruoliDi } from "@/lib/ruoliAnagrafica";
import { canEditProducerCommissions } from "@/lib/anagrafichePermissions";

/** value ISO yyyy-MM-dd o "" */
const DateField = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <DateInput value={value?.slice(0, 10) ?? ""} onChange={(e) => onChange(e.target.value)} />
);

const TIPI = [
  { value: "account_executive", label: "Account Executive", icon: Briefcase },
  { value: "corrispondente", label: "Produttori", icon: Users },
  { value: "responsabile_sede", label: "Resp. Sede", icon: Users },
] as const;

// Tab speciali (non basati su anagrafiche_professionali)
const EXTRA_TABS = [
  { value: "specialist", label: "Specialist", icon: UserCog },
  { value: "specialist_sinistri", label: "Specialist Sinistri", icon: ShieldAlert },
  { value: "sedi", label: "Sedi", icon: Building2 },
] as const;

type TipoAnagrafica = typeof TIPI[number]["value"];
type TabValue = TipoAnagrafica | typeof EXTRA_TABS[number]["value"];

interface Anagrafica {
  id: string;
  tipo: string;
  ruoli: string[] | null;
  codice: string | null;
  nome: string | null;
  nome_breve: string | null;
  cognome: string | null;
  ragione_sociale: string | null;
  codice_fiscale: string | null;
  partita_iva: string | null;
  email: string | null;
  pec: string | null;
  telefono: string | null;
  cellulare: string | null;
  fax: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  compagnia_id: string | null;
  specializzazione: string | null;
  albo_numero: string | null;
  referente_nome: string | null;
  referente_email: string | null;
  studio_ufficio: string | null;
  note: string | null;
  attivo: boolean | null;
  ufficio_id: string | null;
  sigla: string | null;
  banca_riga1: string | null;
  banca_riga2: string | null;
  banca_riga3: string | null;
  nome_rui: string | null;
  iscrizione_rui: string | null;
  data_iscrizione_rui: string | null;
  numero_rui: string | null;
  sezione_rui: string | null;
  annullato: boolean | null;
  percentuale_base: number | null;
  codice_fornitore: string | null;
  percentuale_ra: number | null;
  percentuale_consulenza: number | null;
  trattenuta_provvigioni_incasso: boolean | null;
  abi: string | null;
  cab: string | null;
  iban: string | null;
  intestatario_cc: string | null;
}

const emptyForm = {
  codice: "", nome: "", nome_breve: "", cognome: "", ragione_sociale: "",
  codice_fiscale: "", partita_iva: "",
  email: "", pec: "", telefono: "", cellulare: "", fax: "",
  indirizzo: "", cap: "", citta: "", provincia: "",
  compagnia_id: "", specializzazione: "", albo_numero: "",
  referente_nome: "", referente_email: "", studio_ufficio: "", note: "",
  ufficio_id: "",
  // AE
  sigla: "", banca_riga1: "", banca_riga2: "", banca_riga3: "",
  nome_rui: "", iscrizione_rui: "", data_iscrizione_rui: "", numero_rui: "", sezione_rui: "",
  // Produttori / commerciali
  percentuale_base: "", percentuale_consulenza: "", codice_fornitore: "", percentuale_ra: "4.60",
  trattenuta_provvigioni_incasso: false,
  abi: "", cab: "", iban: "", intestatario_cc: "",
  ruoli: [] as string[],
};

const AnagraficheInternePage = () => {
  const { profile, isAdmin } = useAuth();
  const readOnly = profile?.ruolo === "ufficio";
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabValue) || "account_executive";
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingEditId, setPendingEditId] = useState<string | null>(searchParams.get("edit"));
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const isAnagraficaTab = (TIPI as readonly { value: string }[]).some(t => t.value === activeTab);
  const tipoAnagrafica = isAnagraficaTab ? (activeTab as TipoAnagrafica) : "account_executive";

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["anagrafiche_professionali", tipoAnagrafica],
    enabled: isAnagraficaTab,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anagrafiche_professionali")
        .select("*")
        .contains("ruoli", [tipoAnagrafica])
        .order("cognome", { ascending: true });
      if (error) throw error;
      return data as unknown as Anagrafica[];
    },
  });

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie_select"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  const { data: ufficiList = [] } = useQuery({
    queryKey: ["uffici_select"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio, codice_ufficio").eq("attivo", true).order("nome_ufficio");
      return (data || []) as unknown as { id: string; nome_ufficio: string; codice_ufficio: string }[];
    },
  });

  const isCommerciale = ['account_executive', 'corrispondente', 'responsabile_sede'].includes(activeTab);
  const isAE = activeTab === "account_executive";
  const isCorr = activeTab === "corrispondente";
  const isNewCommercial = activeTab === "responsabile_sede";
  const isProduttore = isCommerciale;
  const canEditProvvigioni = canEditProducerCommissions({
    role: profile?.ruolo,
    isAdmin,
    activeTab,
    editingId,
  });
  const [editingTipo, setEditingTipo] = useState<string | null>(null);
  const tipoPrincipale = editingTipo ?? tipoAnagrafica;
  const ruoliForm = Array.from(new Set([tipoPrincipale, ...form.ruoli]));
  // AE puri: nessuna Sede. Se la scheda ha anche altri ruoli valgono le regole di quei ruoli.
  const soloAE = ruoliForm.every((r) => r === "account_executive");
  const haCorr = ruoliForm.includes("corrispondente");
  const [mergeDupId, setMergeDupId] = useState("");

  const { data: schedeCommerciali = [] } = useQuery({
    queryKey: ["anagrafiche_professionali", "commerciali-merge"],
    enabled: dialogOpen && isAdmin && !!editingId && isCommerciale,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anagrafiche_professionali")
        .select("id, cognome, nome, ragione_sociale, codice, codice_fiscale, tipo, ruoli")
        .overlaps("ruoli", RUOLI_COMMERCIALI.map((r) => r.value))
        .eq("attivo", true)
        .order("cognome", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Pick<Anagrafica, "id" | "cognome" | "nome" | "ragione_sociale" | "codice" | "codice_fiscale" | "tipo" | "ruoli">[];
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!editingId || !mergeDupId) throw new Error("Selezionare la scheda da unire");
      const { error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: Error | null }>)(
        "unisci_anagrafiche_professionali",
        { p_master: editingId, p_dup: mergeDupId },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anagrafiche_professionali"] });
      queryClient.invalidateQueries({ queryKey: ["anagrafiche-ae-produttore"] });
      toast.success("Schede unite: polizze, provvigioni e clienti ora puntano a questa scheda");
      setMergeDupId("");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      assertFiscalValid([
        { label: "Codice Fiscale", value: form.codice_fiscale, kind: "cf-azienda" },
        { label: "Partita IVA", value: form.partita_iva, kind: "piva" },
      ]);
      // Account Executive: SEMPRE indipendenti dalla Sede (ufficio_id = NULL).
      // Corrispondenti: Sede opzionale. Altri ruoli commerciali: Sede dell'utente o quella scelta.
      const resolvedUfficioId = soloAE
        ? null
        : haCorr
          ? (form.ufficio_id || null)
          : isProduttore
            ? (form.ufficio_id || profile?.ufficio_id || null)
            : (profile?.ufficio_id || null);

      if (isProduttore && !haCorr && !soloAE && !resolvedUfficioId) {
        throw new Error("Selezionare un ufficio per il produttore");
      }

      const payload: Record<string, unknown> = {
        tipo: tipoAnagrafica,
        ruoli: ruoliForm,
        codice: form.codice || null,
        nome: form.nome || null,
        nome_breve: form.nome_breve || null,
        cognome: form.cognome || null,
        ragione_sociale: form.ragione_sociale || null,
        codice_fiscale: form.codice_fiscale || null,
        partita_iva: form.partita_iva || null,
        email: form.email || null,
        pec: form.pec || null,
        telefono: form.telefono || null,
        cellulare: form.cellulare || null,
        fax: form.fax || null,
        indirizzo: form.indirizzo || null,
        cap: form.cap || null,
        citta: form.citta || null,
        provincia: form.provincia || null,
        compagnia_id: form.compagnia_id || null,
        specializzazione: form.specializzazione || null,
        albo_numero: form.albo_numero || null,
        referente_nome: form.referente_nome || null,
        referente_email: form.referente_email || null,
        studio_ufficio: form.studio_ufficio || null,
        note: form.note || null,
        ufficio_id: resolvedUfficioId,
        sigla: form.sigla || null,
        banca_riga1: form.banca_riga1 || null,
        banca_riga2: form.banca_riga2 || null,
        banca_riga3: form.banca_riga3 || null,
        nome_rui: form.nome_rui || null,
        data_iscrizione_rui: form.data_iscrizione_rui || null,
        numero_rui: form.numero_rui || null,
        sezione_rui: form.sezione_rui || null,
        percentuale_base: form.percentuale_base ? Number(form.percentuale_base) : 0,
        percentuale_consulenza: form.percentuale_consulenza ? Number(form.percentuale_consulenza) : 0,
        codice_fornitore: form.codice_fornitore || null,
        percentuale_ra: form.percentuale_ra ? Number(form.percentuale_ra) : 4.60,
        trattenuta_provvigioni_incasso: haCorr ? form.trattenuta_provvigioni_incasso : false,
        abi: form.abi || null,
        cab: form.cab || null,
        iban: form.iban || null,
        intestatario_cc: form.intestatario_cc || null,
      };
      const { error } = await supabase.from("anagrafiche_professionali").insert([payload as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anagrafiche_professionali"] });
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("Anagrafica creata con successo");
    },
    onError: (e: Error) => {
      toast.error(e?.message || "Errore durante la creazione");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("Nessun record selezionato");
      assertFiscalValid([
        { label: "Codice Fiscale", value: form.codice_fiscale, kind: "cf-azienda" },
        { label: "Partita IVA", value: form.partita_iva, kind: "piva" },
      ]);
      // AE sempre senza Sede; corrispondente opzionale; altri ruoli commerciali obbligatoria.
      const resolvedUfficioId = soloAE
        ? null
        : haCorr
          ? (form.ufficio_id || null)
          : isProduttore
            ? (form.ufficio_id || profile?.ufficio_id || null)
            : (profile?.ufficio_id || null);
      if (isProduttore && !haCorr && !soloAE && !resolvedUfficioId) {
        throw new Error("Sede obbligatoria: assegna una Sede prima di salvare");
      }

      const payload: Record<string, unknown> = {
        codice: form.codice || null,
        nome: form.nome || null,
        nome_breve: form.nome_breve || null,
        cognome: form.cognome || null,
        ragione_sociale: form.ragione_sociale || null,
        codice_fiscale: form.codice_fiscale || null,
        partita_iva: form.partita_iva || null,
        email: form.email || null,
        pec: form.pec || null,
        telefono: form.telefono || null,
        cellulare: form.cellulare || null,
        fax: form.fax || null,
        indirizzo: form.indirizzo || null,
        cap: form.cap || null,
        citta: form.citta || null,
        provincia: form.provincia || null,
        compagnia_id: form.compagnia_id || null,
        specializzazione: form.specializzazione || null,
        albo_numero: form.albo_numero || null,
        referente_nome: form.referente_nome || null,
        referente_email: form.referente_email || null,
        studio_ufficio: form.studio_ufficio || null,
        note: form.note || null,
        ufficio_id: resolvedUfficioId,
        sigla: form.sigla || null,
        banca_riga1: form.banca_riga1 || null,
        banca_riga2: form.banca_riga2 || null,
        banca_riga3: form.banca_riga3 || null,
        nome_rui: form.nome_rui || null,
        data_iscrizione_rui: form.data_iscrizione_rui || null,
        numero_rui: form.numero_rui || null,
        sezione_rui: form.sezione_rui || null,
        percentuale_base: form.percentuale_base ? Number(form.percentuale_base) : 0,
        percentuale_consulenza: form.percentuale_consulenza ? Number(form.percentuale_consulenza) : 0,
        codice_fornitore: form.codice_fornitore || null,
        percentuale_ra: form.percentuale_ra ? Number(form.percentuale_ra) : 4.60,
        trattenuta_provvigioni_incasso: haCorr ? form.trattenuta_provvigioni_incasso : false,
        abi: form.abi || null,
        cab: form.cab || null,
        iban: form.iban || null,
        intestatario_cc: form.intestatario_cc || null,
        ruoli: ruoliForm,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("anagrafiche_professionali").update(payload).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anagrafiche_professionali"] });
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      toast.success("Anagrafica aggiornata con successo");
    },
    onError: (e: Error) => {
      toast.error(e?.message || "Errore durante l'aggiornamento");
    },
  });

  const officeCommissionsMutation = useMutation({
    mutationFn: async () => {
      if (!editingId || profile?.ruolo !== "ufficio" || !isCorr) {
        throw new Error("Modifica provvigioni non consentita");
      }

      const payload = {
        percentuale_base: form.percentuale_base ? Number(form.percentuale_base) : 0,
        percentuale_consulenza: form.percentuale_consulenza ? Number(form.percentuale_consulenza) : 0,
        percentuale_ra: form.percentuale_ra ? Number(form.percentuale_ra) : 4.60,
        trattenuta_provvigioni_incasso: haCorr ? form.trattenuta_provvigioni_incasso : false,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("anagrafiche_professionali")
        .update(payload)
        .eq("id", editingId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Puoi modificare solo i produttori delle tue sedi");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anagrafiche_professionali"] });
      toast.success("Provvigioni produttore aggiornate");
    },
    onError: (e: Error) => {
      toast.error(e?.message || "Errore durante l'aggiornamento delle provvigioni");
    },
  });

  const openEdit = (item: Anagrafica) => {
    setEditingId(item.id);
    setEditingTipo(item.tipo);
    setMergeDupId("");
    setForm({
      codice: item.codice || "",
      nome: item.nome || "",
      nome_breve: item.nome_breve || "",
      cognome: item.cognome || "",
      ragione_sociale: item.ragione_sociale || "",
      codice_fiscale: item.codice_fiscale || "",
      partita_iva: item.partita_iva || "",
      email: item.email || "",
      pec: item.pec || "",
      telefono: item.telefono || "",
      cellulare: item.cellulare || "",
      fax: item.fax || "",
      indirizzo: item.indirizzo || "",
      cap: item.cap || "",
      citta: item.citta || "",
      provincia: item.provincia || "",
      compagnia_id: item.compagnia_id || "",
      specializzazione: item.specializzazione || "",
      albo_numero: item.albo_numero || "",
      referente_nome: item.referente_nome || "",
      referente_email: item.referente_email || "",
      studio_ufficio: item.studio_ufficio || "",
      note: item.note || "",
      ufficio_id: item.ufficio_id || "",
      sigla: item.sigla || "",
      banca_riga1: item.banca_riga1 || "",
      banca_riga2: item.banca_riga2 || "",
      banca_riga3: item.banca_riga3 || "",
      nome_rui: item.nome_rui || "",
      iscrizione_rui: item.iscrizione_rui || "",
      data_iscrizione_rui: item.data_iscrizione_rui || "",
      numero_rui: item.numero_rui || "",
      sezione_rui: item.sezione_rui || "",
      percentuale_base: item.percentuale_base?.toString() || "",
      percentuale_consulenza: item.percentuale_consulenza?.toString() || "",
      codice_fornitore: item.codice_fornitore || "",
      percentuale_ra: item.percentuale_ra?.toString() || "4.60",
      trattenuta_provvigioni_incasso: !!item.trattenuta_provvigioni_incasso,
      abi: item.abi || "",
      cab: item.cab || "",
      iban: item.iban || "",
      intestatario_cc: item.intestatario_cc || "",
      ruoli: ruoliDi(item),
    });
    setDialogOpen(true);
  };

  // Deep-link: aprire in edit l'anagrafica richiesta dal Centro Utenti via ?edit=<id>
  // Linka per id di profiles tramite codice_fornitore o codice (heuristica): cerchiamo per id direttamente
  // Nota: si applica ai tab anagrafica
  if (pendingEditId && isAnagraficaTab && items.length > 0) {
    const target = items.find((i) => i.id === pendingEditId);
    if (target && editingId !== target.id) {
      // apri al prossimo tick per evitare loop di setState durante render
      setTimeout(() => {
        openEdit(target);
        setPendingEditId(null);
        const sp = new URLSearchParams(searchParams);
        sp.delete("edit");
        setSearchParams(sp, { replace: true });
      }, 0);
    }
  }

  const toggleMutation = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("anagrafiche_professionali").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["anagrafiche_professionali"] });
      toast.success(vars.attivo ? "Anagrafica attivata" : "Anagrafica disattivata");
    },
    onError: (e: Error) => toast.error(e?.message || "Errore aggiornamento stato"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("anagrafiche_professionali").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anagrafiche_professionali"] });
      setConfirmDeleteOpen(false);
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success("Anagrafica eliminata");
    },
    onError: (e: any) => {
      toast.error(e?.message || "Errore durante l'eliminazione");
    },
  });

  const filtered = items.filter((item) => matchesAnagraficaListSearch(item, search));

  const tipoLabel = TIPI.find((t) => t.value === activeTab)?.label || "";
  const isPeritiLegali = false;
  const isLiquidatore = false;

  const renderTableHeaders = () => {
    if (isPeritiLegali) {
      return (
        <TableRow>
          <TableHead>Codice / Nome Breve</TableHead>
          <TableHead>Nominativo</TableHead>
          <TableHead>Studio/Ufficio</TableHead>
          <TableHead>Indirizzo / Località / Mail</TableHead>
          <TableHead>Contatti</TableHead>
          <TableHead className="text-center">Attivo</TableHead>
        </TableRow>
      );
    }
    if (isAE) {
      return (
        <TableRow>
          <TableHead>Codice</TableHead>
          <TableHead>Descrizione</TableHead>
          <TableHead>Sigla</TableHead>
          <TableHead>Tel / Mail</TableHead>
          <TableHead>Dati RUI</TableHead>
          <TableHead>Dati Bancari</TableHead>
          <TableHead className="text-center">Ann.</TableHead>
        </TableRow>
      );
    }
    if (isCorr || isNewCommercial) {
      return (
        <TableRow>
          <TableHead>Cod</TableHead>
          <TableHead>Denominazione</TableHead>
          <TableHead>Indirizzo / Località</TableHead>
          <TableHead>% Provv / Cons / RA</TableHead>
          <TableHead>Tel / Mail</TableHead>
          <TableHead>IBAN</TableHead>
          <TableHead className="text-center">Stato</TableHead>
        </TableRow>
      );
    }
    return (
      <TableRow>
        <TableHead>Codice / Nome Breve</TableHead>
        <TableHead>Nome</TableHead>
        <TableHead>Indirizzo</TableHead>
        <TableHead>Contatti</TableHead>
        <TableHead>Attenzione di / Mail</TableHead>
        <TableHead>Agenzia</TableHead>
        <TableHead className="text-center">Attivo</TableHead>
      </TableRow>
    );
  };

  const getColSpan = () => {
    if (isPeritiLegali) return 6;
    if (isAE) return 7;
    if (isCorr || isNewCommercial) return 7;
    return 7;
  };

  const renderTableRow = (item: Anagrafica) => {
    const compName = compagnie.find((c) => c.id === item.compagnia_id)?.nome;
    const addressParts = [item.indirizzo, [item.cap, item.citta].filter(Boolean).join("  "), item.provincia].filter(Boolean);
    const phoneParts = [
      item.telefono ? `Tel ${item.telefono}` : null,
      item.fax ? `Fax ${item.fax}` : null,
      item.cellulare ? `Mob ${item.cellulare}` : null,
    ].filter(Boolean);

    if (isPeritiLegali) {
      return (
        <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(item)}>
          <TableCell>
            <div className="font-medium">{item.codice || "—"}</div>
            <div className="text-xs text-muted-foreground">{item.nome_breve || ""}</div>
          </TableCell>
          <TableCell className="font-medium">
            {[item.cognome, item.nome].filter(Boolean).join(" ") || "—"}
          </TableCell>
          <TableCell>{item.studio_ufficio || "—"}</TableCell>
          <TableCell className="text-sm">
            {addressParts.length > 0 ? addressParts.map((p, i) => <div key={i}>{p}</div>) : ""}
            {item.email && <div className="text-xs text-muted-foreground mt-0.5">{item.email}</div>}
            {!addressParts.length && !item.email && "—"}
          </TableCell>
          <TableCell className="text-sm">{phoneParts.length > 0 ? phoneParts.map((p, i) => <div key={i}>{p}</div>) : "—"}</TableCell>
          <TableCell className="text-center">
             <Switch checked={item.attivo ?? true} disabled={readOnly} onCheckedChange={(v) => toggleMutation.mutate({ id: item.id, attivo: v })} onClick={(e) => e.stopPropagation()} />
          </TableCell>
        </TableRow>
      );
    }

    if (isAE) {
      const ruiParts = [
        item.nome_rui,
        item.iscrizione_rui ? `Iscr. ${item.iscrizione_rui}` : null,
        item.numero_rui ? `N° ${item.numero_rui}` : null,
        item.sezione_rui ? `Sez. ${item.sezione_rui}` : null,
      ].filter(Boolean);
      const bancaParts = [item.banca_riga1, item.banca_riga2, item.banca_riga3].filter(Boolean);
      return (
         <TableRow key={item.id} className={`cursor-pointer hover:bg-muted/50 ${item.annullato ? "opacity-50" : item.attivo === false ? "opacity-60" : ""}`} onClick={() => openEdit(item)}>
          <TableCell className="font-medium">{item.codice || "—"}</TableCell>
          <TableCell className="font-medium">
            {item.ragione_sociale || item.cognome || item.nome || "—"}
            {ruoliDi(item).length > 1 && <div><Badge variant="outline" className="text-[10px] mt-0.5">{labelRuoli(item)}</Badge></div>}
          </TableCell>
          <TableCell>{item.sigla || "—"}</TableCell>
          <TableCell className="text-sm">
            {item.telefono && <div>Tel {item.telefono}</div>}
            {item.email && <div className="text-xs text-muted-foreground">{item.email}</div>}
            {!item.telefono && !item.email && "—"}
          </TableCell>
          <TableCell className="text-sm">
            {ruiParts.length > 0 ? ruiParts.map((p, i) => <div key={i}>{p}</div>) : "—"}
          </TableCell>
          <TableCell className="text-sm">
            {bancaParts.length > 0 ? bancaParts.map((p, i) => <div key={i} className="text-xs">{p}</div>) : "—"}
          </TableCell>
          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-2">
              <Switch checked={item.attivo ?? true} disabled={readOnly} onCheckedChange={(v) => toggleMutation.mutate({ id: item.id, attivo: v })} />
              {item.annullato && <Badge variant="destructive" className="text-xs">A</Badge>}
            </div>
          </TableCell>
        </TableRow>
      );
    }

    if (isCorr || isNewCommercial) {
      return (
        <TableRow key={item.id} className={`cursor-pointer hover:bg-muted/50 ${item.annullato ? "opacity-50" : item.attivo === false ? "opacity-60" : ""}`} onClick={() => openEdit(item)}>
          <TableCell className="font-medium">{item.codice || "—"}</TableCell>
          <TableCell className="font-medium">
            {item.cognome || item.ragione_sociale || "—"}
            {item.nome && <div className="text-xs text-muted-foreground">{item.nome}</div>}
            {ruoliDi(item).length > 1 && <Badge variant="outline" className="text-[10px] mt-0.5">{labelRuoli(item)}</Badge>}
          </TableCell>
          <TableCell className="text-sm">
            {addressParts.length > 0 ? addressParts.map((p, i) => <div key={i}>{p}</div>) : "—"}
          </TableCell>
          <TableCell className="text-sm">
            <div>Provv: {item.percentuale_base ?? 0}%</div>
            <div>Cons: {item.percentuale_consulenza ?? 0}%</div>
            <div>RA: {item.percentuale_ra ?? 0}%</div>
          </TableCell>
          <TableCell className="text-sm">
            {item.telefono && <div>Tel {item.telefono}</div>}
            {item.email && <div className="text-xs text-muted-foreground">{item.email}</div>}
            {!item.telefono && !item.email && "—"}
          </TableCell>
          <TableCell className="text-sm text-xs">{item.iban || "—"}</TableCell>
          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
            <Switch checked={item.attivo ?? true} disabled={readOnly} onCheckedChange={(v) => toggleMutation.mutate({ id: item.id, attivo: v })} />
          </TableCell>
        </TableRow>
      );
    }

    // Liquidatori
    return (
      <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(item)}>
        <TableCell>
          <div className="font-medium">{item.codice || "—"}</div>
          <div className="text-xs text-muted-foreground">{item.nome_breve || ""}</div>
        </TableCell>
        <TableCell className="font-medium">{item.nome || "—"}</TableCell>
        <TableCell className="text-sm">
          {addressParts.length > 0 ? addressParts.map((p, i) => <div key={i}>{p}</div>) : "—"}
        </TableCell>
        <TableCell className="text-sm">{phoneParts.length > 0 ? phoneParts.map((p, i) => <div key={i}>{p}</div>) : "—"}</TableCell>
        <TableCell>
          {item.referente_nome && <div className="font-medium text-sm">{item.referente_nome}</div>}
          {item.referente_email && <div className="text-xs text-muted-foreground">{item.referente_email}</div>}
          {!item.referente_nome && !item.referente_email && "—"}
        </TableCell>
        <TableCell className="text-sm">{compName || "—"}</TableCell>
        <TableCell className="text-center">
          <Switch checked={item.attivo ?? true} disabled={readOnly} onCheckedChange={(v) => toggleMutation.mutate({ id: item.id, attivo: v })} onClick={(e) => e.stopPropagation()} />
        </TableCell>
      </TableRow>
    );
  };

  const renderUfficioSelect = () => {
    if (!isProduttore) return null;
    // Account Executive puri: nessuna Sede. Sono globali per definizione.
    if (soloAE) return null;
    const isOptional = haCorr;
    return (
      <div className="mb-4">
        <Label>
          Sede {isOptional ? <span className="text-muted-foreground text-xs">(opzionale)</span> : <span className="text-destructive">*</span>}
        </Label>
        <Select
          value={form.ufficio_id || (isOptional ? "__none__" : (profile?.ufficio_id ?? ""))}
          onValueChange={(v) => setForm({ ...form, ufficio_id: v === "__none__" ? "" : v })}
          disabled={false}
        >
          <SelectTrigger><SelectValue placeholder="Seleziona sede..." /></SelectTrigger>
          <SelectContent>
            {isOptional && <SelectItem value="__none__">— Nessuna —</SelectItem>}
            {ufficiList.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.codice_ufficio} — {u.nome_ufficio}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderRuoliSelect = () => {
    if (!isProduttore) return null;
    return (
      <div className="mb-4 rounded-md border border-border p-3">
        <Label>Ruoli della scheda</Label>
        <p className="text-xs text-muted-foreground mb-2">
          La stessa persona può essere Produttore, Account Executive e Resp. Sede. Per le provvigioni vince sempre il Produttore.
        </p>
        <div className="flex flex-wrap gap-4">
          {RUOLI_COMMERCIALI.map((r) => {
            const principale = r.value === tipoPrincipale;
            return (
              <label key={r.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={ruoliForm.includes(r.value)}
                  disabled={principale}
                  onCheckedChange={(v) => {
                    const altri = form.ruoli.filter((x) => x !== r.value);
                    setForm({ ...form, ruoli: v ? [...altri, r.value] : altri });
                  }}
                />
                {r.label}
                {principale && <span className="text-xs text-muted-foreground">(principale)</span>}
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  const renderUnisciScheda = () => {
    if (!isProduttore || !isAdmin || !editingId) return null;
    const options = schedeCommerciali
      .filter((s) => s.id !== editingId)
      .map((s) => ({
        value: s.id,
        label: [s.cognome, s.nome].filter(Boolean).join(" ") || s.ragione_sociale || s.codice || s.id,
        description: [labelRuoli(s), s.codice ? `Cod. ${s.codice}` : null, s.codice_fiscale].filter(Boolean).join(" · "),
        searchText: [s.ragione_sociale, s.codice, s.codice_fiscale].filter(Boolean).join(" "),
      }));
    return (
      <div className="mt-4 rounded-md border border-dashed border-border p-3 space-y-2">
        <Label>Unisci un'altra scheda in questa</Label>
        <p className="text-xs text-muted-foreground">
          Per i doppioni della stessa persona: polizze, quote, provvigioni e clienti passano su questa scheda, che prende anche i ruoli dell'altra. La scheda unita viene archiviata (non cancellata).
        </p>
        <div className="flex gap-2">
          <SearchableSelect
            className="flex-1"
            options={options}
            value={mergeDupId}
            onValueChange={setMergeDupId}
            placeholder="Scegli la scheda doppione..."
            clearable
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!mergeDupId || mergeMutation.isPending}
            onClick={() => mergeMutation.mutate()}
          >
            {mergeMutation.isPending ? "Unione..." : "Unisci"}
          </Button>
        </div>
      </div>
    );
  };

  const renderFormFields = () => {
    if (isAE || isCorr) {

      return (
        <>
          <fieldset disabled={readOnly} className="min-w-0">{renderRuoliSelect()}</fieldset>
          <fieldset disabled={readOnly} className="min-w-0">{renderUfficioSelect()}</fieldset>
          <Tabs defaultValue="dati">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="dati">Dati</TabsTrigger>
              <TabsTrigger value="indirizzo">Indirizzo</TabsTrigger>
              <TabsTrigger value="provvigioni">Provvigioni</TabsTrigger>
              <TabsTrigger value="banca">Banca</TabsTrigger>
            </TabsList>
            <SchedaTab readOnly={readOnly} value="dati">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Codice</Label><Input value={form.codice} onChange={(e) => setForm({ ...form, codice: e.target.value })} /></div>
                <div><Label>Codice Fornitore</Label><Input value={form.codice_fornitore} onChange={(e) => setForm({ ...form, codice_fornitore: e.target.value })} /></div>
                <div className="col-span-2"><Label>Descrizione (Ragione Sociale)</Label><Input value={form.ragione_sociale} onChange={(e) => setForm({ ...form, ragione_sociale: e.target.value })} /></div>
                <div><Label>Azienda o Cognome</Label><Input value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
                <div><Label>Segue o Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div><Label>Telefono</Label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
                <div><Label>Fax</Label><Input value={form.fax} onChange={(e) => setForm({ ...form, fax: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-4 mb-2">Iscrizione RUI</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome RUI</Label><Input value={form.nome_rui} onChange={(e) => setForm({ ...form, nome_rui: e.target.value })} /></div>
                <div><Label>Sezione RUI</Label><Input value={form.sezione_rui} onChange={(e) => setForm({ ...form, sezione_rui: e.target.value })} placeholder="Es. B" /></div>
                <div><Label>Numero RUI</Label><Input value={form.numero_rui} onChange={(e) => setForm({ ...form, numero_rui: e.target.value })} /></div>
                <div><Label>Data iscrizione RUI</Label><DateField value={form.data_iscrizione_rui} onChange={(v) => setForm({ ...form, data_iscrizione_rui: v })} /></div>
              </div>
            </SchedaTab>
            <SchedaTab readOnly={readOnly} value="indirizzo">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Indirizzo</Label><AddressAutocomplete value={form.indirizzo} onChange={(v) => setForm({ ...form, indirizzo: v })} onSelect={(c) => setForm((f: any) => ({ ...f, cap: c.cap, citta: c.citta, provincia: c.provincia }))} /></div>
                <div><Label>Località</Label><Input value={form.citta} onChange={(e) => setForm({ ...form, citta: e.target.value })} /></div>
                <div><Label>Provincia</Label><Input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} maxLength={2} /></div>
                <div><Label>CAP</Label><Input value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} /></div>
              </div>
              <div><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} /></div>
            </SchedaTab>
            <SchedaTab readOnly={!canEditProvvigioni} value="provvigioni" className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Default Produttore (fallback)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>% Provvigione</Label><Input type="number" step="0.01" value={form.percentuale_base} onChange={(e) => setForm({ ...form, percentuale_base: e.target.value })} /></div>
                  <div><Label>% Provv. Consulenza</Label><Input type="number" step="0.01" value={form.percentuale_consulenza} onChange={(e) => setForm({ ...form, percentuale_consulenza: e.target.value })} /></div>
                  <div><Label>% RA (Ritenuta Acconto)</Label><Input type="number" step="0.01" value={form.percentuale_ra} onChange={(e) => setForm({ ...form, percentuale_ra: e.target.value })} /></div>
                </div>
                {readOnly && canEditProvvigioni && (
                  <div className="flex justify-end mt-3">
                    <Button
                      type="button"
                      onClick={() => officeCommissionsMutation.mutate()}
                      disabled={officeCommissionsMutation.isPending}
                    >
                      {officeCommissionsMutation.isPending ? "Salvataggio..." : "Salva provvigioni generali"}
                    </Button>
                  </div>
                )}
              </div>
              {haCorr && (
                <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                  <div className="space-y-0.5 pr-4">
                    <Label htmlFor="trattenuta-provv-incasso">Trattenuta provvigioni in incasso</Label>
                    <p className="text-xs text-muted-foreground">
                      Il produttore incassa dal cliente e trattiene la provvigione al netto RA; su messa a cassa l&apos;importo versato a Consulbrokers è premio − provvigione + RA e la provvigione risulta già pagata in E/C.
                    </p>
                  </div>
                  <Switch
                    id="trattenuta-provv-incasso"
                    checked={form.trattenuta_provvigioni_incasso}
                    onCheckedChange={(v) => setForm({ ...form, trattenuta_provvigioni_incasso: v })}
                  />
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Provvigioni per Ramo</p>
                <ProduttoreProvvigioniRamoTab
                  anagraficaId={editingId}
                  defaults={{ base: form.percentuale_base, consulenza: form.percentuale_consulenza, ra: form.percentuale_ra }}
                />
              </div>
            </SchedaTab>
            <SchedaTab readOnly={readOnly} value="banca">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ABI</Label><Input value={form.abi} onChange={(e) => setForm({ ...form, abi: e.target.value })} /></div>
                <div><Label>CAB</Label><Input value={form.cab} onChange={(e) => setForm({ ...form, cab: e.target.value })} /></div>
                <div className="col-span-2"><Label>IBAN</Label><ValidatedInput kind="iban" value={form.iban} onChange={(v) => setForm({ ...form, iban: v })} className="font-mono" /></div>
                <div className="col-span-2"><Label>Intestatario C/C</Label><Input value={form.intestatario_cc} onChange={(e) => setForm({ ...form, intestatario_cc: e.target.value })} /></div>
              </div>
            </SchedaTab>
          </Tabs>
        </>
      );
    }

    if (isNewCommercial) {
      return (
        <>
          <fieldset disabled={readOnly} className="min-w-0">{renderRuoliSelect()}</fieldset>
          <fieldset disabled={readOnly} className="min-w-0">{renderUfficioSelect()}</fieldset>
          <Tabs defaultValue="dati">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="dati">Dati</TabsTrigger>
              <TabsTrigger value="indirizzo">Indirizzo</TabsTrigger>
              <TabsTrigger value="provvigioni">Provvigioni</TabsTrigger>
              <TabsTrigger value="banca">RUI & Banca</TabsTrigger>
            </TabsList>
            <SchedaTab readOnly={readOnly} value="dati">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Codice</Label><Input value={form.codice} onChange={(e) => setForm({ ...form, codice: e.target.value })} /></div>
                <div><Label>Codice Fornitore</Label><Input value={form.codice_fornitore} onChange={(e) => setForm({ ...form, codice_fornitore: e.target.value })} /></div>
                <div><Label>Cognome o Denominazione *</Label><Input value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
                <div><Label>Nome o seguito Denominazione</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div><Label>Codice Fiscale</Label><FiscalCodeInput kind="cf-azienda" value={form.codice_fiscale || ""} onChange={(val) => setForm({ ...form, codice_fiscale: val })} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Telefono</Label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
                <div><Label>Fax</Label><Input value={form.fax} onChange={(e) => setForm({ ...form, fax: e.target.value })} /></div>
              </div>
            </SchedaTab>
            <SchedaTab readOnly={readOnly} value="indirizzo">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Indirizzo</Label><AddressAutocomplete value={form.indirizzo} onChange={(v) => setForm({ ...form, indirizzo: v })} onSelect={(c) => setForm((f: any) => ({ ...f, cap: c.cap, citta: c.citta, provincia: c.provincia }))} /></div>
                <div><Label>CAP</Label><Input value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} /></div>
                <div><Label>Comune</Label><Input value={form.citta} onChange={(e) => setForm({ ...form, citta: e.target.value })} /></div>
                <div><Label>Provincia</Label><Input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} maxLength={2} /></div>
              </div>
              <div><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} /></div>
            </SchedaTab>
            <SchedaTab readOnly={readOnly} value="provvigioni">
              <div className="grid grid-cols-3 gap-3">
                <div><Label>% Provvigione</Label><Input type="number" step="0.01" value={form.percentuale_base} onChange={(e) => setForm({ ...form, percentuale_base: e.target.value })} /></div>
                <div><Label>% Provv. Consulenza</Label><Input type="number" step="0.01" value={form.percentuale_consulenza} onChange={(e) => setForm({ ...form, percentuale_consulenza: e.target.value })} /></div>
                <div><Label>% RA (Ritenuta Acconto)</Label><Input type="number" step="0.01" value={form.percentuale_ra} onChange={(e) => setForm({ ...form, percentuale_ra: e.target.value })} /></div>
              </div>
            </SchedaTab>
            <SchedaTab readOnly={readOnly} value="banca">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Iscrizione RUI</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome Iscrizione RUI</Label><Input value={form.nome_rui} onChange={(e) => setForm({ ...form, nome_rui: e.target.value })} /></div>
                <div><Label>Data iscrizione RUI</Label><DateField value={form.data_iscrizione_rui} onChange={(v) => setForm({ ...form, data_iscrizione_rui: v })} /></div>
                <div><Label>Numero RUI</Label><Input value={form.numero_rui} onChange={(e) => setForm({ ...form, numero_rui: e.target.value })} /></div>
                <div><Label>Sezione RUI</Label><Input value={form.sezione_rui} onChange={(e) => setForm({ ...form, sezione_rui: e.target.value })} /></div>
              </div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-4 mb-2">Coordinate Bancarie</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ABI</Label><Input value={form.abi} onChange={(e) => setForm({ ...form, abi: e.target.value })} /></div>
                <div><Label>CAB</Label><Input value={form.cab} onChange={(e) => setForm({ ...form, cab: e.target.value })} /></div>
                <div className="col-span-2"><Label>IBAN</Label><ValidatedInput kind="iban" value={form.iban} onChange={(v) => setForm({ ...form, iban: v })} className="font-mono" /></div>
                <div className="col-span-2"><Label>Intestatario C/C</Label><Input value={form.intestatario_cc} onChange={(e) => setForm({ ...form, intestatario_cc: e.target.value })} /></div>
              </div>
            </SchedaTab>
          </Tabs>
        </>
      );
    }

    // Liquidatori, Periti, Legali
    return (
      <Tabs defaultValue="dati">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="dati">Dati Personali</TabsTrigger>
          <TabsTrigger value="contatti">Contatti</TabsTrigger>
          <TabsTrigger value="indirizzo">Indirizzo & Note</TabsTrigger>
        </TabsList>
        <SchedaTab readOnly={readOnly} value="dati">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Codice</Label><Input value={form.codice} onChange={(e) => setForm({ ...form, codice: e.target.value })} placeholder="Es. 51" /></div>
            <div><Label>Nome Breve</Label><Input value={form.nome_breve} onChange={(e) => setForm({ ...form, nome_breve: e.target.value })} /></div>
            <div><Label>Cognome</Label><Input value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
            <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Studio / Ufficio</Label><Input value={form.studio_ufficio} onChange={(e) => setForm({ ...form, studio_ufficio: e.target.value })} /></div>
            <div>
              <Label>Agenzia</Label>
              <Select value={form.compagnia_id} onValueChange={(v) => setForm({ ...form, compagnia_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                <SelectContent>
                  {compagnie.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Codice Fiscale</Label><FiscalCodeInput kind="cf-azienda" value={form.codice_fiscale || ""} onChange={(val) => {
              const updates: any = { ...form, codice_fiscale: val };
              if (val.length === 11 && /^\d{11}$/.test(val) && !form.partita_iva) {
                updates.partita_iva = val;
                toast.info("Partita IVA copiata dal Codice Fiscale");
              }
              setForm(updates);
            }} /></div>
            <div><Label>Partita IVA</Label><FiscalCodeInput kind="piva" value={form.partita_iva || ""} onChange={(val) => setForm({ ...form, partita_iva: val })} /></div>
            <div><Label>N° Albo</Label><Input value={form.albo_numero} onChange={(e) => setForm({ ...form, albo_numero: e.target.value })} /></div>
            <div><Label>Specializzazione</Label><Input value={form.specializzazione} onChange={(e) => setForm({ ...form, specializzazione: e.target.value })} /></div>
          </div>
        </SchedaTab>
        <SchedaTab readOnly={readOnly} value="contatti">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Contatti diretti</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Telefono</Label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
            <div><Label>Fax</Label><Input value={form.fax} onChange={(e) => setForm({ ...form, fax: e.target.value })} /></div>
            <div><Label>Cellulare</Label><Input value={form.cellulare} onChange={(e) => setForm({ ...form, cellulare: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>PEC</Label><Input type="email" value={form.pec} onChange={(e) => setForm({ ...form, pec: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-4 mb-2">Attenzione di (referente)</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome Referente</Label><Input value={form.referente_nome} onChange={(e) => setForm({ ...form, referente_nome: e.target.value })} /></div>
            <div><Label>Email Referente</Label><Input type="email" value={form.referente_email} onChange={(e) => setForm({ ...form, referente_email: e.target.value })} /></div>
          </div>
        </SchedaTab>
        <SchedaTab readOnly={readOnly} value="indirizzo">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Indirizzo</Label><AddressAutocomplete value={form.indirizzo} onChange={(v) => setForm({ ...form, indirizzo: v })} onSelect={(c) => setForm((f: any) => ({ ...f, cap: c.cap, citta: c.citta, provincia: c.provincia }))} /></div>
            <div><Label>CAP</Label><Input value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} /></div>
            <div><Label>Città</Label><Input value={form.citta} onChange={(e) => setForm({ ...form, citta: e.target.value })} /></div>
            <div><Label>Provincia</Label><Input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} maxLength={2} /></div>
          </div>
          <div><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} /></div>
        </SchedaTab>
      </Tabs>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anagrafiche Amministrative</h1>
          <p className="text-sm text-muted-foreground">Figure interne all'compagnia: Account Executive, Produttori, Resp. Sede, Specialist e Sedi</p>
        </div>
        {isAnagraficaTab && !readOnly && (
          <Button onClick={() => { setEditingId(null); setEditingTipo(null); setMergeDupId(""); setForm(emptyForm); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />Nuovo
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as TabValue); setSearch(""); }}>
        <TabsList>
          {TIPI.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              <t.icon className="w-4 h-4" />{t.label}
            </TabsTrigger>
          ))}
          {EXTRA_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              <t.icon className="w-4 h-4" />{t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {isAnagraficaTab && (
          <div className="mt-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Cerca per nome, codice, città..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Badge variant="secondary">{filtered.length} risultati</Badge>
          </div>
        )}

        {TIPI.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>{renderTableHeaders()}</TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={getColSpan()} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={getColSpan()} className="text-center py-8 text-muted-foreground">Nessun risultato trovato</TableCell></TableRow>
                  ) : (
                    filtered.map((item) => renderTableRow(item))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}

        <TabsContent value="specialist" className="mt-4">
          <SpecialistList
            readOnly={readOnly}
            editId={activeTab === "specialist" ? pendingEditId : null}
            onEditConsumed={() => {
              setPendingEditId(null);
              const sp = new URLSearchParams(searchParams);
              sp.delete("edit");
              setSearchParams(sp, { replace: true });
            }}
          />
        </TabsContent>

        <TabsContent value="specialist_sinistri" className="mt-4">
          <SpecialistSinistriList readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="sedi" className="mt-4">
          <SediManager showHeader={false} readOnly={readOnly} />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setEditingTipo(null); setMergeDupId(""); setForm(emptyForm); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{readOnly ? "Dettaglio anagrafica" : editingId ? `Modifica ${tipoLabel.slice(0, -1)}` : `Nuovo ${tipoLabel.slice(0, -1)}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (readOnly) return; editingId ? updateMutation.mutate() : createMutation.mutate(); }} className="space-y-4">
            {renderFormFields()}
            {!readOnly && renderUnisciScheda()}
            <DialogFooter className="sm:justify-between gap-2">
              <div>
                {editingId && !readOnly && (
                  <Button type="button" variant="destructive" onClick={() => setConfirmDeleteOpen(true)} disabled={deleteMutation.isPending}>
                    <Trash2 className="w-4 h-4 mr-2" />Elimina
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{readOnly ? "Chiudi" : "Annulla"}</Button>
                {!readOnly && (
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) ? "Salvataggio..." : "Salva"}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteWithImpactDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        entityId={editingId}
        entityType="anagrafica professionale"
        entityName={(() => {
          const it = items.find((i) => i.id === editingId);
          if (!it) return "—";
          return it.ragione_sociale || `${it.cognome || ""} ${it.nome || ""}`.trim() || it.codice || "—";
        })()}
        checks={[
          { table: "titoli", column: "anagrafica_commerciale_id", label: "Polizze (commerciale)" },
          { table: "titoli", column: "produttore_id", label: "Polizze (produttore legacy)" },
          { table: "clienti", column: "anagrafica_commerciale_id", label: "Clienti collegati" },
          { table: "sinistri", column: "liquidatore_id", label: "Sinistri (liquidatore)" },
          { table: "sinistri", column: "perito_id", label: "Sinistri (perito)" },
          { table: "sinistri", column: "legale_id", label: "Sinistri (legale)" },
          { table: "produttori_provvigioni_ramo", column: "anagrafica_id", label: "Provvigioni per ramo", blocking: false },
        ]}
        onConfirmDelete={() => editingId && deleteMutation.mutate(editingId)}
        onDeactivateInstead={
          editingId
            ? () => toggleMutation.mutate({ id: editingId, attivo: false })
            : undefined
        }
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
};

export default AnagraficheInternePage;