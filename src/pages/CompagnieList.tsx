import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/SearchableSelect";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Building2, Search, Percent, Pencil, Brain, Layers, Trash2, Network, AlertTriangle, ShieldCheck } from "lucide-react";

const PLURIMANDATARIO_CODE = "PLURIMANDATARIO";
import ImportProvvigioniTab from "@/components/ImportProvvigioniTab";
import { toast } from "sonner";
import AddressAutocomplete from "@/components/AddressAutocomplete";

// ── Constants ──

const NAZIONI = [
  "BELGIO", "DEUTSCHLAND", "FRANCIA", "GRAN BRETAGNA", "ITALIA",
  "LUSSEMBURGO", "PRINCIPATO DI MONACO", "STATI UNITI D'AMERICA", "SVIZZERA",
  "COREA DEL SUD",
].sort();

const STATI_COMPAGNIA = ["Attivo", "Sospeso", "Non Operativo"];

const TIPI_MANDATARIO = [
  "Direzione", "Gerenza", "Agenzia Generale", "Agente Monomandatario",
  "Agente Multimandatario", "Broker", "Sub-Agente", "Compagnia Estera",
  "Agente Estero", "Broker Estero", "Lloyd's Coverholder", "Lloyd's Broker",
  "Lloyd's Service Company", "Altro",
];

const GRUPPI_STATISTICI = [
  "BROKER","COMP. ESTERE","COMP. ESTERE (in Italia)","Corrispondente LLOYD'S","Da definire",
  "DELEGA ALTRUI","EUROINS","FIN CASSA","Gruppo AIG","Gruppo ALLIANZ","Gruppo AMISSIMA",
  "Gruppo AMTRUST","Gruppo ARAG","Gruppo ARFIN","Gruppo ASSIMOCO","Gruppo ASSITALIA",
  "Gruppo ATRADIUS","Gruppo AUGUSTA","Gruppo AVIVA","Gruppo AXA","Gruppo BANCA CARIGE",
  "Gruppo BANCA DI TOKJO","Gruppo BAVARIA","Gruppo BENE","Gruppo BNC","Gruppo CATTOLICA",
  "Gruppo CELERITAS","Gruppo CHUBB","Gruppo CIDAS","Gruppo CIGNA","Gruppo CNA",
  "Gruppo COFACE","Gruppo CREDENDO","Gruppo CREDIT SUISSE","Gruppo DALLBOG",
  "Gruppo DUAL AGENCY","Gruppo ELBA","Gruppo EUROPE ASSISTANCE","Gruppo FARO",
  "Gruppo FIAT - TORO","Gruppo FONDIARIA - SAI","Gruppo GENERALI","Gruppo GLOBAL ASSISTANCE",
  "Gruppo GROUPAMA","Gruppo H.D.I.","Gruppo HARMONIE MUTUELLE","Gruppo HELVETIA",
  "Gruppo INTERGEA SpA","Gruppo IPA","Gruppo ITAS","Gruppo LA DIFESA","Gruppo LEGAL & GENERAL",
  "Gruppo LIBERTY","Gruppo LIGRESTI","Gruppo LIGURIA/DE LONGHI","Gruppo MARCHAND OLANDESE",
  "Gruppo METLIFE","Gruppo MILANESE","Gruppo MINERVA","Gruppo MUT. MANS","Gruppo NOBIS",
  "Gruppo NORDITALIA","Gruppo NOVIT","Gruppo POSTE","Gruppo QBE","Gruppo REALE MUTUA",
  "Gruppo REVO","Gruppo ROLAND","Gruppo ROYAL & SUN A.","Gruppo S2C","Gruppo SACE",
  "Gruppo SARA","Gruppo SIAC","Gruppo SMABTP","Gruppo SWISS RE","Gruppo TALANX",
  "Gruppo TELECOM ITALIA","Gruppo TOKIO MARINE","Gruppo UCA","Gruppo UNIPOL",
  "Gruppo UNIQA Austria","Gruppo VINCI","Gruppo VITTORIA","Gruppo ZURICH F.S.",
  "Società Finanziarie","VHV",
];

const TIPI_PAGAMENTO = ["Assegno bancario", "Assegno circolare", "Bonifico", "Rimessa Diretta"];
const FIRME_DIGITALI = ["No", "FES", "FEA"];
const TIPI_COPERTURA = ["Deposito a copertura", "Scambio conferme", "Conferma solo da parte Broker"];

// ── Types ──

