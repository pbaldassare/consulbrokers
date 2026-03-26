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
import { Plus, Building2, Search, ShieldAlert, Package, Percent, Pencil } from "lucide-react";
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
  gruppo_compagnia: "", tipo_mandatario: "", gruppo_statistico: "",
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
        <p>Salva la compagnia prima di configurare le provvigioni per ramo.</p>
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
            {renderField("Nome Compagnia *", "nome")}
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
              <Label className="text-xs text-muted-foreground">Gruppo Finanziario</Label>
              <SearchableSelect
                options={toOptions(GRUPPI_STATISTICI)}
                value={form.gruppo_compagnia}
                onValueChange={(v) => setField("gruppo_compagnia", v)}
                placeholder="Seleziona..."
              />
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
      <Button onClick={onSave} disabled={!form.nome || saving} className="w-full mt-4">
        {saveLabel}
      </Button>
    </>
  );
}

// ── Prodotti & Provvigioni Tab ──

function ProdottiProvvigioniTab({ compagnie }: { compagnie: any[] }) {
  const queryClient = useQueryClient();
  const [searchProdotto, setSearchProdotto] = useState("");
  const [filterCompagnia, setFilterCompagnia] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [createProdOpen, setCreateProdOpen] = useState(false);

  const [newProd, setNewProd] = useState({
    compagnia_id: "",
    categoria_id: "",
    nome_prodotto: "",
    codice_prodotto: "",
  });

  const { data: categorie = [] } = useQuery({
    queryKey: ["categorie_prodotto"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorie_prodotto").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: prodotti = [], isLoading } = useQuery({
    queryKey: ["prodotti_catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prodotti")
        .select("*, compagnie(id, nome, nome_sede), categorie_prodotto(id, nome)")
        .order("nome_prodotto");
      if (error) throw error;
      return data || [];
    },
  });

  const compagniaOptions = compagnie.map((c: any) => ({
    value: c.id,
    label: c.nome + (c.nome_sede ? ` - ${c.nome_sede}` : ""),
  }));

  const categoriaOptions = categorie.map((c: any) => ({
    value: c.id,
    label: c.nome,
  }));

  const createProdMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("prodotti").insert({
        compagnia_id: newProd.compagnia_id || null,
        categoria_id: newProd.categoria_id || null,
        nome_prodotto: newProd.nome_prodotto,
        codice_prodotto: newProd.codice_prodotto || null,
        attivo: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prodotti_catalogo"] });
      setCreateProdOpen(false);
      setNewProd({ compagnia_id: "", categoria_id: "", nome_prodotto: "", codice_prodotto: "" });
      toast.success("Prodotto creato con successo");
    },
    onError: () => toast.error("Errore nella creazione del prodotto"),
  });

  const filteredProdotti = prodotti.filter((p: any) => {
    const matchSearch = !searchProdotto || p.nome_prodotto?.toLowerCase().includes(searchProdotto.toLowerCase());
    const matchComp = !filterCompagnia || p.compagnia_id === filterCompagnia;
    const matchCat = !filterCategoria || p.categoria_id === filterCategoria;
    return matchSearch && matchComp && matchCat;
  });

  return (
    <div className="space-y-6">
      {/* ── SEZIONE 1: Provvigioni per Ramo ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="w-5 h-5" />Provvigioni per Ramo ({filteredProvvRamo.length})
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="w-52">
                <SearchableSelect
                  options={[{ value: "", label: "Tutte le compagnie" }, ...compagniaOptions]}
                  value={filterProvvCompagnia}
                  onValueChange={setFilterProvvCompagnia}
                  placeholder="Filtra compagnia..."
                />
              </div>
              <Dialog open={createProvvRamoOpen} onOpenChange={setCreateProvvRamoOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-2" />Nuova Provvigione Ramo</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nuova Provvigione per Ramo</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Compagnia / Sede *</Label>
                      <SearchableSelect
                        options={compagniaOptions}
                        value={newProvvRamo.compagnia_id}
                        onValueChange={(v) => setNewProvvRamo((p) => ({ ...p, compagnia_id: v }))}
                        placeholder="Seleziona compagnia..."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Ramo (Categoria) *</Label>
                      <SearchableSelect
                        options={categoriaOptions}
                        value={newProvvRamo.categoria_id}
                        onValueChange={(v) => setNewProvvRamo((p) => ({ ...p, categoria_id: v }))}
                        placeholder="Seleziona ramo..."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Provvigione % *</Label>
                      <Input type="number" step="0.01" value={newProvvRamo.percentuale} onChange={(e) => setNewProvvRamo((p) => ({ ...p, percentuale: e.target.value }))} placeholder="es. 5" />
                    </div>
                    <Button onClick={() => createProvvRamoMutation.mutate()} disabled={!newProvvRamo.compagnia_id || !newProvvRamo.categoria_id || !newProvvRamo.percentuale || createProvvRamoMutation.isPending} className="w-full">
                      Crea Provvigione
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingProvvRamo ? (
            <p className="text-muted-foreground">Caricamento...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compagnia</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Ramo</TableHead>
                  <TableHead>Provvigione %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProvvRamo.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.compagnie?.nome || "—"}</TableCell>
                    <TableCell>{p.compagnie?.nome_sede || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{p.categorie_prodotto?.nome || "—"}</Badge></TableCell>
                    <TableCell>
                      {editingProvvRamo === p.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            className="w-20 h-8"
                            value={editProvvRamoValue}
                            onChange={(e) => setEditProvvRamoValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editProvvRamoValue) {
                                updateProvvRamoMutation.mutate({ id: p.id, value: parseFloat(editProvvRamoValue) });
                              }
                              if (e.key === "Escape") setEditingProvvRamo(null);
                            }}
                            autoFocus
                          />
                          <span className="text-muted-foreground">%</span>
                        </div>
                      ) : (
                        <button
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                          onClick={() => { setEditingProvvRamo(p.id); setEditProvvRamoValue(String(p.percentuale_provvigione ?? "")); }}
                        >
                          <span className="font-semibold">{p.percentuale_provvigione}%</span>
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProvvRamo.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nessuna provvigione configurata</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── SEZIONE 2: Catalogo Prodotti ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Cerca prodotto</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Nome prodotto..." value={searchProdotto} onChange={(e) => setSearchProdotto(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="w-52 space-y-1">
              <Label className="text-xs text-muted-foreground">Compagnia</Label>
              <SearchableSelect
                options={[{ value: "", label: "Tutte" }, ...compagniaOptions]}
                value={filterCompagnia}
                onValueChange={setFilterCompagnia}
                placeholder="Tutte..."
              />
            </div>
            <div className="w-48 space-y-1">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <SearchableSelect
                options={[{ value: "", label: "Tutte" }, ...categoriaOptions]}
                value={filterCategoria}
                onValueChange={setFilterCategoria}
                placeholder="Tutte..."
              />
            </div>
            <Button variant="secondary" onClick={() => { setSearchProdotto(""); setFilterCompagnia(""); setFilterCategoria(""); }}>Reset</Button>
            <Dialog open={createProdOpen} onOpenChange={setCreateProdOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Nuovo Prodotto</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuovo Prodotto</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Compagnia / Sede *</Label>
                    <SearchableSelect
                      options={compagniaOptions}
                      value={newProd.compagnia_id}
                      onValueChange={(v) => setNewProd((p) => ({ ...p, compagnia_id: v }))}
                      placeholder="Seleziona compagnia..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Categoria</Label>
                    <SearchableSelect
                      options={categoriaOptions}
                      value={newProd.categoria_id}
                      onValueChange={(v) => setNewProd((p) => ({ ...p, categoria_id: v }))}
                      placeholder="Seleziona categoria..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nome Prodotto *</Label>
                    <Input value={newProd.nome_prodotto} onChange={(e) => setNewProd((p) => ({ ...p, nome_prodotto: e.target.value }))} placeholder="es. T Legale Allianz" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Codice Prodotto</Label>
                    <Input value={newProd.codice_prodotto} onChange={(e) => setNewProd((p) => ({ ...p, codice_prodotto: e.target.value }))} placeholder="Opzionale" />
                  </div>
                  <Button onClick={() => createProdMutation.mutate()} disabled={!newProd.nome_prodotto || !newProd.compagnia_id || createProdMutation.isPending} className="w-full">
                    Crea Prodotto
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="w-5 h-5" />Catalogo Prodotti ({filteredProdotti.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Caricamento...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compagnia</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Prodotto</TableHead>
                  <TableHead>Codice</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProdotti.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.compagnie?.nome || "—"}</TableCell>
                    <TableCell>{p.compagnie?.nome_sede || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.categorie_prodotto?.nome || "—"}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{p.nome_prodotto}</TableCell>
                    <TableCell className="font-mono text-sm">{p.codice_prodotto || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={p.attivo ? "default" : "secondary"}>
                        {p.attivo ? "Attivo" : "Inattivo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProdotti.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nessun prodotto trovato</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
  const [searchSinistri, setSearchSinistri] = useState("");

  const { data: compagnie = [], isLoading } = useQuery({
    queryKey: ["compagnie"],
    queryFn: async () => {
      const { data, error } = await supabase.from("compagnie").select("*").order("nome");
      if (error) throw error;
      return data;
    },
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
    return matchNome && matchCodice;
  });

  const filteredSinistri = compagnie.filter((c: any) => {
    if (!searchSinistri) return true;
    return c.nome?.toLowerCase().includes(searchSinistri.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compagnie</h1>
          <p className="text-muted-foreground">Gestione compagnie, sedi, prodotti e provvigioni</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setForm(emptyForm); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuova Compagnia</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <CompagniaFormDialog
              form={form} setForm={setForm}
              onSave={() => createMutation.mutate()}
              saving={createMutation.isPending}
              title="Nuova Compagnia"
              saveLabel="Crea Compagnia"
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
            title="Modifica Compagnia"
            saveLabel="Salva Modifiche"
            compagniaId={editId}
          />
        </DialogContent>
      </Dialog>

      {/* Main page tabs */}
      <Tabs defaultValue="anagrafica" className="w-full">
        <TabsList>
          <TabsTrigger value="anagrafica" className="gap-2">
            <Building2 className="w-4 h-4" />Anagrafica Compagnia
          </TabsTrigger>
          <TabsTrigger value="sinistri" className="gap-2">
            <ShieldAlert className="w-4 h-4" />Compagnie Sinistri
          </TabsTrigger>
          <TabsTrigger value="prodotti" className="gap-2">
            <Package className="w-4 h-4" />Prodotti & Provvigioni
          </TabsTrigger>
        </TabsList>

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
                <Button variant="secondary" onClick={() => { setSearchNome(""); setSearchCodice(""); }}>Reset</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-5 h-5" />Elenco ({filteredAnagrafica.length})
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
                      <TableHead>Gruppo</TableHead>
                      <TableHead>Comune</TableHead>
                      <TableHead>Prov</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Attiva</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnagrafica.map((c: any) => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(c)}>
                        <TableCell className="font-mono text-sm">{c.codice || "—"}</TableCell>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell>{c.nome_sede || "—"}</TableCell>
                        <TableCell>{c.gruppo_compagnia || "—"}</TableCell>
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
                    ))}
                    {filteredAnagrafica.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nessuna compagnia trovata</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sinistri" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Specificare il nome (anche parziale)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Cerca compagnia..." value={searchSinistri} onChange={(e) => setSearchSinistri(e.target.value)} className="pl-9" />
                  </div>
                </div>
                <Button variant="secondary" onClick={() => setSearchSinistri("")}>Reset</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="w-5 h-5" />Indirizzi Compagnia per Ufficio Sinistri ({filteredSinistri.length})
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
                      <TableHead>Nome Compagnia</TableHead>
                      <TableHead>Indirizzo</TableHead>
                      <TableHead>CAP</TableHead>
                      <TableHead>Comune</TableHead>
                      <TableHead>Prov</TableHead>
                      <TableHead>Telefono</TableHead>
                      <TableHead>PEC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSinistri.map((c: any) => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(c)}>
                        <TableCell className="font-mono text-sm">{c.codice || "—"}</TableCell>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell>{c.indirizzo || "—"}</TableCell>
                        <TableCell>{c.cap || "—"}</TableCell>
                        <TableCell>{c.comune || "—"}</TableCell>
                        <TableCell>{c.provincia || "—"}</TableCell>
                        <TableCell>{c.telefono || "—"}</TableCell>
                        <TableCell className="text-sm">{c.pec || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {filteredSinistri.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nessuna compagnia trovata</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prodotti" className="mt-4">
          <ProdottiProvvigioniTab compagnie={compagnie} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompagnieList;