interface CompagniaForm {
  nome: string;
  nome_sede: string;
  codice: string;
  nome_segue: string;
  indirizzo: string;
  cap: string;
  comune: string;
  provincia: string;
  nazione: string;
  stato: string;
  telefono: string;
  fax: string;
  cellulare: string;
  note: string;
  mail: string;
  pec: string;
  mail_ec: string;
  mail_avvisi: string;
  codice_fiscale: string;
  partita_iva: string;
  iscrizione_rui_sez: string;
  iscrizione_rui_num: string;
  pagamento: string;
  tipo_pagamento: string;
  percentuale_ra: string;
  gruppo_compagnia: string;
  gruppo_compagnia_id: string;
  tipo_mandatario: string;
  gruppo_statistico: string;
  iban: string;
  codice_abi: string;
  codice_cab: string;
  intestato_a: string;
  bic: string;
  citta_banca: string;
  aut_incasso_118: boolean;
  tipo_copertura: string;
  ra_ec_negativi: boolean;
  allegato_excel_avvisi: boolean;
  allegato_excel_ec: boolean;
  firma_digitale: string;
  escluso_all4: boolean;
}

const emptyForm: CompagniaForm = {
  nome: "", nome_sede: "", codice: "", nome_segue: "", indirizzo: "", cap: "", comune: "", provincia: "",
  nazione: "ITALIA", stato: "Attivo", telefono: "", fax: "", cellulare: "", note: "",
  mail: "", pec: "", mail_ec: "", mail_avvisi: "",
  codice_fiscale: "", partita_iva: "", iscrizione_rui_sez: "", iscrizione_rui_num: "",
  pagamento: "", tipo_pagamento: "", percentuale_ra: "",
  gruppo_compagnia: "", gruppo_compagnia_id: "", tipo_mandatario: "", gruppo_statistico: "",
  iban: "", codice_abi: "", codice_cab: "", intestato_a: "", bic: "", citta_banca: "",
  aut_incasso_118: false, tipo_copertura: "", ra_ec_negativi: false,
  allegato_excel_avvisi: false, allegato_excel_ec: false, firma_digitale: "No", escluso_all4: false,
};

function toOptions(arr: string[]) {
  return arr.map((v) => ({ value: v, label: v }));
}

function dbToForm(c: any): CompagniaForm {
  return {
    nome: c.nome || "",
    nome_sede: c.nome_sede || "",
    codice: c.codice || "",
    nome_segue: c.nome_segue || "",
    indirizzo: c.indirizzo || "",
    cap: c.cap || "",
    comune: c.comune || "",
    provincia: c.provincia || "",
    nazione: c.nazione || "ITALIA",
    stato: c.stato || "Attivo",
    telefono: c.telefono || "",
    fax: c.fax || "",
    cellulare: c.cellulare || "",
    note: c.note || "",
    mail: c.mail || "",
    pec: c.pec || "",
    mail_ec: c.mail_ec || "",
    mail_avvisi: c.mail_avvisi || "",
    codice_fiscale: c.codice_fiscale || "",
    partita_iva: c.partita_iva || "",
    iscrizione_rui_sez: c.iscrizione_rui_sez || "",
    iscrizione_rui_num: c.iscrizione_rui_num || "",
    pagamento: c.pagamento || "",
    tipo_pagamento: c.tipo_pagamento || "",
    percentuale_ra: c.percentuale_ra != null ? String(c.percentuale_ra) : "",
    gruppo_compagnia: c.gruppo_compagnia || "",
    gruppo_compagnia_id: c.gruppo_compagnia_id || "",
    tipo_mandatario: c.tipo_mandatario || "",
    gruppo_statistico: c.gruppo_statistico || "",
    iban: c.iban || "",
    codice_abi: c.codice_abi || "",
    codice_cab: c.codice_cab || "",
    intestato_a: c.intestato_a || "",
    bic: c.bic || "",
    citta_banca: c.citta_banca || "",
    aut_incasso_118: c.aut_incasso_118 ?? false,
    tipo_copertura: c.tipo_copertura || "",
    ra_ec_negativi: c.ra_ec_negativi ?? false,
    allegato_excel_avvisi: c.allegato_excel_avvisi ?? false,
    allegato_excel_ec: c.allegato_excel_ec ?? false,
    firma_digitale: c.firma_digitale || "No",
    escluso_all4: c.escluso_all4 ?? false,
  };
}

function formToPayload(form: CompagniaForm) {
  return {
    nome: form.nome,
    nome_sede: form.nome_sede || null,
    codice: form.codice || null,
    nome_segue: form.nome_segue || null,
    indirizzo: form.indirizzo || null,
    cap: form.cap || null,
    comune: form.comune || null,
    provincia: form.provincia || null,
    nazione: form.nazione || null,
    stato: form.stato || null,
    telefono: form.telefono || null,
    fax: form.fax || null,
    cellulare: form.cellulare || null,
    note: form.note || null,
    mail: form.mail || null,
    pec: form.pec || null,
    mail_ec: form.mail_ec || null,
    mail_avvisi: form.mail_avvisi || null,
    codice_fiscale: form.codice_fiscale || null,
    partita_iva: form.partita_iva || null,
    iscrizione_rui_sez: form.iscrizione_rui_sez || null,
    iscrizione_rui_num: form.iscrizione_rui_num || null,
    pagamento: form.pagamento || null,
    tipo_pagamento: form.tipo_pagamento || null,
    percentuale_ra: form.percentuale_ra ? parseFloat(form.percentuale_ra) : null,
    gruppo_compagnia: form.gruppo_compagnia || null,
    gruppo_compagnia_id: form.gruppo_compagnia_id || null,
    tipo_mandatario: form.tipo_mandatario || null,
    gruppo_statistico: form.gruppo_statistico || null,
    iban: form.iban || null,
    codice_abi: form.codice_abi || null,
    codice_cab: form.codice_cab || null,
    intestato_a: form.intestato_a || null,
    bic: form.bic || null,
    citta_banca: form.citta_banca || null,
    aut_incasso_118: form.aut_incasso_118,
    tipo_copertura: form.tipo_copertura || null,
    ra_ec_negativi: form.ra_ec_negativi,
    allegato_excel_avvisi: form.allegato_excel_avvisi,
    allegato_excel_ec: form.allegato_excel_ec,
    firma_digitale: form.firma_digitale || "No",
    escluso_all4: form.escluso_all4,
  };
}

// ── Dialog Form Component ──

function ProvvigioniTabContent({ compagniaId }: { compagniaId: string | null }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newProvv, setNewProvv] = useState({ categoria_id: "", percentuale: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: categorie = [] } = useQuery({
    queryKey: ["categorie_prodotto"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorie_prodotto").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: provvigioni = [], isLoading } = useQuery({
    queryKey: ["provvigioni_compagnia_ramo", compagniaId],
    queryFn: async () => {
      if (!compagniaId) return [];
      const { data, error } = await supabase
        .from("provvigioni_compagnia_ramo")
        .select("*, categorie_prodotto(id, nome)")
        .eq("compagnia_id", compagniaId)
        .eq("attiva", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!compagniaId,
  });

  const categoriaOptions = categorie.map((c: any) => ({ value: c.id, label: c.nome }));

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("provvigioni_compagnia_ramo").insert({
        compagnia_id: compagniaId,
        categoria_id: newProvv.categoria_id,
        percentuale_provvigione: parseFloat(newProvv.percentuale),
        attiva: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provvigioni_compagnia_ramo", compagniaId] });
      setCreateOpen(false);
      setNewProvv({ categoria_id: "", percentuale: "" });
      toast.success("Provvigione per ramo creata");
    },
    onError: (err: any) => toast.error(err.message?.includes("duplicate") ? "Ramo già configurato per questa compagnia" : "Errore nella creazione"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await supabase.from("provvigioni_compagnia_ramo")
        .update({ percentuale_provvigione: value } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provvigioni_compagnia_ramo", compagniaId] });
      setEditingId(null);
      toast.success("Provvigione aggiornata");
    },
    onError: () => toast.error("Errore nell'aggiornamento"),
  });

  if (!compagniaId) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Percent className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Salva l'agenzia prima di configurare le provvigioni per ramo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Provvigioni configurate: {provvigioni.length}</p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-2" />Nuova Provvigione</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuova Provvigione per Ramo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ramo (Categoria) *</Label>
                <SearchableSelect
                  options={categoriaOptions}
                  value={newProvv.categoria_id}
                  onValueChange={(v) => setNewProvv((p) => ({ ...p, categoria_id: v }))}
                  placeholder="Seleziona ramo..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Provvigione % *</Label>
                <Input type="number" step="0.01" value={newProvv.percentuale} onChange={(e) => setNewProvv((p) => ({ ...p, percentuale: e.target.value }))} placeholder="es. 5" />
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!newProvv.categoria_id || !newProvv.percentuale || createMutation.isPending} className="w-full">
                Crea Provvigione
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Caricamento...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ramo</TableHead>
              <TableHead>Provvigione %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {provvigioni.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell><Badge variant="outline">{p.categorie_prodotto?.nome || "—"}</Badge></TableCell>
                <TableCell>
                  {editingId === p.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        className="w-20 h-8"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editValue) updateMutation.mutate({ id: p.id, value: parseFloat(editValue) });
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={() => { setEditingId(p.id); setEditValue(String(p.percentuale_provvigione ?? "")); }}
                    >
                      <span className="font-semibold">{p.percentuale_provvigione}%</span>
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {provvigioni.length === 0 && (
              <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Nessuna provvigione configurata</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function CompagniaFormDialog({
  form, setForm, onSave, saving, title, saveLabel, compagniaId,
}: {
  form: CompagniaForm;
  setForm: React.Dispatch<React.SetStateAction<CompagniaForm>>;
  onSave: () => void;
  saving: boolean;
  title: string;
  saveLabel: string;
  compagniaId: string | null;
}) {
  const setField = (key: keyof CompagniaForm, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const { data: gruppiCompagnia = [] } = useQuery({
    queryKey: ["gruppi_compagnia_lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gruppi_compagnia" as any)
        .select("id, descrizione, codice")
        .eq("attivo", true)
        .order("descrizione");
      return (data || []).map((g: any) => ({
        value: g.id,
        label: g.codice === PLURIMANDATARIO_CODE ? `⚠️ ${g.descrizione} (Fallback)` : g.descrizione,
      }));
    },
    staleTime: 1000 * 60 * 30,
  });

  const renderField = (label: string, field: keyof CompagniaForm, placeholder?: string, className?: string) => (
    <div className={`space-y-1 ${className || ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={(form[field] as string) || ""} onChange={(e) => setField(field, e.target.value)} placeholder={placeholder} />
    </div>
  );

  return (
    <>
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <Tabs defaultValue="anagrafica" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="anagrafica">Dati Anagrafici</TabsTrigger>
          <TabsTrigger value="contabili">Dati Contabili</TabsTrigger>
          <TabsTrigger value="provvigioni">Provvigioni</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: DATI ANAGRAFICI ── */}
        <TabsContent value="anagrafica" className="space-y-3 mt-4">
          <div className="grid grid-cols-3 gap-3">
            {renderField("Codice Ricerca", "codice")}
            {renderField("Nome Agenzia *", "nome")}
            {renderField("Nome Sede", "nome_sede", "es. Milano 1, Roma Centro")}
          </div>
          {renderField("Nome (segue)", "nome_segue")}

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Indirizzo</Label>
            <AddressAutocomplete
              value={form.indirizzo}
              onChange={(v) => setField("indirizzo", v)}
              onSelect={(c) => { setField("cap", c.cap); setField("comune", c.citta); setField("provincia", c.provincia); }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {renderField("CAP", "cap")}
            {renderField("Città", "comune")}
            {renderField("Provincia", "provincia", "es. MI")}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nazione</Label>
              <SearchableSelect
                options={toOptions(NAZIONI)}
                value={form.nazione}
                onValueChange={(v) => setField("nazione", v)}
                placeholder="Seleziona nazione..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Stato</Label>
              <RadioGroup value={form.stato} onValueChange={(v) => setField("stato", v)} className="flex gap-4 pt-2">
                {STATI_COMPAGNIA.map((s) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <RadioGroupItem value={s} id={`stato-${s}`} />
                    <Label htmlFor={`stato-${s}`} className="text-sm font-normal cursor-pointer">{s}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {renderField("Email", "mail")}
            {renderField("PEC", "pec")}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {renderField("Telefono", "telefono")}
            {renderField("Fax", "fax")}
            {renderField("Cellulare", "cellulare")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {renderField("Mail Estratto Conto", "mail_ec")}
            {renderField("Mail Avvisi", "mail_avvisi")}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Attenzione di / Note</Label>
            <Textarea value={form.note} onChange={(e) => setField("note", e.target.value)} rows={2} />
          </div>
        </TabsContent>

        {/* ── TAB 2: DATI CONTABILI ── */}
        <TabsContent value="contabili" className="space-y-3 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Codice Fiscale</Label>
              <Input value={form.codice_fiscale} onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setField("codice_fiscale", val);
                if (val.length === 11 && /^\d{11}$/.test(val) && !form.partita_iva) {
                  setField("partita_iva", val);
                  toast.info("Partita IVA copiata dal Codice Fiscale");
                }
              }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Partita IVA</Label>
              <Input value={form.partita_iva} onChange={(e) => setField("partita_iva", e.target.value.toUpperCase())} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {renderField("Iscrizione RUI - Sezione", "iscrizione_rui_sez")}
            {renderField("Iscrizione RUI - Numero", "iscrizione_rui_num")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {renderField("Pagamento", "pagamento", "es. Bonifico a 30 gg.")}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo Pagamento</Label>
              <SearchableSelect
                options={toOptions(TIPI_PAGAMENTO)}
                value={form.tipo_pagamento}
                onValueChange={(v) => setField("tipo_pagamento", v)}
                placeholder="Seleziona..."
              />
            </div>
          </div>
          {renderField("% Ritenuta d'Acconto", "percentuale_ra", "es. 23")}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Compagnia di appartenenza <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                options={gruppiCompagnia}
                value={form.gruppo_compagnia_id}
                onValueChange={(v) => {
                  setField("gruppo_compagnia_id", v);
                  const found = gruppiCompagnia.find((g: any) => g.value === v);
                  setField("gruppo_compagnia", found?.label?.replace(/^⚠️\s*/, "").replace(/\s*\(Fallback\)$/, "") || "");
                }}
                placeholder="Seleziona compagnia..."
              />
              {!form.gruppo_compagnia_id && (
                <p className="text-xs text-destructive">Campo obbligatorio</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo Mandatario</Label>
              <SearchableSelect
                options={toOptions(TIPI_MANDATARIO)}
                value={form.tipo_mandatario}
                onValueChange={(v) => setField("tipo_mandatario", v)}
                placeholder="Seleziona..."
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Gruppo Statistico</Label>
            <SearchableSelect
              options={toOptions(GRUPPI_STATISTICI)}
              value={form.gruppo_statistico}
              onValueChange={(v) => setField("gruppo_statistico", v)}
              placeholder="Seleziona..."
            />
          </div>

          <div className="border-t pt-3 mt-3">
            <Label className="text-sm font-medium text-foreground">Dati Bancari</Label>
          </div>
          {renderField("CC/IBAN", "iban")}
          <div className="grid grid-cols-2 gap-3">
            {renderField("Codice ABI", "codice_abi")}
            {renderField("Codice CAB", "codice_cab")}
          </div>
          {renderField("Intestato a", "intestato_a")}
          <div className="grid grid-cols-2 gap-3">
            {renderField("BIC", "bic")}
            {renderField("Città Banca", "citta_banca")}
          </div>

          <div className="border-t pt-3 mt-3">
            <Label className="text-sm font-medium text-foreground">Opzioni</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Aut. Incasso (art. 118)</Label>
              <Switch checked={form.aut_incasso_118} onCheckedChange={(v) => setField("aut_incasso_118", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">R.A. su E/C negativi</Label>
              <Switch checked={form.ra_ec_negativi} onCheckedChange={(v) => setField("ra_ec_negativi", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Allegato Excel in Avvisi</Label>
              <Switch checked={form.allegato_excel_avvisi} onCheckedChange={(v) => setField("allegato_excel_avvisi", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Allegato Excel in E/C</Label>
              <Switch checked={form.allegato_excel_ec} onCheckedChange={(v) => setField("allegato_excel_ec", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Escluso All. 4</Label>
              <Switch checked={form.escluso_all4} onCheckedChange={(v) => setField("escluso_all4", v)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo Copertura</Label>
            <SearchableSelect
              options={toOptions(TIPI_COPERTURA)}
              value={form.tipo_copertura}
              onValueChange={(v) => setField("tipo_copertura", v)}
              placeholder="Seleziona..."
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Firma Digitale</Label>
            <RadioGroup value={form.firma_digitale} onValueChange={(v) => setField("firma_digitale", v)} className="flex gap-4 pt-1">
              {FIRME_DIGITALI.map((f) => (
                <div key={f} className="flex items-center gap-1.5">
                  <RadioGroupItem value={f} id={`firma-${f}`} />
                  <Label htmlFor={`firma-${f}`} className="text-sm font-normal cursor-pointer">{f}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </TabsContent>

        {/* ── TAB 3: PROVVIGIONI ── */}
        <TabsContent value="provvigioni" className="mt-4">
          <ProvvigioniTabContent compagniaId={compagniaId} />
        </TabsContent>
      </Tabs>
      <Button onClick={onSave} disabled={!form.nome || !form.gruppo_compagnia_id || saving} className="w-full mt-4">
        {saveLabel}
      </Button>
    </>
  );
}

// ── Tab Compagnie (Gruppi Compagnia nel DB) ──

interface GruppoForm {
  codice: string;
  descrizione: string;
  attivo: boolean;
}

const emptyGruppo: GruppoForm = { codice: "", descrizione: "", attivo: true };

// ── Dialog: Agenzie collegate a una compagnia madre ──
function AgenzieCollegateDialog({
  gruppoId,
  gruppoDescrizione,
  open,
  onClose,
  onOpenAgenzia,
}: {
  gruppoId: string | null;
  gruppoDescrizione: string;
  open: boolean;
  onClose: () => void;
  onOpenAgenzia?: (compagniaId: string) => void;
}) {
  const [search, setSearch] = useState("");

  const { data: agenzie = [], isLoading } = useQuery({
    queryKey: ["agenzie-collegate", gruppoId],
    queryFn: async () => {
      if (!gruppoId) return [];
      const { data, error } = await supabase
        .from("compagnie")
        .select("id, codice, nome, nome_sede, comune, provincia, stato, attiva")
        .eq("gruppo_compagnia_id", gruppoId)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: !!gruppoId && open,
  });

  const filtered = agenzie.filter((a: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.nome?.toLowerCase().includes(q) ||
      a.nome_sede?.toLowerCase().includes(q) ||
      a.codice?.toLowerCase().includes(q) ||
      a.comune?.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSearch(""); onClose(); } }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Agenzie collegate a <span className="text-primary">{gruppoDescrizione}</span>
            <Badge variant="secondary" className="ml-2">{agenzie.length}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, sede, codice o comune..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-[60vh] overflow-auto border rounded-md">
          {isLoading ? (
            <p className="p-4 text-muted-foreground">Caricamento...</p>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-28">Codice</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Comune</TableHead>
                  <TableHead className="w-16">Prov</TableHead>
                  <TableHead className="w-28">Stato</TableHead>
                  <TableHead className="w-20 text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a: any, idx: number) => (
                  <TableRow key={a.id} className={idx % 2 === 1 ? "bg-muted/20" : ""}>
                    <TableCell className="font-mono text-sm">{a.codice || "—"}</TableCell>
                    <TableCell className="font-medium">{a.nome || "—"}</TableCell>
                    <TableCell>{a.nome_sede || "—"}</TableCell>
                    <TableCell>{a.comune || "—"}</TableCell>
                    <TableCell>{a.provincia || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={a.stato === "Attivo" ? "default" : "secondary"}>
                        {a.stato || (a.attiva ? "Attivo" : "Non Operativo")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {onOpenAgenzia && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { onOpenAgenzia(a.id); onClose(); }}
                        >
                          Apri
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      {agenzie.length === 0 ? "Nessuna agenzia collegata" : "Nessun risultato per la ricerca"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompagnieMadriTab({ onOpenAgenzia }: { onOpenAgenzia?: (compagniaId: string) => void } = {}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<GruppoForm>(emptyGruppo);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; descrizione: string; count: number } | null>(null);
  const [agenzieDialog, setAgenzieDialog] = useState<{ gruppoId: string; gruppoDescrizione: string } | null>(null);

  const { data: gruppi = [], isLoading } = useQuery({
    queryKey: ["compagnie-madri-list"],
    queryFn: async () => {
      const { data: gruppiData, error } = await supabase
        .from("gruppi_compagnia" as any)
        .select("id, codice, descrizione, attivo")
        .order("descrizione");
      if (error) throw error;

      // Count agenzie per gruppo
      const { data: countsData } = await supabase
        .from("compagnie")
        .select("gruppo_compagnia_id")
        .not("gruppo_compagnia_id", "is", null);

      const counts: Record<string, number> = {};
      (countsData || []).forEach((row: any) => {
        if (row.gruppo_compagnia_id) {
          counts[row.gruppo_compagnia_id] = (counts[row.gruppo_compagnia_id] || 0) + 1;
        }
      });

      const enriched = (gruppiData || []).map((g: any) => ({
        ...g,
        agenzie_count: counts[g.id] || 0,
        is_pluri: g.codice === PLURIMANDATARIO_CODE,
      }));

      // PLURIMANDATARIO sempre in cima
      return enriched.sort((a: any, b: any) => {
        if (a.is_pluri && !b.is_pluri) return -1;
        if (!a.is_pluri && b.is_pluri) return 1;
        return (a.descrizione || "").localeCompare(b.descrizione || "");
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("gruppi_compagnia" as any)
        .insert({ codice: form.codice || null, descrizione: form.descrizione, attivo: form.attivo });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compagnie-madri-list"] });
      queryClient.invalidateQueries({ queryKey: ["gruppi_compagnia_lookup"] });
      setCreateOpen(false);
      setForm(emptyGruppo);
      toast.success("Compagnia creata");
    },
    onError: (e: any) => toast.error(e.message || "Errore creazione"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      const { error } = await supabase
        .from("gruppi_compagnia" as any)
        .update({ codice: form.codice || null, descrizione: form.descrizione, attivo: form.attivo })
        .eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compagnie-madri-list"] });
      queryClient.invalidateQueries({ queryKey: ["gruppi_compagnia_lookup"] });
      setEditOpen(false);
      setEditId(null);
      setForm(emptyGruppo);
      toast.success("Compagnia aggiornata");
    },
    onError: (e: any) => toast.error(e.message || "Errore aggiornamento"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gruppi_compagnia" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compagnie-madri-list"] });
      queryClient.invalidateQueries({ queryKey: ["gruppi_compagnia_lookup"] });
      setDeleteTarget(null);
      toast.success("Compagnia eliminata");
    },
    onError: (e: any) => toast.error(e.message || "Errore eliminazione"),
  });

  const openEdit = (g: any) => {
    if (g.is_pluri) {
      toast.info("Compagnia di sistema (PLURIMANDATARIO): non modificabile.");
      return;
    }
    setForm({ codice: g.codice || "", descrizione: g.descrizione || "", attivo: g.attivo ?? true });
    setEditId(g.id);
    setEditOpen(true);
  };

  const handleDeleteClick = (g: any) => {
    if (g.is_pluri) {
      toast.error("Compagnia di sistema (PLURIMANDATARIO): non eliminabile.");
      return;
    }
    setDeleteTarget({ id: g.id, descrizione: g.descrizione, count: g.agenzie_count });
  };

  const filtered = gruppi.filter((g: any) =>
    !search || g.descrizione?.toLowerCase().includes(search.toLowerCase()) || g.codice?.toLowerCase().includes(search.toLowerCase())
  );

  const renderForm = () => (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Codice</Label>
        <Input value={form.codice} onChange={(e) => setForm((p) => ({ ...p, codice: e.target.value }))} placeholder="es. GEN" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Descrizione *</Label>
        <Input value={form.descrizione} onChange={(e) => setForm((p) => ({ ...p, descrizione: e.target.value }))} placeholder="es. Gruppo Generali" />
      </div>
      <div className="flex items-center justify-between border-t pt-3">
        <Label className="text-sm">Attiva</Label>
        <Switch checked={form.attivo} onCheckedChange={(v) => setForm((p) => ({ ...p, attivo: v }))} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Cerca per descrizione o codice</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Cerca compagnia..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
            <Button variant="secondary" onClick={() => setSearch("")}>Reset</Button>
            <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setForm(emptyGruppo); }}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Nuova Compagnia</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuova Compagnia</DialogTitle></DialogHeader>
                {renderForm()}
                <Button onClick={() => createMutation.mutate()} disabled={!form.descrizione || createMutation.isPending} className="w-full">
                  {createMutation.isPending ? "Salvataggio..." : "Crea Compagnia"}
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="w-5 h-5" />Compagnie ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Caricamento...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead className="text-center">Agenzie collegate</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="w-24 text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((g: any, idx: number) => (
                  <TableRow
                    key={g.id}
                    className={`cursor-pointer hover:bg-muted/50 ${g.is_pluri ? "bg-accent/40" : idx % 2 === 1 ? "bg-muted/20" : ""}`}
                    onClick={() => openEdit(g)}
                  >
                    <TableCell className="font-mono text-sm">{g.codice || "—"}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {g.descrizione}
                        {g.is_pluri && (
                          <Badge variant="outline" className="gap-1 border-primary/40 bg-accent/40 text-foreground">
                            <ShieldCheck className="w-3 h-3" />Fallback di sistema
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      {g.agenzie_count > 0 ? (
                        <button
                          type="button"
                          onClick={() => setAgenzieDialog({ gruppoId: g.id, gruppoDescrizione: g.descrizione })}
                          title="Vedi agenzie collegate"
                          className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary rounded"
                        >
                          <Badge variant="default" className="cursor-pointer">{g.agenzie_count}</Badge>
                        </button>
                      ) : (
                        <Badge variant="outline">0</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={g.attivo ? "default" : "secondary"}>{g.attivo ? "Attiva" : "Disattiva"}</Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive disabled:opacity-30"
                        disabled={g.is_pluri}
                        title={g.is_pluri ? "Compagnia di sistema, non eliminabile" : "Elimina"}
                        onClick={() => handleDeleteClick(g)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nessuna compagnia trovata</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { setEditId(null); setForm(emptyGruppo); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifica Compagnia</DialogTitle></DialogHeader>
          {renderForm()}
          <Button onClick={() => updateMutation.mutate()} disabled={!form.descrizione || updateMutation.isPending} className="w-full">
            {updateMutation.isPending ? "Salvataggio..." : "Salva Modifiche"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la compagnia?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.count > 0 ? (
                <>
                  La compagnia <b>{deleteTarget.descrizione}</b> ha <b>{deleteTarget.count}</b> agenzie collegate.
                  Riassegnale a un'altra compagnia prima di procedere all'eliminazione.
                </>
              ) : (
                <>Stai per eliminare <b>{deleteTarget?.descrizione}</b>. L'operazione è irreversibile.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!deleteTarget && deleteTarget.count > 0}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AgenzieCollegateDialog
        gruppoId={agenzieDialog?.gruppoId ?? null}
        gruppoDescrizione={agenzieDialog?.gruppoDescrizione ?? ""}
        open={!!agenzieDialog}
        onClose={() => setAgenzieDialog(null)}
        onOpenAgenzia={onOpenAgenzia}
      />
    </div>
  );
}

// ── Main Page ──

const CompagnieList = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CompagniaForm>(emptyForm);

  const [searchNome, setSearchNome] = useState("");
  const [searchCodice, setSearchCodice] = useState("");
  
  const [onlyPluri, setOnlyPluri] = useState(false);
  const [activeTab, setActiveTab] = useState("compagnie");

  const { data: compagnie = [], isLoading } = useQuery({
    queryKey: ["compagnie"],
    queryFn: async () => {
      const { data, error } = await supabase.from("compagnie").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Lookup map id → { descrizione, codice } per arricchire la lista Agenzie
  const { data: gruppiMap = {} } = useQuery({
    queryKey: ["gruppi_compagnia_map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gruppi_compagnia" as any)
        .select("id, descrizione, codice");
      const map: Record<string, { descrizione: string; codice: string | null; is_pluri: boolean }> = {};
      (data || []).forEach((g: any) => {
        map[g.id] = { descrizione: g.descrizione, codice: g.codice, is_pluri: g.codice === PLURIMANDATARIO_CODE };
      });
      return map;
    },
    staleTime: 1000 * 60 * 30,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("compagnie").insert(formToPayload(form) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compagnie"] });
      setCreateOpen(false);
      setForm(emptyForm);
      toast.success("Compagnia creata con successo");
    },
    onError: () => toast.error("Errore nella creazione"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      const { error } = await supabase.from("compagnie").update(formToPayload(form) as any).eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compagnie"] });
      setEditOpen(false);
      setEditId(null);
      toast.success("Compagnia aggiornata");
    },
    onError: () => toast.error("Errore nell'aggiornamento"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, attiva }: { id: string; attiva: boolean }) => {
      const { error } = await supabase.from("compagnie").update({ attiva }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compagnie"] }),
  });

  const openEdit = (c: any) => {
    setForm(dbToForm(c));
    setEditId(c.id);
    setEditOpen(true);
  };

  const filteredAnagrafica = compagnie.filter((c: any) => {
    const matchNome = !searchNome || c.nome?.toLowerCase().includes(searchNome.toLowerCase()) || c.nome_sede?.toLowerCase().includes(searchNome.toLowerCase());
    const matchCodice = !searchCodice || c.codice?.toLowerCase().startsWith(searchCodice.toLowerCase());
    const matchPluri = !onlyPluri || (c.gruppo_compagnia_id && (gruppiMap as any)[c.gruppo_compagnia_id]?.is_pluri);
    return matchNome && matchCodice && matchPluri;
  });

  const pluriCount = compagnie.filter((c: any) => (gruppiMap as any)[c.gruppo_compagnia_id]?.is_pluri).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compagnie / Agenzie</h1>
          <p className="text-muted-foreground">
            Gestione compagnie (gruppi madre), agenzie e provvigioni —{" "}
            <span className="font-semibold">{compagnie.length}</span> agenzie totali
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setForm(emptyForm); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuova Agenzia</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <CompagniaFormDialog
              form={form} setForm={setForm}
              onSave={() => createMutation.mutate()}
              saving={createMutation.isPending}
              title="Nuova Agenzia"
              saveLabel="Crea Agenzia"
              compagniaId={null}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { setEditId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <CompagniaFormDialog
            form={form} setForm={setForm}
            onSave={() => updateMutation.mutate()}
            saving={updateMutation.isPending}
            title="Modifica Agenzia"
            saveLabel="Salva Modifiche"
            compagniaId={editId}
          />
        </DialogContent>
      </Dialog>

      {/* Main page tabs */}
      <Tabs defaultValue="compagnie" className="w-full">
        <TabsList>
          <TabsTrigger value="compagnie" className="gap-2">
            <Layers className="w-4 h-4" />Compagnie
          </TabsTrigger>
          <TabsTrigger value="anagrafica" className="gap-2">
            <Building2 className="w-4 h-4" />Agenzie
          </TabsTrigger>
          <TabsTrigger value="import-provvigioni" className="gap-2">
            <Brain className="w-4 h-4" />Import Provvigioni IA
          </TabsTrigger>
          <TabsTrigger value="agenzie-rif" className="gap-2" disabled>
            <Network className="w-4 h-4" />Agenzie di riferimento
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">Prossimamente</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compagnie" className="mt-4">
          <CompagnieMadriTab />
        </TabsContent>

        <TabsContent value="anagrafica" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Specificare il nome, anche parziale (vuoto = tutto)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Cerca per nome o sede..." value={searchNome} onChange={(e) => setSearchNome(e.target.value)} className="pl-9" />
                  </div>
                </div>
                <div className="w-40 space-y-1">
                  <Label className="text-xs text-muted-foreground">Oppure il codice iniziale</Label>
                  <Input placeholder="Codice..." value={searchCodice} onChange={(e) => setSearchCodice(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Filtro rapido</Label>
                  <Button
                    variant={onlyPluri ? "default" : "outline"}
                    onClick={() => setOnlyPluri((v) => !v)}
                    className="gap-2"
                    title="Mostra solo agenzie da riassegnare"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Solo Plurimandatario {pluriCount > 0 && <Badge variant="secondary">{pluriCount}</Badge>}
                  </Button>
                </div>
                <Button variant="secondary" onClick={() => { setSearchNome(""); setSearchCodice(""); setOnlyPluri(false); }}>Reset</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-5 h-5" />Elenco Agenzie ({filteredAnagrafica.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">Caricamento...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Codice</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Sede</TableHead>
                      <TableHead>Compagnia</TableHead>
                      <TableHead>Comune</TableHead>
                      <TableHead>Prov</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Attiva</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnagrafica.map((c: any) => {
                      const grp = c.gruppo_compagnia_id ? (gruppiMap as any)[c.gruppo_compagnia_id] : null;
                      const isPluri = grp?.is_pluri;
                      return (
                        <TableRow
                          key={c.id}
                          className={`cursor-pointer hover:bg-muted/50 ${isPluri ? "bg-accent/30" : ""}`}
                          onClick={() => openEdit(c)}
                        >
                          <TableCell className="font-mono text-sm">{c.codice || "—"}</TableCell>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell>{c.nome_sede || "—"}</TableCell>
                          <TableCell>
                            {isPluri ? (
                              <Badge variant="outline" className="gap-1 border-primary/40 bg-accent/40 text-foreground">
                                <AlertTriangle className="w-3 h-3" />Plurimandatario
                              </Badge>
                            ) : (
                              <span>{grp?.descrizione || c.gruppo_compagnia || "—"}</span>
                            )}
                          </TableCell>
                          <TableCell>{c.comune || "—"}</TableCell>
                          <TableCell>{c.provincia || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={c.stato === "Attivo" ? "default" : "secondary"}>
                              {c.stato || (c.attiva ? "Attivo" : "Non Operativo")}
                            </Badge>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Switch checked={c.attiva ?? true} onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, attiva: v })} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredAnagrafica.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nessuna agenzia trovata</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import-provvigioni">
          <ImportProvvigioniTab />
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default CompagnieList;
