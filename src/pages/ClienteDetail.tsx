import { useState, useEffect, useRef, createContext, useContext, useMemo } from "react";
import { NuovaPolizzaButton } from "@/components/shared/NuovaPolizzaButton";
import { TipoPolizzaBadge } from "@/components/polizze/TipoPolizzaBadge";
import { TipoFilterSegmented } from "@/components/polizze/TipoFilterSegmented";
import { logAttivita } from "@/lib/logAttivita";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useNavigate } from "react-router-dom";
import { useTabParam } from "@/hooks/useTabParam";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountExecutivesLookup } from "@/hooks/useAccountExecutivesLookup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, User, Building2, Plus, Link2, FileText, Settings, BarChart3, Users, Wallet, AlertTriangle, Trash2, Globe, Key, ExternalLink, Check, ChevronsUpDown, Sparkles, ChevronRight, ChevronDown } from "lucide-react";
import { groupTitoliByPolizza } from "@/lib/quietanze";
import { SearchableSelect } from "@/components/SearchableSelect";
import AddressAutocomplete, { type AddressComponents } from "@/components/AddressAutocomplete";
import DocumentiTab from "@/components/DocumentiTab";
import { DeleteWithImpactDialog } from "@/components/common/DeleteWithImpactDialog";
import { pushAiEntityContext, buildClienteScopeHint } from "@/lib/ai/context";
import SinistriClienteTab from "@/components/SinistriClienteTab";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import AiDocumentScanner from "@/components/AiDocumentScanner";
import type { DocumentType } from "@/components/AiDocumentScanner";
import { toast } from "sonner";
import { parseCF } from "@/lib/parseCF";
import { lookupComune, COMUNI_OPTIONS } from "@/lib/comuniItaliani";
import { validatePIVA as validatePIVALib } from "@/lib/validatePIVA";
import { validateCF as validateCFLib } from "@/lib/validateCF";
import { FiscalCodeInput } from "@/components/ui/FiscalCodeInput";
import { assertFiscalValid } from "@/lib/assertFiscalValid";
import { useLookupZone, useLookupIndotti, useLookupAttivita, useLookupSettori, useLookupContratti, useLookupFasceFatturato, useLookupFasceDipendenti, useGruppiStatistici } from "@/hooks/useLookupTables";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import AnticipiChip from "@/components/clienti/AnticipiChip";
import AnalizzaPolizzaCgaDialog from "@/components/cga/AnalizzaPolizzaCgaDialog";
import PolizzeCgaSection from "@/components/cga/PolizzeCgaSection";

/* ===========================================================
 * Anagrafica form context + module-level field components
 * (extracted out of the page body to prevent input remounts
 * which caused focus loss on every keystroke)
 * =========================================================== */

interface AnagraficaFormCtxType {
  ef: any;
  readOnly: boolean;
  updateField: (field: string, value: any) => void;
  isFieldRequired: (field: string) => boolean;
  isFieldMissing: (field: string) => boolean;
  isAziendaIdMissing: boolean;
  handleCFAutoFill: (cf: string) => void;
}

const AnagraficaFormCtx = createContext<AnagraficaFormCtxType | null>(null);

function useAnagraficaForm() {
  const ctx = useContext(AnagraficaFormCtx);
  if (!ctx) throw new Error("AnagraficaFormCtx not provided");
  return ctx;
}

const RequiredMark = () => <span className="text-destructive ml-0.5">*</span>;

function FieldDisplay({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

function FieldInput({
  label,
  field,
  type = "text",
  required,
  warning,
  action,
  errorMessage,
}: {
  label: string;
  field: string;
  type?: string;
  required?: boolean;
  warning?: string | null;
  action?: React.ReactNode;
  errorMessage?: string;
}) {
  const { ef, readOnly, updateField, isFieldMissing, handleCFAutoFill } = useAnagraficaForm();
  const showError = !readOnly && required && isFieldMissing(field);
  return (
    <div>
      <Label className="text-xs">
        {label}
        {required && <RequiredMark />}
      </Label>
      {readOnly ? (
        <p className="text-sm mt-1">{ef[field] || "—"}</p>
      ) : (
        <div className="flex items-center gap-1">
          <Input
            className={`h-8 text-xs ${showError ? "border-destructive focus-visible:ring-destructive" : ""}`}
            type={type}
            value={ef[field] || ""}
            onChange={(e) => {
              const val =
                field === "codice_fiscale" || field === "codice_fiscale_azienda" || field === "partita_iva"
                  ? e.target.value.toUpperCase()
                  : e.target.value;
              updateField(field, val);
              if ((field === "codice_fiscale" || field === "codice_fiscale_azienda") && val.length === 16) {
                handleCFAutoFill(val);
              }
              if (field === "codice_fiscale_azienda" && val.length === 11 && /^\d{11}$/.test(val) && !ef.partita_iva) {
                updateField("partita_iva", val);
                toast.info("Partita IVA copiata dal Codice Fiscale Azienda");
              }
              if (field === "partita_iva" && val.length === 11 && /^\d{11}$/.test(val) && !ef.codice_fiscale_azienda) {
                updateField("codice_fiscale_azienda", val);
                toast.info("Codice Fiscale Azienda copiato dalla Partita IVA");
              }
            }}
          />
          {action}
        </div>
      )}
      {!readOnly && (() => {
        const v = (ef[field] || "").toString();
        let fiscalErr: string | undefined;
        if (v) {
          if (field === "codice_fiscale") {
            const r = validateCFLib(v, { allowPIVAFormat: false });
            if (!r.valid) fiscalErr = r.error;
          } else if (field === "codice_fiscale_azienda") {
            const r = validateCFLib(v, { allowPIVAFormat: true });
            if (!r.valid) fiscalErr = r.error;
          } else if (field === "partita_iva") {
            const r = validatePIVALib(v);
            if (!r.valid) fiscalErr = r.error;
          }
        }
        return (
          <>
            {showError && <p className="text-xs text-destructive mt-0.5">{errorMessage || "Campo obbligatorio"}</p>}
            {!showError && fiscalErr && <p className="text-xs text-destructive mt-0.5">{fiscalErr}</p>}
            {!showError && !fiscalErr && warning && <p className="text-xs text-amber-600 mt-0.5">{warning}</p>}
          </>
        );
      })()}
    </div>
  );
}

function FieldSelect({
  label,
  field,
  options,
  required,
}: {
  label: string;
  field: string;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  const { ef, readOnly, updateField, isFieldMissing } = useAnagraficaForm();
  const showError = !readOnly && required && isFieldMissing(field);
  return (
    <div>
      <Label className="text-xs">
        {label}
        {required && <RequiredMark />}
      </Label>
      {readOnly ? (
        <p className="text-sm mt-1">{options.find((o) => o.value === ef[field])?.label || ef[field] || "—"}</p>
      ) : (
        <SearchableSelect
          className={`h-8 text-xs ${showError ? "border-destructive" : ""}`}
          value={ef[field] || ""}
          onValueChange={(v) => updateField(field, v)}
          placeholder="—"
          options={options}
        />
      )}
      {showError && <p className="text-xs text-destructive mt-0.5">Campo obbligatorio</p>}
    </div>
  );
}

function FieldSwitch({ label, field }: { label: string; field: string }) {
  const { ef, readOnly, updateField } = useAnagraficaForm();
  return (
    <div className="flex items-center gap-2">
      <Switch checked={!!ef[field]} onCheckedChange={(v) => updateField(field, v)} disabled={readOnly} />
      <Label className="text-xs">{label}</Label>
    </div>
  );
}

function FieldAddress({
  label,
  field,
  capField,
  cittaField,
  provinciaField,
  required,
}: {
  label: string;
  field: string;
  capField: string;
  cittaField: string;
  provinciaField: string;
  required?: boolean;
}) {
  const { ef, readOnly, updateField, isFieldMissing } = useAnagraficaForm();
  const showError = !readOnly && required && isFieldMissing(field);
  return (
    <div>
      <Label className="text-xs">
        {label}
        {required && <RequiredMark />}
      </Label>
      {readOnly ? (
        <p className="text-sm mt-1">{ef[field] || "—"}</p>
      ) : (
        <AddressAutocomplete
          value={ef[field] || ""}
          onChange={(v) => updateField(field, v)}
          onSelect={(components: AddressComponents) => {
            updateField(field, components.indirizzo);
            updateField(capField, components.cap);
            updateField(cittaField, components.citta);
            updateField(provinciaField, components.provincia);
          }}
          placeholder="Cerca indirizzo..."
          className={`h-8 text-xs ${showError ? "border-destructive" : ""}`}
        />
      )}
      {showError && <p className="text-xs text-destructive mt-0.5">Campo obbligatorio</p>}
    </div>
  );
}

/**
 * Combobox cercabile sui comuni italiani con possibilità di inserire testo libero
 * (per comuni esteri o non presenti nel dataset).
 */
function FieldComuneItaliano({
  label,
  field,
  required,
  warning,
}: {
  label: string;
  field: string;
  required?: boolean;
  warning?: string | null;
}) {
  const { ef, readOnly, updateField, isFieldMissing } = useAnagraficaForm();
  const showError = !readOnly && required && isFieldMissing(field);
  const value = (ef[field] || "") as string;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COMUNI_OPTIONS.slice(0, 80);
    return COMUNI_OPTIONS.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 80);
  }, [search]);

  const exactMatch = COMUNI_OPTIONS.some((o) => o.label.toLowerCase() === search.trim().toLowerCase());

  if (readOnly) {
    return (
      <div>
        <Label className="text-xs">
          {label}
          {required && <RequiredMark />}
        </Label>
        <p className="text-sm mt-1">{value || "—"}</p>
      </div>
    );
  }

  return (
    <div>
      <Label className="text-xs">
        {label}
        {required && <RequiredMark />}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-8 w-full justify-between font-normal text-xs",
              !value && "text-muted-foreground",
              showError && "border-destructive",
            )}
          >
            <span className="truncate">{value || "—"}</span>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Cerca comune o digita libero..." value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>
                <button
                  type="button"
                  className="w-full text-left text-xs px-2 py-1.5 hover:bg-accent rounded"
                  onClick={() => {
                    if (search.trim()) {
                      updateField(field, search.trim());
                      setOpen(false);
                      setSearch("");
                    }
                  }}
                >
                  Usa "{search}" come testo libero
                </button>
              </CommandEmpty>
              {search.trim() && !exactMatch && (
                <CommandGroup heading="Testo libero">
                  <CommandItem
                    value={`__free_${search}`}
                    onSelect={() => {
                      updateField(field, search.trim());
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Plus className="mr-2 h-3 w-3" /> Usa "{search}"
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                {filtered.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => {
                      updateField(field, o.value);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check className={cn("mr-2 h-3 w-3", value === o.value ? "opacity-100" : "opacity-0")} />
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {showError && <p className="text-xs text-destructive mt-0.5">Campo obbligatorio</p>}
      {!showError && warning && <p className="text-xs text-amber-600 mt-0.5">{warning}</p>}
    </div>
  );
}


const tipiRelazione = [
  { value: "dipendente", label: "Dipendente" },
  { value: "legale_rappresentante", label: "Legale Rappresentante" },
  { value: "referente", label: "Referente" },
  { value: "socio", label: "Socio" },
];

/* ── Rete Commerciale Sub-component ──
 * Allineato al flusso attuale di creazione cliente: solo assegnazione profilo
 * per Account Executive (AE) e Consul (DB ruolo "Produttore Sede").
 * Lo Specialist (DB ruolo "Backoffice") è gestito nella card "Assegnazioni Gestionali".
 * Tutti i campi legacy (% provvigione, società/brand, mandato, scadenze, altro broker)
 * sono stati rimossi dalla UI.
 */
const ruoliCommerciali = [
  { value: "AE", label: "Account Executive", tipo: "account_executive" },
  { value: "Produttore Sede", label: "Produttore", tipo: "corrispondente" },
];

function CodiciCommercialiSection({ clienteId }: { clienteId: string }) {
  const queryClient = useQueryClient();

  const { data: codici = [] } = useQuery({
    queryKey: ["codici_commerciali", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("codici_commerciali_cliente")
        .select("id, ruolo, profilo_id, anagrafica_id")
        .eq("cliente_id", clienteId)
        .in("ruolo", ["AE", "Produttore Sede"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Anagrafiche Amministrative: fonte canonica per AE e Produttore.
  const { data: anagraficheAll = [] } = useQuery({
    queryKey: ["anagrafiche-ae-produttore"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, tipo, nome, cognome, ragione_sociale, sigla, codice")
        .in("tipo", ["account_executive", "corrispondente"])
        .eq("attivo", true);
      return data || [];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ ruolo, anagrafica_id }: { ruolo: string; anagrafica_id: string | null }) => {
      if (!anagrafica_id) {
        const { error } = await supabase.from("codici_commerciali_cliente")
          .delete()
          .eq("cliente_id", clienteId)
          .eq("ruolo", ruolo);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("codici_commerciali_cliente")
        .upsert(
          { cliente_id: clienteId, ruolo, anagrafica_id, profilo_id: null },
          { onConflict: "cliente_id,ruolo" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["codici_commerciali", clienteId] });
      toast.success("Assegnazione salvata");
    },
    onError: (err: any) => toast.error(err.message || "Errore salvataggio"),
  });

  const getAnagraficaByRuolo = (ruolo: string) =>
    codici.find((c: any) => c.ruolo === ruolo)?.anagrafica_id || "";

  const buildOptions = (tipo: string) =>
    anagraficheAll
      .filter((a) => a.tipo === tipo)
      .map((a) => ({
        value: a.id,
        label:
          (a.ragione_sociale && a.ragione_sociale.trim()) ||
          `${a.cognome || ""} ${a.nome || ""}`.trim() ||
          a.sigla ||
          a.codice ||
          "—",
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "it"));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {ruoliCommerciali.map((r) => (
        <div key={r.value} className="space-y-1">
          <Label className="text-xs">{r.label}</Label>
          <SearchableSelect
            className="h-8 text-xs"
            value={getAnagraficaByRuolo(r.value)}
            onValueChange={(v) => upsertMutation.mutate({ ruolo: r.value, anagrafica_id: v || null })}
            placeholder={`— Seleziona ${r.label} —`}
            options={buildOptions(r.tipo)}
          />
        </div>
      ))}
    </div>
  );
}

/* ── Nominativi Sub-component ── */
function NominativiSection({ clienteId, readOnly }: { clienteId: string; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [emailN, setEmailN] = useState("");
  const [telefonoN, setTelefonoN] = useState("");
  const [ruoloN, setRuoloN] = useState("");

  const { data: nominativi = [] } = useQuery({
    queryKey: ["nominativi_cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nominativi_cliente")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("nominativi_cliente").insert({
        cliente_id: clienteId,
        nome: nome || null,
        cognome: cognome || null,
        email: emailN || null,
        telefono: telefonoN || null,
        ruolo: ruoloN || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nominativi_cliente", clienteId] });
      setNome(""); setCognome(""); setEmailN(""); setTelefonoN(""); setRuoloN("");
      toast.success("Nominativo aggiunto");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nominativi_cliente").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nominativi_cliente", clienteId] });
      toast.success("Nominativo rimosso");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Nominativi / Referenti</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {nominativi.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cognome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Ruolo</TableHead>
                {!readOnly && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {nominativi.map((n: any) => (
                <TableRow key={n.id}>
                  <TableCell>{n.nome || "—"}</TableCell>
                  <TableCell>{n.cognome || "—"}</TableCell>
                  <TableCell>{n.email || "—"}</TableCell>
                  <TableCell>{n.telefono || "—"}</TableCell>
                  <TableCell>{n.ruolo || "—"}</TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(n.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!readOnly && (
          <div className="border rounded-md p-3 bg-muted/30">
            <p className="text-xs font-semibold mb-2">Aggiungi Nominativo</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Input className="h-8 text-xs" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              <Input className="h-8 text-xs" placeholder="Cognome" value={cognome} onChange={(e) => setCognome(e.target.value)} />
              <Input className="h-8 text-xs" placeholder="Email" value={emailN} onChange={(e) => setEmailN(e.target.value)} />
              <Input className="h-8 text-xs" placeholder="Telefono" value={telefonoN} onChange={(e) => setTelefonoN(e.target.value)} />
              <Input className="h-8 text-xs" placeholder="Ruolo" value={ruoloN} onChange={(e) => setRuoloN(e.target.value)} />
            </div>
            <Button size="sm" className="mt-2" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || (!nome && !cognome)}>
              <Plus className="w-3 h-3 mr-1" />Aggiungi
            </Button>
          </div>
        )}
        {nominativi.length === 0 && readOnly && (
          <p className="text-center text-muted-foreground py-4 text-sm">Nessun nominativo presente</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Dati Statistici Sub-component ── */
function DatiStatisticiSection({ ef, readOnly, updateField, gruppiFinanziari, isFieldMissing }: { ef: Record<string, any>; readOnly: boolean; updateField: (f: string, v: any) => void; gruppiFinanziari: any[]; isFieldMissing: (f: string) => boolean }) {
  const { data: zoneOpts = [] } = useLookupZone();
  const { data: indottiOpts = [] } = useLookupIndotti();
  const { data: attivitaOpts = [] } = useLookupAttivita();
  const { data: settoriOpts = [] } = useLookupSettori();
  const { data: contrattiOpts = [] } = useLookupContratti();
  const { data: fasceFatturatoOpts = [] } = useLookupFasceFatturato();
  const { data: fasceDipendentiOpts = [] } = useLookupFasceDipendenti();
  const { data: gruppiStatOpts = [] } = useGruppiStatistici();

  const LookupField = ({ label, field, options }: { label: string; field: string; options: { value: string; label: string }[] }) => (
    <div>
      <Label className="text-xs">{label}</Label>
      {readOnly ? (
        <p className="text-sm mt-1">{options.find(o => o.value === ef[field])?.label || ef[field] || "—"}</p>
      ) : (
        <SearchableSelect
          className="h-8 text-xs"
          value={ef[field] || ""}
          onValueChange={(v) => updateField(field, v || null)}
          placeholder="— Seleziona —"
          options={options}
        />
      )}
    </div>
  );

  const FieldInput = ({ label, field, type = "text" }: { label: string; field: string; type?: string }) => (
    <div>
      <Label className="text-xs">{label}</Label>
      {readOnly ? (
        <p className="text-sm mt-1">{ef[field] || "—"}</p>
      ) : (
        <Input className="h-8 text-xs" type={type} value={ef[field] || ""} onChange={(e) => updateField(field, e.target.value)} />
      )}
    </div>
  );

  const FieldSwitch = ({ label, field }: { label: string; field: string }) => (
    <div className="flex items-center gap-2">
      <Switch checked={!!ef[field]} onCheckedChange={(v) => updateField(field, v)} disabled={readOnly} />
      <Label className="text-xs">{label}</Label>
    </div>
  );

  const gfMissing = isFieldMissing("gruppo_finanziario_id");

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
      {/* Gruppo Finanziario (obbligatorio) */}
      <div>
        <Label className="text-xs">
          Gruppo Finanziario{!readOnly && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {readOnly ? (
          <p className="text-sm mt-1">{gruppiFinanziari.find((g: any) => g.id === ef.gruppo_finanziario_id)?.nome || "—"}</p>
        ) : (
          <>
            <SearchableSelect
              className={`h-8 text-xs ${gfMissing ? "border-destructive ring-1 ring-destructive" : ""}`}
              value={ef.gruppo_finanziario_id || ""}
              onValueChange={(v) => updateField("gruppo_finanziario_id", v || null)}
              placeholder="— Seleziona gruppo —"
              options={gruppiFinanziari.map((g: any) => ({ value: g.id, label: `${g.codice} - ${g.nome}` }))}
            />
            {gfMissing && (
              <p className="text-[11px] text-destructive mt-1">Campo obbligatorio</p>
            )}
          </>
        )}
      </div>
      <LookupField label="Zona" field="zona" options={zoneOpts} />
      <LookupField label="Indotto" field="indotto" options={indottiOpts} />
      <LookupField label="Gruppo Statistico" field="gruppo_statistico" options={gruppiStatOpts} />
      <LookupField label="Attività" field="attivita" options={attivitaOpts} />
      <LookupField label="Settore" field="settore" options={settoriOpts} />
      <FieldInput label="Azienda Stat." field="azienda_stat" />
      <LookupField label="Contratto" field="contratto" options={contrattiOpts} />
      <FieldInput label="Matricola" field="matricola" />
      <FieldInput label="Riferimento" field="riferimento" />
      <LookupField label="Fascia Fatturato" field="fascia_fatturato" options={fasceFatturatoOpts} />
      <LookupField label="Fascia Dipendenti" field="fascia_dipendenti" options={fasceDipendentiOpts} />
      <FieldInput label="Codice ATECO" field="codice_ateco" />
      <FieldSwitch label="Cliente Associato" field="cliente_associato" />
      <FieldSwitch label="Cliente Captive" field="cliente_captive" />
      <FieldSwitch label="Internazionale" field="internazionale" />
    </div>
  );
}

/* ── Trattative Cliente Sub-component ── */
const STATI_TRATTATIVA = [
  { value: "aperta", label: "Aperta", color: "bg-kpi-blue-bg text-kpi-blue-text border-kpi-blue-border" },
  { value: "in_negoziazione", label: "In Negoziazione", color: "bg-kpi-yellow-bg text-kpi-yellow-text border-kpi-yellow-border" },
  { value: "chiusa_vinta", label: "Chiusa Vinta", color: "bg-kpi-green-bg text-kpi-green-text border-kpi-green-border" },
  { value: "chiusa_persa", label: "Chiusa Persa", color: "bg-destructive/10 text-destructive border-destructive/30" },
];

function TrattativeClienteSection({ clienteId }: { clienteId: string }) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ramo_id: "", compagnia_id: "", premio_previsto: "", note: "" });

  const { data: trattative = [] } = useQuery({
    queryKey: ["trattative_cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trattative")
        .select("*, ramo:ramo_id(descrizione), compagnia_rel:compagnia_id(nome)")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: ramiOpts = [] } = useQuery({
    queryKey: ["rami_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("id, codice, descrizione").eq("attivo", true).order("codice");
      return (data || []).map((r) => ({ value: r.id, label: `${r.codice} - ${r.descrizione}` }));
    },
  });

  const { data: compagnieOpts = [] } = useQuery({
    queryKey: ["compagnie_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return (data || []).map((c) => ({ value: c.id, label: c.nome }));
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        cliente_id: clienteId,
        ramo_id: form.ramo_id || null,
        compagnia_id: form.compagnia_id || null,
        premio_previsto: form.premio_previsto ? parseFloat(form.premio_previsto) : null,
        note: form.note || null,
        stato: "aperta",
        created_by: profile?.id || null,
      };
      const { data, error } = await supabase.from("trattative").insert(payload).select().single();
      if (error) throw error;
      await logAttivita({
        azione: "creazione_trattativa",
        entita_tipo: "cliente",
        entita_id: clienteId,
        dettagli_json: { trattativa_id: data.id },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattative_cliente", clienteId] });
      toast.success("Trattativa creata");
      setForm({ ramo_id: "", compagnia_id: "", premio_previsto: "", note: "" });
      setCreateOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateStato = useMutation({
    mutationFn: async ({ id, newStato, oldStato }: { id: string; newStato: string; oldStato: string }) => {
      const update: Record<string, unknown> = { stato: newStato, updated_at: new Date().toISOString() };
      if (newStato === "chiusa_vinta" || newStato === "chiusa_persa") update.data_chiusura = new Date().toISOString();
      const { error } = await supabase.from("trattative").update(update).eq("id", id);
      if (error) throw error;
      const azione = (newStato === "chiusa_vinta" || newStato === "chiusa_persa") ? "chiusura_trattativa" : "modifica_stato_trattativa";
      await logAttivita({ azione, entita_tipo: "trattativa", entita_id: id, dettagli_json: { cliente_id: clienteId, stato_precedente: oldStato, nuovo_stato: newStato } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattative_cliente", clienteId] });
      toast.success("Trattativa aggiornata");
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Trattative ({trattative.length})</CardTitle>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nuova Trattativa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuova Trattativa</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Garanzia</Label>
                <SearchableSelect options={ramiOpts} value={form.ramo_id} onValueChange={(v) => setForm({ ...form, ramo_id: v })} placeholder="Seleziona garanzia..." />
              </div>
              <div className="space-y-1.5">
                <Label>Agenzia</Label>
                <SearchableSelect options={compagnieOpts} value={form.compagnia_id} onValueChange={(v) => setForm({ ...form, compagnia_id: v })} placeholder="Seleziona agenzia..." />
              </div>
              <div className="space-y-1.5">
                <Label>Premio Previsto (€)</Label>
                <Input type="number" value={form.premio_previsto} onChange={(e) => setForm({ ...form, premio_previsto: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Note</Label>
                <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note..." rows={3} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Crea Trattativa</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {trattative.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nessuna trattativa</p>
        ) : (
          <div className="space-y-3">
            {trattative.map((t: any) => (
              <div key={t.id} className="border border-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{t.ramo?.descrizione || t.prodotto || "—"}</p>
                  <p className="text-sm text-muted-foreground">{t.compagnia_rel?.nome || t.compagnia || "—"} • {t.premio_previsto ? `€ ${Number(t.premio_previsto).toLocaleString("it-IT")}` : "Premio n.d."}</p>
                  {t.note && <p className="text-xs text-muted-foreground mt-1">{t.note}</p>}
                </div>
                <div className="flex items-center gap-3">
                  {(() => {
                    const s = STATI_TRATTATIVA.find((x) => x.value === t.stato);
                    return s ? <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${s.color}`}>{s.label}</span> : <Badge variant="secondary">{t.stato}</Badge>;
                  })()}
                  <Select value={t.stato} onValueChange={(v) => updateStato.mutate({ id: t.id, newStato: v, oldStato: t.stato })}>
                    <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATI_TRATTATIVA.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Area Riservata Header Button ── */
function AreaRiservataHeaderButton({ cliente, onUpdate }: { cliente: any; onUpdate: () => void }) {
  const [tipo, setTipo] = useState<string>("sola_lettura");
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [emailText, setEmailText] = useState("");

  const currentTipo = cliente.area_riservata_tipo || "nessuna";
  const isActive = currentTipo !== "nessuna";
  const clienteName = cliente.ragione_sociale || `${cliente.nome || ""} ${cliente.cognome || ""}`.trim() || "Cliente";
  const portalUrl = `${window.location.origin}/cliente`;

  const buildDefaultEmail = (selectedTipo: string) => `Gentile ${clienteName},

La sua area riservata è stata attivata. Può accedere al portale utilizzando le seguenti credenziali:

Username: ${cliente.email || "—"}
Password: Consul123!

Tipo di accesso: ${selectedTipo === "completa" ? "Completo (lettura e caricamento documenti)" : "Solo Visualizzazione (consultazione e messaggi)"}

Link al portale: ${portalUrl}

Si consiglia di cambiare la password al primo accesso.

Cordiali saluti,
Consulbrokers S.r.l.`;

  const openDialog = () => {
    const t = isActive ? currentTipo : "sola_lettura";
    setTipo(t);
    setEmailText(buildDefaultEmail(t));
    setDialogOpen(true);
  };

  const handleTipoChange = (newTipo: string) => {
    setTipo(newTipo);
    setEmailText(buildDefaultEmail(newTipo));
  };

  const handleActivate = async () => {
    setSaving(true);
    try {
      if (!cliente.user_id) {
        if (!cliente.email) {
          toast.error("Email mancante — impossibile creare l'account");
          setSaving(false);
          return;
        }
        const { error } = await supabase.functions.invoke("create-cliente-user", {
          body: { cliente_id: cliente.id },
        });
        if (error) throw error;
      }

      const { error: updErr } = await supabase
        .from("clienti")
        .update({ area_riservata_tipo: tipo })
        .eq("id", cliente.id);
      if (updErr) throw updErr;

      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "client-portal-activation",
            recipientEmail: cliente.email,
            idempotencyKey: `portal-activation-${cliente.id}-${Date.now()}`,
            templateData: { name: clienteName, email: cliente.email, portalUrl, tipo, customText: emailText },
          },
        });
      } catch {
        // Email sending not configured yet
      }

      toast.success(isActive ? "Area riservata aggiornata" : "Area riservata attivata con successo");
      setDialogOpen(false);
      onUpdate();
    } catch (err: any) {
      toast.error("Errore: " + err.message);
    }
    setSaving(false);
  };

  const handleDeactivate = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("clienti")
        .update({ area_riservata_tipo: "nessuna" })
        .eq("id", cliente.id);
      if (error) throw error;
      toast.success("Area riservata disattivata");
      setDialogOpen(false);
      onUpdate();
    } catch (err: any) {
      toast.error("Errore: " + err.message);
    }
    setSaving(false);
  };

  return (
    <>
      {isActive ? (
        <>
          <Badge
            variant="outline"
            className={`cursor-pointer ml-2 gap-1 ${currentTipo === "completa" ? "border-green-500 text-green-600 hover:bg-green-50" : "border-orange-500 text-orange-600 hover:bg-orange-50"}`}
            onClick={openDialog}
          >
            <Globe className="h-3 w-3" />
            {currentTipo === "completa" ? "Area Riservata Attiva" : "Area Riservata (Sola Lettura)"}
          </Badge>
          <a href="/cliente" target="_blank" rel="noopener noreferrer" title="Anteprima Portale Cliente">
            <Badge variant="outline" className="cursor-pointer ml-1 gap-1 border-blue-500 text-blue-600 hover:bg-blue-50">
              <ExternalLink className="h-3 w-3" />
              Anteprima Portale
            </Badge>
          </a>
        </>
      ) : (
        <Button size="sm" variant="outline" className="gap-1.5 border-green-500 text-green-600 hover:bg-green-50 h-8 ml-2" disabled={!cliente.email} onClick={openDialog}>
          <Globe className="h-3.5 w-3.5" />
          Attiva Area Riservata
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isActive ? "Gestione" : "Attivazione"} Area Riservata — {clienteName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs">Tipo di Accesso</Label>
              <Select value={tipo} onValueChange={handleTipoChange}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sola_lettura">Solo Visualizzazione (consultazione e messaggi)</SelectItem>
                  <SelectItem value="completa">Attiva (lettura + caricamento documenti)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-2 block">Email di Attivazione (personalizzabile)</Label>
              <Textarea
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                className="min-h-[250px] font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            {isActive && (
              <Button variant="destructive" size="sm" onClick={handleDeactivate} disabled={saving} className="mr-auto">
                Disattiva
              </Button>
            )}
            {isActive && (
              <a href="/cliente" target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="outline" size="sm" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Anteprima Portale
                </Button>
              </a>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleActivate} disabled={saving} className="gap-1.5">
              <Key className="h-3.5 w-3.5" />
              {saving ? "Invio..." : "Invia e Attiva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PolizzeClienteTable({ polizze, navigate, mode }: { polizze: any[]; navigate: (to: string) => void; mode?: "polizze" | "quietanze" }) {
  const catene = useMemo(() => groupTitoliByPolizza(polizze), [polizze]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filtroTipoState, setFiltroTipoState] = useState<"tutti" | "polizze" | "quietanze">("tutti");
  const filtroTipo: "tutti" | "polizze" | "quietanze" = mode ?? filtroTipoState;
  const [filtroNumero, setFiltroNumero] = useState("");
  const [filtroGruppoRamo, setFiltroGruppoRamo] = useState<string>("");
  const [filtroGaranzia, setFiltroGaranzia] = useState<string>("");
  const [filtroAgenzia, setFiltroAgenzia] = useState<string>("");
  const [filtroStato, setFiltroStato] = useState<string>("");
  const toggle = (k: string) => setExpanded((s) => ({ ...s, [k]: !s[k] }));
  const { profile } = useAuth();
  const isAdmin = profile?.ruolo === "admin";
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<string | null>(null);

  // Opzioni filtri (derivate dalle polizze caricate)
  const gruppiRamoOpts = useMemo(() => {
    const s = new Set<string>();
    polizze.forEach((p) => { const v = p.ramo?.gruppo_ramo?.descrizione; if (v) s.add(v); });
    return Array.from(s).sort().map((v) => ({ value: v, label: v }));
  }, [polizze]);
  const garanzieOpts = useMemo(() => {
    const s = new Set<string>();
    polizze.forEach((p) => {
      if (filtroGruppoRamo && p.ramo?.gruppo_ramo?.descrizione !== filtroGruppoRamo) return;
      const v = p.ramo?.descrizione; if (v) s.add(v);
    });
    return Array.from(s).sort().map((v) => ({ value: v, label: v }));
  }, [polizze, filtroGruppoRamo]);
  const agenzieOpts = useMemo(() => {
    const s = new Set<string>();
    polizze.forEach((p) => { const v = p.compagnia_diretta?.nome; if (v) s.add(v); });
    return Array.from(s).sort().map((v) => ({ value: v, label: v }));
  }, [polizze]);
  const statiOpts = useMemo(() => {
    const s = new Set<string>();
    polizze.forEach((p) => { if (p.stato) s.add(p.stato); });
    return Array.from(s).sort().map((v) => ({ value: v, label: v }));
  }, [polizze]);

  // Predicate sul singolo titolo (madre o rata)
  const matchTitolo = (t: any) => {
    if (filtroNumero) {
      const q = filtroNumero.toLowerCase();
      const num = String(t.numero_titolo || "").toLowerCase();
      const targa = String(t.targa_telaio || "").toLowerCase();
      if (!num.includes(q) && !targa.includes(q)) return false;
    }
    if (filtroGruppoRamo && t.ramo?.gruppo_ramo?.descrizione !== filtroGruppoRamo) return false;
    if (filtroGaranzia && t.ramo?.descrizione !== filtroGaranzia) return false;
    if (filtroAgenzia && t.compagnia_diretta?.nome !== filtroAgenzia) return false;
    if (filtroStato && t.stato !== filtroStato) return false;
    return true;
  };

  // Catene filtrate: passano se madre o almeno una rata match
  const filteredCatene = useMemo(
    () => catene.filter((c: any) => {
      const head = c.madre || c.all[0];
      if (head && matchTitolo(head)) return true;
      return c.rate.some((r: any) => matchTitolo(r));
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catene, filtroNumero, filtroGruppoRamo, filtroGaranzia, filtroAgenzia, filtroStato],
  );

  const hasAnyFilter = !!(filtroNumero || filtroGruppoRamo || filtroGaranzia || filtroAgenzia || filtroStato);
  const clearFilters = () => {
    setFiltroNumero(""); setFiltroGruppoRamo(""); setFiltroGaranzia(""); setFiltroAgenzia(""); setFiltroStato("");
  };

  // Conteggi & totali (sui risultati filtrati)
  const filteredTitoli = useMemo(() => {
    const out: any[] = [];
    filteredCatene.forEach((c: any) => {
      const head = c.madre || c.all[0];
      if (head && matchTitolo(head)) out.push(head);
      c.rate.forEach((r: any) => { if (matchTitolo(r)) out.push(r); });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCatene, filtroNumero, filtroGruppoRamo, filtroGaranzia, filtroAgenzia, filtroStato]);

  const allQuiet = useMemo(() => filteredTitoli.filter((p) => !!p.sostituisce_polizza), [filteredTitoli]);
  const allPol = useMemo(() => filteredTitoli.filter((p) => !p.sostituisce_polizza), [filteredTitoli]);
  // La polizza madre è il contratto, non un titolo da incassare: il premio
  // reale è la somma delle sole quietanze (rate). Sommare anche la madre
  // raddoppierebbe il totale (es. annuale 1y: 1 madre + 1 quietanza).
  const totPremio = useMemo(
    () => allQuiet.reduce((s, p) => s + (Number(p.premio_lordo) || 0), 0),
    [allQuiet],
  );
  const totProvv = useMemo(
    () => allQuiet.reduce((s, p) => s + (Number(p.provvigioni_firma) || 0) + (Number(p.provvigioni_quietanza) || 0), 0),
    [allQuiet],
  );

  // Flat quietanze filtrate (vista "Solo quietanze")
  const flatQuietanze = useMemo(() => {
    const out: { rata: any; madreNum: string | null; madreId: string | null; idx: number; totale: number }[] = [];
    filteredCatene.forEach((c: any) => {
      const head = c.madre || c.all[0];
      const madreNum = head?.numero_titolo || null;
      const madreId = head?.id || null;
      const totale = c.rate.length;
      c.rate.forEach((r: any, i: number) => {
        if (matchTitolo(r)) out.push({ rata: r, madreNum, madreId, idx: i + 1, totale });
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCatene, filtroNumero, filtroGruppoRamo, filtroGaranzia, filtroAgenzia, filtroStato]);


  const fmtDate = (d: string | Date | null | undefined) => {
    if (!d) return "—";
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleDateString("it-IT");
  };

  const isLocked = (t: any) =>
    t?.stato === "incassato" || t?.stato === "stornato" || !!t?.data_messa_cassa;

  const deleteIds = async (ids: string[], label: string) => {
    if (ids.length === 0) return;
    setDeleting(ids[0]);
    const { error } = await supabase.from("titoli").delete().in("id", ids);
    setDeleting(null);
    if (error) {
      toast.error(`Errore eliminazione ${label}: ${error.message}`);
      return;
    }
    toast.success(`${label} eliminata`);
    queryClient.invalidateQueries({ queryKey: ["polizze_cliente"] });
  };

  const handleDeleteMadre = async (c: any) => {
    const head = c.madre || c.all[0];
    if (isLocked(head) || c.rate.some((r: any) => isLocked(r))) {
      toast.error("Polizza/quietanza messa a cassa o stornata: non eliminabile");
      return;
    }
    const n = c.rate.length;
    const msg = n > 0
      ? `Eliminare la polizza N. ${head.numero_titolo} e tutte le sue ${n} quietanze?`
      : `Eliminare la polizza N. ${head.numero_titolo}?`;
    if (!window.confirm(msg)) return;
    const ids = [head.id, ...c.rate.map((r: any) => r.id)];
    await deleteIds(ids, "Polizza");
  };

  const handleDeleteRata = async (r: any) => {
    if (isLocked(r)) {
      toast.error("Quietanza messa a cassa o stornata: non eliminabile");
      return;
    }
    if (!window.confirm(`Eliminare la quietanza N. ${r.numero_titolo}?`)) return;
    await deleteIds([r.id], "Quietanza");
  };
  const fmtNum = (n: number | null | undefined) => (n != null ? n.toFixed(2) : "—");
  const stateVariant = (stato: string): "default" | "secondary" | "destructive" | "outline" => {
    if (stato === "incassato") return "default";
    if (stato === "stornato") return "destructive";
    if (stato === "sospeso" || stato === "scaduto") return "outline";
    return "secondary";
  };
  const stateLabel = (ruolo: string, stato: string, n?: number) => {
    const base = ruolo === "madre" ? "Polizza" : `Quietanza ${n ?? ""}`.trim();
    const suffix = stato && stato !== "attivo" ? ` · ${stato}` : "";
    return `${base}${suffix}`;
  };
  return (
    <div className="space-y-3">
      {/* Toolbar: filtro Tipo (solo se non in mode fisso) + mini-KPI */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {mode ? <div /> : (
          <TipoFilterSegmented
            value={filtroTipo}
            onChange={(v) => v !== "regolazioni" && setFiltroTipoState(v)}
            counts={{ tutti: allPol.length + allQuiet.length, polizze: allPol.length, quietanze: allQuiet.length }}
          />
        )}
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{allPol.length}</span> polizze ·{" "}
          <span className="font-medium text-foreground">{allQuiet.length}</span> quietanze · totale premio{" "}
          <span className="font-mono font-medium text-foreground">€ {totPremio.toFixed(2)}</span>
          {" · "}totale provvigioni{" "}
          <span className="font-mono font-medium text-foreground">€ {totProvv.toFixed(2)}</span>
        </div>
      </div>



      {/* Filtri di ricerca */}
      <div className="flex flex-wrap items-end gap-2 p-2 rounded-md border bg-muted/30">
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground uppercase">N. Polizza / Targa</Label>
          <Input value={filtroNumero} onChange={(e) => setFiltroNumero(e.target.value)} placeholder="Cerca numero o targa…" className="h-8 w-[180px]" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground uppercase">Gruppo Ramo</Label>
          <SearchableSelect
            options={gruppiRamoOpts}
            value={filtroGruppoRamo}
            onValueChange={(v) => { setFiltroGruppoRamo(v); setFiltroGaranzia(""); }}
            placeholder="Tutti"
            clearable
            className="h-8 w-[180px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground uppercase">Garanzia</Label>
          <SearchableSelect
            options={garanzieOpts}
            value={filtroGaranzia}
            onValueChange={setFiltroGaranzia}
            placeholder="Tutte"
            clearable
            className="h-8 w-[200px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground uppercase">Agenzia</Label>
          <SearchableSelect
            options={agenzieOpts}
            value={filtroAgenzia}
            onValueChange={setFiltroAgenzia}
            placeholder="Tutte"
            clearable
            className="h-8 w-[180px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground uppercase">Stato</Label>
          <SearchableSelect
            options={statiOpts}
            value={filtroStato}
            onValueChange={setFiltroStato}
            placeholder="Tutti"
            clearable
            className="h-8 w-[140px]"
          />
        </div>
        {hasAnyFilter && (
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={clearFilters}>
            Pulisci filtri
          </Button>
        )}
      </div>


      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>N. Polizza</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Gruppo Ramo</TableHead>
            <TableHead>Garanzia</TableHead>
            <TableHead>Inizio Garanzia</TableHead>
            <TableHead>Fine Garanzia</TableHead>
            <TableHead>Agenzia</TableHead>
            <TableHead>Premio €</TableHead>
            <TableHead>Provvigioni €</TableHead>
            <TableHead>Data Incasso</TableHead>
            {isAdmin && <TableHead className="w-12"></TableHead>}
          </TableRow>

        </TableHeader>
        <TableBody>
          {filtroTipo === "quietanze" ? (
            flatQuietanze.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 12 : 11} className="text-center text-sm text-muted-foreground py-6">
                  Nessuna quietanza presente
                </TableCell>
              </TableRow>
            ) : (
              flatQuietanze.map(({ rata: r, madreNum, madreId, idx, totale }) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer border-l-4 border-l-quietanza bg-quietanza-soft/40 hover:bg-quietanza-soft/80 hover:ring-1 hover:ring-inset hover:ring-quietanza/40 transition-colors"
                  onClick={() => navigate(`/titoli/${r.id}`)}
                  title="Apri quietanza"
                >
                  <TableCell></TableCell>
                  <TableCell className="font-mono text-xs">{r.numero_titolo || "—"}</TableCell>
                  <TableCell><TipoPolizzaBadge tipo="quietanza" numero={idx} totale={totale} /></TableCell>
                  <TableCell>{r.ramo?.gruppo_ramo?.descrizione || "—"}</TableCell>
                  <TableCell>{r.ramo?.descrizione || "—"}</TableCell>
                  <TableCell className="text-xs">{r.garanzia_da ? new Date(r.garanzia_da).toLocaleDateString("it-IT") : "—"}</TableCell>
                  <TableCell className="text-xs">{r.garanzia_a ? new Date(r.garanzia_a).toLocaleDateString("it-IT") : "—"}</TableCell>
                  <TableCell>{r.compagnia_diretta?.nome || "—"}</TableCell>
                  <TableCell className="font-mono">{fmtNum(r.premio_lordo)}</TableCell>
                  <TableCell className="font-mono">{fmtNum((Number(r.provvigioni_firma)||0) + (Number(r.provvigioni_quietanza)||0))}</TableCell>
                  <TableCell>{r.data_messa_cassa || r.data_incasso || "—"}</TableCell>
                  {isAdmin && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={deleting === r.id || isLocked(r)}
                        title={isLocked(r) ? "Quietanza bloccata (messa a cassa/stornata)" : "Elimina quietanza"}
                        onClick={() => handleDeleteRata(r)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )
          ) : filteredCatene.length === 0 ? (
            <TableRow>
              <TableCell colSpan={isAdmin ? 12 : 11} className="text-center text-sm text-muted-foreground py-6">
                {filtroTipo === "polizze" ? "Nessuna polizza presente" : "Nessun risultato per i filtri selezionati"}
              </TableCell>
            </TableRow>
          ) : (
            filteredCatene.map((c) => {
              const head = c.madre || c.all[0];
              const hasRate = c.rate.length > 0;
              const showRate = filtroTipo === "tutti" && hasRate;
              const isOpen = !!expanded[c.numero];
              const gruppoRamo = head.ramo?.gruppo_ramo?.descrizione || "—";
              const ramo = head.ramo?.descrizione || "—";
              const totale = c.rate.length;

              const agenzia = head.compagnia_diretta?.nome || "—";
              return (
                <>
                  <TableRow
                    key={c.numero}
                    className="cursor-pointer border-l-4 border-l-polizza hover:bg-polizza/5 hover:ring-1 hover:ring-inset hover:ring-polizza/30 transition-colors"
                    onClick={() => navigate(`/titoli/${head.id}`)}
                    title="Apri polizza madre"
                  >
                    <TableCell onClick={(e) => { e.stopPropagation(); if (showRate) toggle(c.numero); }}>
                      {showRate ? (isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : null}
                    </TableCell>
                    <TableCell className="font-medium">{head.numero_titolo || "—"}</TableCell>
                    <TableCell><TipoPolizzaBadge tipo="polizza" /></TableCell>
                    <TableCell>{gruppoRamo}</TableCell>
                    <TableCell>{ramo}</TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell>{agenzia}</TableCell>
                    <TableCell className="font-mono">{fmtNum(head.premio_lordo)}</TableCell>
                    <TableCell className="font-mono">{fmtNum((Number(head.provvigioni_firma)||0) + (Number(head.provvigioni_quietanza)||0))}</TableCell>
                    <TableCell>{head.data_messa_cassa || head.data_incasso || "—"}</TableCell>
                    {isAdmin && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={deleting === head.id || isLocked(head)}
                          title={isLocked(head) ? "Polizza bloccata (messa a cassa/stornata)" : "Elimina polizza e quietanze"}
                          onClick={() => handleDeleteMadre(c)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                  {showRate && isOpen && c.rate.map((r, i) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer border-l-4 border-l-quietanza bg-quietanza-soft/30 hover:bg-quietanza-soft/70 hover:ring-1 hover:ring-inset hover:ring-quietanza/40 transition-colors"
                      onClick={() => navigate(`/titoli/${r.id}`)}
                      title="Apri quietanza"
                    >
                      <TableCell></TableCell>
                      <TableCell className="pl-8 font-mono text-xs text-muted-foreground">
                        <span className="text-quietanza/70 mr-1">└</span>
                        {r.numero_titolo || "—"}
                      </TableCell>
                      <TableCell><TipoPolizzaBadge tipo="quietanza" numero={i + 1} totale={totale} /></TableCell>
                      <TableCell className="text-muted-foreground text-xs">{r.ramo?.gruppo_ramo?.descrizione || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{r.ramo?.descrizione || "—"}</TableCell>
                      <TableCell className="text-xs">{r.garanzia_da ? new Date(r.garanzia_da).toLocaleDateString("it-IT") : "—"}</TableCell>
                      <TableCell className="text-xs">{r.garanzia_a ? new Date(r.garanzia_a).toLocaleDateString("it-IT") : "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{r.compagnia_diretta?.nome || "—"}</TableCell>
                      <TableCell className="font-mono">{fmtNum(r.premio_lordo)}</TableCell>
                      <TableCell className="font-mono">{fmtNum((Number(r.provvigioni_firma)||0) + (Number(r.provvigioni_quietanza)||0))}</TableCell>
                      <TableCell>{r.data_messa_cassa || r.data_incasso || "—"}</TableCell>
                      {isAdmin && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={deleting === r.id || isLocked(r)}
                            title={isLocked(r) ? "Quietanza bloccata (messa a cassa/stornata)" : "Elimina quietanza"}
                            onClick={() => handleDeleteRata(r)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}


export default function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const VALID_TABS = ["polizze", "anagrafica", "sinistri", "relazioni", "documenti", "chat", "timeline", "trattative"] as const;
  const [activeTab, handleTabChange] = useTabParam(VALID_TABS, "polizze");
  const queryClient = useQueryClient();
  const [relazioneOpen, setRelazioneOpen] = useState(false);
  const [searchCliente, setSearchCliente] = useState("");
  const [selectedCollegatoId, setSelectedCollegatoId] = useState("");
  const [tipoRelazione, setTipoRelazione] = useState("referente");
  const [noteRelazione, setNoteRelazione] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { profile: currentProfile } = useAuth();
  const isAdmin = currentProfile?.ruolo === "admin";

  const { data: cliente } = useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clienti")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: gruppiFinanziari = [] } = useQuery({
    queryKey: ["gruppi_finanziari"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gruppi_finanziari")
        .select("id, codice, nome, descrizione, tipo_soggetto")
        .eq("attivo", true)
        .order("codice");
      return data || [];
    },
  });

  const { data: ufficiList = [] } = useQuery({
    queryKey: ["uffici_lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("uffici")
        .select("id, nome_ufficio, codice_ufficio, attivo")
        .order("nome_ufficio");
      return data || [];
    },
  });

  // Specialist (backoffice) corrente per il cliente — usato solo per validazione
  const { data: specialistRow } = useQuery({
    queryKey: ["specialist_cliente", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase.from("codici_commerciali_cliente")
        .select("profilo_id")
        .eq("cliente_id", id)
        .eq("ruolo", "Backoffice")
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const specialistAssigned = !!specialistRow?.profilo_id;

  // Profili backoffice per il select Specialist nella card "Assegnazioni Gestionali"
  const { data: profiliBackoffice = [] } = useQuery({
    queryKey: ["profili_commerciali"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, cognome, ruolo, attivo")
        .in("ruolo", ["produttore", "ufficio", "backoffice", "admin"])
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
  });

  const upsertSpecialistMutation = useMutation({
    mutationFn: async (profilo_id: string | null) => {
      if (!id) return;
      if (!profilo_id) {
        const { error } = await supabase.from("codici_commerciali_cliente")
          .delete()
          .eq("cliente_id", id)
          .eq("ruolo", "Backoffice");
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("codici_commerciali_cliente")
        .upsert(
          { cliente_id: id, ruolo: "Backoffice", profilo_id },
          { onConflict: "cliente_id,ruolo" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specialist_cliente", id] });
      queryClient.invalidateQueries({ queryKey: ["codici_commerciali", id] });
      toast.success("Specialist aggiornato");
    },
    onError: (err: any) => toast.error(err.message || "Errore aggiornamento Specialist"),
  });

  // AE + Produttore correnti per il cliente (gestiti nella card "Assegnazioni Gestionali")
  const { data: codiciCommerciali = [] } = useQuery({
    queryKey: ["codici_commerciali", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase.from("codici_commerciali_cliente")
        .select("ruolo, anagrafica_id")
        .eq("cliente_id", id)
        .in("ruolo", ["AE", "Produttore Sede"]);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: anagraficheAEProd = [] } = useQuery({
    queryKey: ["anagrafiche-ae-produttore"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, tipo, nome, cognome, ragione_sociale, sigla, codice")
        .in("tipo", ["account_executive", "corrispondente"])
        .eq("attivo", true);
      return data || [];
    },
  });

  const upsertCodiceCommercialeMutation = useMutation({
    mutationFn: async ({ ruolo, anagrafica_id }: { ruolo: string; anagrafica_id: string | null }) => {
      if (!id) return;
      if (!anagrafica_id) {
        const { error } = await supabase.from("codici_commerciali_cliente")
          .delete()
          .eq("cliente_id", id)
          .eq("ruolo", ruolo);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("codici_commerciali_cliente")
        .upsert(
          { cliente_id: id, ruolo, anagrafica_id, profilo_id: null },
          { onConflict: "cliente_id,ruolo" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["codici_commerciali", id] });
      toast.success("Assegnazione salvata");
    },
    onError: (err: any) => toast.error(err.message || "Errore salvataggio"),
  });

  const aeAnagraficaId =
    codiciCommerciali.find((c) => c.ruolo === "AE")?.anagrafica_id || "";
  const produttoreAnagraficaId =
    codiciCommerciali.find((c) => c.ruolo === "Produttore Sede")?.anagrafica_id || "";

  const buildAnagraficaLabel = (a: any) => {
    const person = `${a.cognome || ""} ${a.nome || ""}`.trim();
    return (
      person ||
      (a.ragione_sociale && a.ragione_sociale.trim()) ||
      a.sigla ||
      a.codice ||
      "—"
    );
  };

  // aeOptions definito dopo `editFields` (lista AE globale)

  const produttoreOptions = anagraficheAEProd
    .filter((a) => a.tipo === "corrispondente")
    .map((a) => ({ value: a.id, label: buildAnagraficaLabel(a) }))
    .sort((a, b) => a.label.localeCompare(b.label, "it"));




  const [editFields, setEditFields] = useState<Record<string, any>>({});
  // Tracks the last CF auto-filled, used only to avoid spamming the toast.
  // Must be declared before any early return to keep hook order stable.
  const lastAutoFilledCFRef = useRef<string | null>(null);

  useEffect(() => {
    if (!cliente) return;
    const next: any = { ...cliente };
    // Auto-allinea tipo_cliente al tipo_soggetto del Gruppo Finanziario (anche per record legacy)
    const gf = gruppiFinanziari.find((g) => g.id === cliente.gruppo_finanziario_id);
    const ts = gf?.tipo_soggetto;
    if (ts && ["privato", "azienda", "ente"].includes(ts) && next.tipo_cliente !== ts) {
      next.tipo_cliente = ts;
    }
    setEditFields(next);
  }, [cliente, gruppiFinanziari]);

  const updateField = (field: string, value: any) => {
    setEditFields((prev) => {
      const next = { ...prev, [field]: value };
      // Deriva tipo_cliente automaticamente dal tipo_soggetto del gruppo finanziario
      if (field === "gruppo_finanziario_id") {
        const gf = gruppiFinanziari.find((g) => g.id === value);
        const ts = gf?.tipo_soggetto;
        if (ts && ["privato", "azienda", "ente"].includes(ts) && next.tipo_cliente !== ts) {
          next.tipo_cliente = ts;
        }
      }
      return next;
    });
  };

  const saveDetailsMutation = useMutation({
    mutationFn: async (missing: { field: string; label: string }[]) => {
      if (missing.length > 0) {
        throw new Error("Campi obbligatori mancanti: " + missing.map((m) => m.label).join(", "));
      }
      assertFiscalValid(
        isPrivato
          ? [{ label: "Codice Fiscale", value: editFields.codice_fiscale, kind: "cf16" }]
          : [
              { label: "Partita IVA", value: editFields.partita_iva, kind: "piva" },
              { label: "Codice Fiscale Azienda", value: editFields.codice_fiscale_azienda, kind: "cf-azienda" },
            ]
      );
      const {
        id: _id, created_at, updated_at, user_id, ...rest
      } = editFields;
      const { error } = await supabase.from("clienti").update(rest).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", id] });
      toast.success("Dati aggiornati");
      setEditMode(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const { data: polizze = [], isLoading: polizzeLoading } = useQuery({
    queryKey: ["polizze_cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("id, numero_titolo, stato, premio_lordo, provvigioni_firma, provvigioni_quietanza, targa_telaio, data_incasso, data_messa_cassa, sostituisce_polizza, garanzia_da, garanzia_a, created_at, ramo:rami!titoli_ramo_id_fkey(id, descrizione, gruppo_ramo:gruppi_ramo!rami_gruppo_ramo_id_fkey(id, descrizione)), compagnia_diretta:compagnie!titoli_compagnia_id_fkey(id, nome)")
        .eq("cliente_anagrafica_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // IDs delle entità collegate al cliente per aggregazione log attività
  const { data: relatedIds } = useQuery({
    queryKey: ["cliente_related_ids", id],
    queryFn: async () => {
      const [{ data: sin }, { data: tra }] = await Promise.all([
        supabase.from("sinistri").select("id, stato").eq("cliente_anagrafica_id", id!),
        supabase.from("trattative").select("id").eq("cliente_id", id!),
      ]);
      return {
        sinistri: (sin || []).map((s: any) => s.id),
        sinistriAperti: (sin || []).filter((s: any) => !["chiuso", "respinto"].includes(s.stato)).length,
        trattative: (tra || []).map((t: any) => t.id),
      };
    },
    enabled: !!id,
  });

  // Realtime: badge "Sinistri" aggiornato in tempo reale anche se il tab non è montato
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`cliente-sinistri-rt-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sinistri", filter: `cliente_anagrafica_id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: ["cliente_related_ids", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, queryClient]);

  const { data: relazioni = [] } = useQuery({
    queryKey: ["relazioni_cliente", id],
    queryFn: async () => {
      const { data: rel1 } = await supabase
        .from("clienti_relazioni")
        .select("id, tipo_relazione, note, cliente_collegato_id, clienti_collegato:clienti!clienti_relazioni_cliente_collegato_id_fkey(id, tipo_cliente, nome, cognome, ragione_sociale)")
        .eq("cliente_id", id!);
      const { data: rel2 } = await supabase
        .from("clienti_relazioni")
        .select("id, tipo_relazione, note, cliente_id, clienti_origine:clienti!clienti_relazioni_cliente_id_fkey(id, tipo_cliente, nome, cognome, ragione_sociale)")
        .eq("cliente_collegato_id", id!);
      const result: any[] = [];
      (rel1 || []).forEach((r: any) => {
        result.push({ id: r.id, tipo_relazione: r.tipo_relazione, note: r.note, collegato: r.clienti_collegato });
      });
      (rel2 || []).forEach((r: any) => {
        result.push({ id: r.id, tipo_relazione: r.tipo_relazione, note: r.note, collegato: r.clienti_origine });
      });
      return result;
    },
    enabled: !!id,
  });

  const { data: clientiSearch = [] } = useQuery({
    queryKey: ["clienti_search_rel", searchCliente],
    queryFn: async () => {
      if (searchCliente.length < 2) return [];
      const { data } = await supabase
        .from("clienti")
        .select("id, tipo_cliente, nome, cognome, ragione_sociale, codice_fiscale")
        .neq("id", id!)
        .or(`cognome.ilike.%${searchCliente}%,nome.ilike.%${searchCliente}%,ragione_sociale.ilike.%${searchCliente}%,codice_fiscale.ilike.%${searchCliente}%`)
        .limit(10);
      return data || [];
    },
    enabled: searchCliente.length >= 2,
  });

  const addRelazioneMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clienti_relazioni").insert({
        cliente_id: id!,
        cliente_collegato_id: selectedCollegatoId,
        tipo_relazione: tipoRelazione,
        note: noteRelazione || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relazioni_cliente", id] });
      setRelazioneOpen(false);
      setSearchCliente("");
      setSelectedCollegatoId("");
      setNoteRelazione("");
      toast.success("Relazione aggiunta");
    },
    onError: (err: any) => toast.error("Errore: " + err.message),
  });

  const handleScanUpload = async (file: File, documentType: DocumentType) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const path = `cliente/${id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("documenti_clienti").upload(path, file);
      if (uploadErr) throw uploadErr;
      await supabase.from("documenti").insert({
        nome_file: file.name, path_storage: path, bucket_name: "documenti_clienti",
        entita_tipo: "cliente", entita_id: id!, caricato_da: user?.id, categoria: documentType,
      });
      toast.success("Documento scansionato e salvato");
    } catch (err: any) {
      toast.error("Errore salvataggio documento: " + err.message);
    }
  };

  const provisionMutation = useMutation({
    mutationFn: async (clienteId: string) => {
      const { data, error } = await supabase.functions.invoke("create-cliente-user", { body: { cliente_id: clienteId } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", id] });
      toast.success("Account cliente creato automaticamente");
    },
    onError: (err: any) => console.error("Provisioning error:", err.message),
  });

  // Auto-provisioning removed — activation is now manual via "Area Riservata" card

  // AE: lista globale, indipendente dalla Sede del cliente
  // NOTA: deve stare PRIMA di qualsiasi early return per rispettare le regole hooks
  const { data: aeLookupData } = useAccountExecutivesLookup();
  const aeOptions = aeLookupData?.options ?? [];

  if (!cliente) return null;

  // Tipo cliente EFFETTIVO derivato live dal Gruppo Finanziario (governa l'intero layout anagrafica)
  const _gfSelected = gruppiFinanziari.find((g) => g.id === editFields.gruppo_finanziario_id);
  const effectiveTipoCliente: "privato" | "azienda" | "ente" =
    (_gfSelected?.tipo_soggetto || editFields.tipo_cliente || cliente.tipo_cliente || "privato");
  const tipoIsAuto = !!_gfSelected?.tipo_soggetto;

  const isPrivato = effectiveTipoCliente === "privato";
  const isAzienda = effectiveTipoCliente === "azienda";

  const displayName = isPrivato
    ? `${cliente.cognome || ""} ${cliente.nome || ""}`.trim() || cliente.ragione_sociale || "—"
    : cliente.ragione_sociale || `${cliente.cognome || ""} ${cliente.nome || ""}`.trim() || "—";

  const getClienteDisplayName = (c: any) => {
    if (!c) return "—";
    return c.tipo_cliente === "privato"
      ? `${c.cognome || ""} ${c.nome || ""}`.trim() || "—"
      : c.ragione_sociale || "—";
  };

  const ef = editFields;

  const readOnly = !editMode;


  // Tracks the last CF auto-filled (declared above before early return)


  const handleCFAutoFill = (cf: string) => {
    if (cf.length !== 16) return;
    const parsed = parseCF(cf);
    if (!parsed) return;
    const info = lookupComune(parsed.codiceCatastale);
    const expectedLuogo = info ? `${info.comune} (${info.provincia})` : "";

    // Force overwrite — CF is authoritative
    updateField("sesso", parsed.sesso);
    updateField("data_nascita", parsed.dataNascita);
    if (info) {
      updateField("comune_nascita", info.comune);
      updateField("provincia_nascita", info.provincia);
      updateField("luogo_nascita", expectedLuogo);
    }

    if (lastAutoFilledCFRef.current !== cf) {
      toast.info("Dati allineati al Codice Fiscale");
    }
    lastAutoFilledCFRef.current = cf;
  };

  // NB: l'auto-CF è già triggerato dall'onChange dell'Input (vedi FieldInput)
  // quando il valore raggiunge 16 caratteri. Niente useEffect qui per evitare
  // di aggiungere hook dopo l'early return su `cliente`.

  // Coerenza CF (solo privati)
  const cfParsed = isPrivato && ef.codice_fiscale && ef.codice_fiscale.length === 16
    ? parseCF(ef.codice_fiscale)
    : null;
  const cfComune = cfParsed ? lookupComune(cfParsed.codiceCatastale) : null;

  const dataNascitaWarning = (() => {
    if (!cfParsed || !ef.data_nascita) return null;
    if (ef.data_nascita !== cfParsed.dataNascita) {
      const [y, m, d] = cfParsed.dataNascita.split("-");
      return `Data non coerente con il CF (atteso: ${d}/${m}/${y})`;
    }
    return null;
  })();

  const luogoNascitaWarning = (() => {
    if (!cfComune || !ef.luogo_nascita) return null;
    const luogoUpper = String(ef.luogo_nascita).toUpperCase();
    const expectedUpper = cfComune.comune.toUpperCase();
    if (!luogoUpper.includes(expectedUpper) && !expectedUpper.includes(luogoUpper)) {
      return `Luogo non coerente con il CF (atteso: ${cfComune.comune})`;
    }
    return null;
  })();

  // Validazione campi obbligatori
  // Validazione P.IVA/CF con checksum (lib/validatePIVA, lib/validateCF)
  const isCFValid = (cf: string) => validateCFLib(cf, { allowPIVAFormat: false }).valid;
  const isPIVAValid = (p: string) => validatePIVALib(p).valid;
  const isCFAziendaValid = (cf: string) => validateCFLib(cf, { allowPIVAFormat: true }).valid;

  const isEmailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || "").trim());
  const emailOk = isEmailValid(ef.email || "");

  const isEnte = effectiveTipoCliente === "ente";

  const requiredFieldsList: { field: string; label: string; ok: boolean }[] = isPrivato
    ? [
        { field: "ufficio_id", label: "Sede", ok: !!ef.ufficio_id },
        { field: "nome", label: "Nome", ok: !!(ef.nome || "").trim() },
        { field: "cognome", label: "Cognome", ok: !!(ef.cognome || "").trim() },
        { field: "codice_fiscale", label: "Codice Fiscale", ok: isCFValid(ef.codice_fiscale || "") },
        { field: "indirizzo_residenza", label: "Indirizzo Residenza", ok: !!(ef.indirizzo_residenza || "").trim() },
        { field: "email", label: "Email", ok: emailOk },
      ]
    : [
        { field: "ufficio_id", label: "Sede", ok: !!ef.ufficio_id },
        { field: "ragione_sociale", label: "Ragione Sociale", ok: !!(ef.ragione_sociale || "").trim() },
        { field: "gruppo_finanziario_id", label: "Gruppo Finanziario", ok: !!ef.gruppo_finanziario_id },
        { field: "specialist_id", label: "Specialist", ok: specialistAssigned },
        { field: "email", label: "Email", ok: emailOk },
        {
          field: "partita_iva",
          label: "Partita IVA o Codice Fiscale",
          ok: isPIVAValid(ef.partita_iva || "") || isCFAziendaValid(ef.codice_fiscale_azienda || ""),
        },
        { field: "forma_giuridica", label: "Forma Giuridica", ok: !!(ef.forma_giuridica || "").trim() },
        { field: "indirizzo_sede", label: "Indirizzo Sede", ok: !!(ef.indirizzo_sede || "").trim() },
        // Codice CIG non è più obbligatorio in anagrafica: si gestisce sulla singola polizza/quietanza.
      ];

  const missingRequired = requiredFieldsList.filter((r) => !r.ok);
  const requiredFieldNames = new Set(requiredFieldsList.map((r) => r.field));
  const missingFieldNames = new Set(missingRequired.map((r) => r.field));

  const isFieldRequired = (field: string) => requiredFieldNames.has(field);
  const isFieldMissing = (field: string) => missingFieldNames.has(field);
  // Per il campo P.IVA/CF azienda, se manca uno mancano entrambi visivamente
  const isAziendaIdMissing = !isPrivato && missingFieldNames.has("partita_iva");

  const anagraficaCtxValue: AnagraficaFormCtxType = {
    ef,
    readOnly,
    updateField,
    isFieldRequired,
    isFieldMissing,
    isAziendaIdMissing,
    handleCFAutoFill,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/archivi/clienti")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <p className="text-muted-foreground flex items-center gap-1.5 flex-wrap">
            {isPrivato ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
            {isPrivato ? "Cliente Privato" : isAzienda ? "Cliente Azienda" : "Cliente Ente"}
            {tipoIsAuto ? (
              <span className="text-[10px] text-muted-foreground ml-1">(auto da Gruppo Finanziario)</span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 ml-1"
                title="Nessun Gruppo Finanziario assegnato: tipologia derivata dal valore storico. Assegna un Gruppo Finanziario per allineare automaticamente i campi anagrafici."
              >
                <AlertTriangle className="h-3 w-3" />
                Tipologia da valore storico — assegna un Gruppo Finanziario
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-card">
          <Switch
            checked={cliente.attivo ?? true}
            onCheckedChange={async (v) => {
              const { error } = await supabase.from("clienti").update({ attivo: v }).eq("id", cliente.id);
              if (error) { toast.error("Errore: " + error.message); return; }
              toast.success(v ? "Cliente attivato" : "Cliente disattivato");
              try {
                await logAttivita({
                  entita_tipo: "cliente",
                  entita_id: cliente.id,
                  azione: v ? "cliente_attivato" : "cliente_disattivato",
                });
              } catch {}
              queryClient.invalidateQueries({ queryKey: ["cliente", id] });
              queryClient.invalidateQueries({ queryKey: ["clienti"] });
            }}
          />
          <Label className="text-xs cursor-pointer select-none">
            {cliente.attivo ? "Attivo" : "Disattivo"}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <NuovaPolizzaButton clienteId={id} size="sm" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/portafoglio/doc-precontrattuale?clienteId=${id}`)}
          >
            <FileText className="w-4 h-4 mr-1" /> Genera Precontrattuale
          </Button>
          {editMode ? (
            <>
              {missingRequired.length > 0 && (
                <span className="text-xs text-destructive">Compila i campi obbligatori ({missingRequired.length})</span>
              )}
              <Button variant="outline" size="sm" onClick={() => { setEditFields({ ...cliente }); setEditMode(false); }}>Annulla</Button>
              <Button
                size="sm"
                onClick={() => saveDetailsMutation.mutate(missingRequired)}
                disabled={saveDetailsMutation.isPending || missingRequired.length > 0}
              >
                Salva
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>Modifica</Button>
              {isAdmin && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                  title="Elimina cliente (lo storico polizze/sinistri/documenti viene preservato)"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Elimina
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs - positioned right after header */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>

        <div className="flex items-center flex-wrap gap-1">
          <TabsList className="flex-wrap">
            {(() => {
              // Conteggio basato sul numero polizza: ogni numero_titolo distinto = 1 polizza,
              // le rate ulteriori sono quietanze. Robusto anche quando sostituisce_polizza è NULL
              // (titoli legacy o generati dal trigger di auto-quietanza).
              const numeriUnici = new Set(
                polizze.map((p: any) => p.numero_titolo).filter(Boolean)
              );
              const nPol = numeriUnici.size;
              const nQuiet = Math.max(0, polizze.length - nPol);
              return (
                <TabsTrigger value="polizze"><FileText className="w-4 h-4 mr-1" />Polizze ({nPol}) · Quietanze ({nQuiet})</TabsTrigger>
              );
            })()}
            <TabsTrigger value="anagrafica"><User className="w-4 h-4 mr-1" />Anagrafica</TabsTrigger>
            <TabsTrigger value="sinistri">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Sinistri
              {(relatedIds?.sinistriAperti ?? 0) > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-orange-500 text-white text-xs font-semibold">
                  {relatedIds!.sinistriAperti}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="relazioni"><Link2 className="w-4 h-4 mr-1" />{isPrivato ? "Aziende" : "Persone"} ({relazioni.length})</TabsTrigger>
            <TabsTrigger value="documenti">Documenti</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="timeline">Log Attività</TabsTrigger>
            <TabsTrigger value="trattative"><FileText className="w-4 h-4 mr-1" />Trattative</TabsTrigger>
          </TabsList>
          <AnticipiChip clienteId={id!} />
          <AreaRiservataHeaderButton cliente={cliente} onUpdate={() => queryClient.invalidateQueries({ queryKey: ["cliente", id] })} />
        </div>


        <TabsContent value="polizze">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Polizze del cliente</CardTitle>
              <NuovaPolizzaButton clienteId={id} size="sm" />
            </CardHeader>
            <CardContent className="pt-2">
              {polizzeLoading ? (
                <div className="space-y-2 py-6">
                  <div className="h-9 w-full animate-pulse rounded-md bg-muted/60" />
                  <div className="h-9 w-full animate-pulse rounded-md bg-muted/40" />
                  <div className="h-9 w-full animate-pulse rounded-md bg-muted/30" />
                  <p className="text-center text-xs text-muted-foreground pt-2">Caricamento polizze e quietanze…</p>
                </div>
              ) : polizze.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-12 border-2 border-dashed border-border rounded-lg bg-muted/20">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="w-7 h-7 text-primary" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-semibold text-foreground">Nessuna polizza collegata</p>
                    <p className="text-sm text-muted-foreground">Crea la prima polizza per questo cliente</p>
                  </div>
                  <NuovaPolizzaButton clienteId={id} label="Nuova Polizza" />
                </div>
              ) : (
                <PolizzeClienteTable polizze={polizze} navigate={navigate} />
              )}
            </CardContent>
          </Card>
        </TabsContent>




          <TabsContent value="sinistri">
            <div className="flex items-center justify-between mb-2">
              <Button size="sm" onClick={() => navigate(`/sinistri/apertura?cliente_id=${id}`)}>
                <Plus className="w-3 h-3 mr-1" />Apri Sinistro
              </Button>
            </div>
            <SinistriClienteTab clienteId={id!} />
          </TabsContent>

        <TabsContent value="relazioni">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">{isPrivato ? "Aziende Collegate" : "Persone Collegate"}</CardTitle>
              <Button size="sm" onClick={() => setRelazioneOpen(true)}><Plus className="w-4 h-4 mr-1" />Aggiungi</Button>
            </CardHeader>
            <CardContent>
              {relazioni.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nessuna relazione presente</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Relazione</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relazioni.map((r: any) => (
                      <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/archivi/clienti/${r.collegato?.id}`)}>
                        <TableCell className="font-medium">{getClienteDisplayName(r.collegato)}</TableCell>
                        <TableCell><Badge variant="outline">{r.collegato?.tipo_cliente === "privato" ? "Privato" : "Azienda"}</Badge></TableCell>
                        <TableCell><Badge variant="secondary">{tipiRelazione.find(t => t.value === r.tipo_relazione)?.label || r.tipo_relazione}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{r.note || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documenti" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Scansione AI Documenti</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const entityContext = cliente
                    ? {
                        entityType: "cliente" as const,
                        scopeHint: buildClienteScopeHint(cliente),
                        expectedCF: cliente.codice_fiscale ?? null,
                        expectedPIVA: cliente.partita_iva ?? null,
                      }
                    : undefined;
                  return isPrivato ? (
                    <>
                      <AiDocumentScanner documentType="carta_identita" entityContext={entityContext} onFileReady={handleScanUpload} onExtracted={() => {}} label="Scansiona Carta d'Identità" />
                      <AiDocumentScanner documentType="tessera_sanitaria" entityContext={entityContext} onFileReady={handleScanUpload} onExtracted={() => {}} label="Scansiona Tessera Sanitaria" />
                    </>
                  ) : (
                    <AiDocumentScanner documentType="visura_camerale" entityContext={entityContext} onFileReady={handleScanUpload} onExtracted={() => {}} label="Scansiona Visura Camerale" />
                  );
                })()}
                <AnalizzaPolizzaCgaDialog clienteId={id!} />
              </div>
            </CardContent>
          </Card>
          <PolizzeCgaSection clienteId={id!} />
          <DocumentiTab entitaTipo="cliente" entitaId={id!} bucketName="documenti_clienti" />
        </TabsContent>

        <TabsContent value="chat"><ChatTab entitaTipo="cliente" entitaId={id!} /></TabsContent>
        <TabsContent value="timeline">
          <TimelineTab
            entitaTipo="cliente"
            entitaId={id!}
            extraEntities={[
              { tipo: "titolo", ids: polizze.map((p) => p.id) },
              { tipo: "sinistro", ids: relatedIds?.sinistri || [] },
              { tipo: "trattativa", ids: relatedIds?.trattative || [] },
            ]}
          />
        </TabsContent>

        <TabsContent value="trattative">
          <TrattativeClienteSection clienteId={id!} />
        </TabsContent>

        <TabsContent value="anagrafica" className="space-y-6">
          <AnagraficaFormCtx.Provider value={anagraficaCtxValue}>
          {/* Assegnazioni Gestionali */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                Assegnazioni Gestionali
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Sede */}
                <div>
                  <Label className="text-xs">
                    Sede{!readOnly && <RequiredMark />}
                  </Label>
                  {readOnly ? (
                    <p className="text-sm mt-1">
                      {ufficiList.find((u: any) => u.id === ef.ufficio_id)?.nome_ufficio || "—"}
                    </p>
                  ) : (
                    <>
                      <SearchableSelect
                        className={`h-8 text-xs ${isFieldMissing("ufficio_id") ? "border-destructive ring-1 ring-destructive" : ""}`}
                        value={String(ef.ufficio_id ?? "")}
                        onValueChange={(v) => updateField("ufficio_id", v || null)}
                        placeholder="— Seleziona sede —"
                        options={ufficiList.map((u: any) => ({ value: u.id, label: u.nome_ufficio }))}
                      />
                      {isFieldMissing("ufficio_id") && (
                        <p className="text-[11px] text-destructive mt-1">Campo obbligatorio</p>
                      )}
                    </>
                  )}
                </div>

                {/* Gruppo Finanziario */}
                <div>
                  <Label className="text-xs">
                    Gruppo Finanziario{!readOnly && <RequiredMark />}
                  </Label>
                  {readOnly ? (
                    <p className="text-sm mt-1">
                      {gruppiFinanziari.find((g: any) => g.id === ef.gruppo_finanziario_id)?.nome || "—"}
                    </p>
                  ) : (
                    <>
                      <SearchableSelect
                        className={`h-8 text-xs ${isFieldMissing("gruppo_finanziario_id") ? "border-destructive ring-1 ring-destructive" : ""}`}
                        value={ef.gruppo_finanziario_id || ""}
                        onValueChange={(v) => updateField("gruppo_finanziario_id", v || null)}
                        placeholder="— Seleziona gruppo —"
                        options={gruppiFinanziari.map((g: any) => ({ value: g.id, label: `${g.codice} - ${g.nome}` }))}
                      />
                      {isFieldMissing("gruppo_finanziario_id") && (
                        <p className="text-[11px] text-destructive mt-1">Campo obbligatorio</p>
                      )}
                    </>
                  )}
                </div>

                {/* Specialist (Backoffice) */}
                <div>
                  <Label className="text-xs">
                    Specialist{!readOnly && <RequiredMark />}
                  </Label>
                  {readOnly ? (
                    <p className="text-sm mt-1">
                      {(() => {
                        const p = profiliBackoffice.find((x: any) => x.id === specialistRow?.profilo_id);
                        return p ? `${p.cognome ?? ""} ${p.nome ?? ""}`.trim() || "—" : "—";
                      })()}
                    </p>
                  ) : (
                    <>
                      <SearchableSelect
                        className={`h-8 text-xs ${!specialistAssigned ? "border-destructive ring-1 ring-destructive" : ""}`}
                        value={specialistRow?.profilo_id || ""}
                        onValueChange={(v) => upsertSpecialistMutation.mutate(v || null)}
                        placeholder="— Seleziona specialist —"
                        options={profiliBackoffice
                          .filter((p: any) => p.ruolo === "backoffice" || p.ruolo === "admin")
                          .map((p: any) => ({
                            value: p.id,
                            label: `${p.cognome ?? ""} ${p.nome ?? ""}`.trim() || "—",
                          }))}
                      />
                      {!specialistAssigned && (
                        <p className="text-[11px] text-destructive mt-1">Campo obbligatorio</p>
                      )}
                    </>
                  )}
                </div>

                {/* Account Executive */}
                <div>
                  <Label className="text-xs">Account Executive</Label>
                  {readOnly ? (
                    <p className="text-sm mt-1">
                      {aeOptions.find((o) => o.value === aeAnagraficaId)?.label || "—"}
                    </p>
                  ) : (
                    <SearchableSelect
                      className="h-8 text-xs"
                      value={aeAnagraficaId}
                      onValueChange={(v) =>
                        upsertCodiceCommercialeMutation.mutate({ ruolo: "AE", anagrafica_id: v || null })
                      }
                      placeholder="— Nessuno —"
                      clearable
                      clearLabel="— Nessuno —"
                      options={aeOptions}
                    />
                  )}
                </div>


                {/* Produttore */}
                <div>
                  <Label className="text-xs">Produttore</Label>
                  {readOnly ? (
                    <p className="text-sm mt-1">
                      {produttoreOptions.find((o) => o.value === produttoreAnagraficaId)?.label || "—"}
                    </p>
                  ) : (
                    <SearchableSelect
                      className="h-8 text-xs"
                      value={produttoreAnagraficaId}
                      onValueChange={(v) =>
                        upsertCodiceCommercialeMutation.mutate({
                          ruolo: "Produttore Sede",
                          anagrafica_id: v || null,
                        })
                      }
                      placeholder="— Nessuno —"
                      clearable
                      clearLabel="— Nessuno —"
                      options={produttoreOptions}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dati Anagrafici */}
          <Card>
            <CardHeader><CardTitle className="text-base">Dati Anagrafici</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Codice Cliente</Label>
                  <div className="font-mono text-sm py-2 px-3 rounded-md bg-muted border border-border">
                    {cliente?.codice_cliente || "—"}
                  </div>
                </div>
                <FieldInput label="Codice Ricerca" field="codice_ricerca" />
                <FieldSelect label="Titolo" field="titolo" options={[
                  { value: "sig", label: "Sig." }, { value: "sig.ra", label: "Sig.ra" },
                  { value: "dott", label: "Dott." }, { value: "dott.ssa", label: "Dott.ssa" },
                  { value: "ing", label: "Ing." }, { value: "avv", label: "Avv." },
                  { value: "spett", label: "Spett.le" },
                ]} />
                <FieldSelect label="Stato" field="stato_cliente" options={[
                  { value: "attivo", label: "Attivo" }, { value: "sospeso", label: "Sospeso" }, { value: "non_operativo", label: "Non Operativo" },
                ]} />
                <FieldSelect label="Prospect" field="prospect" options={[
                  { value: "si", label: "Sì" }, { value: "ex", label: "Ex" }, { value: "na", label: "N/A" },
                ]} />
                {isPrivato ? (
                  <>
                    <FieldInput label="Nome" field="nome" required />
                    <FieldInput label="Cognome" field="cognome" required />
                    <FieldInput
                      label="Codice Fiscale"
                      field="codice_fiscale"
                      required
                      action={
                        ef.codice_fiscale && ef.codice_fiscale.length === 16 && parseCF(ef.codice_fiscale) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 shrink-0"
                            title="Compila automaticamente dati anagrafici dal CF"
                            onClick={() => handleCFAutoFill(ef.codice_fiscale)}
                          >
                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                            Compila da CF
                          </Button>
                        ) : null
                      }
                    />
                    <FieldInput label="Data di Nascita" field="data_nascita" type="date" required warning={dataNascitaWarning} />
                    <FieldComuneItaliano label="Luogo di Nascita" field="luogo_nascita" required warning={luogoNascitaWarning} />
                    <FieldAddress label="Indirizzo Residenza" field="indirizzo_residenza" capField="cap_residenza" cittaField="citta_residenza" provinciaField="provincia_residenza" required />
                    <FieldInput label="Città" field="citta_residenza" />
                    <FieldInput label="Provincia" field="provincia_residenza" />
                    <FieldInput label="CAP" field="cap_residenza" />
                  </>
                ) : (
                  <>
                    <FieldInput label="Ragione Sociale" field="ragione_sociale" required />
                    <FieldInput label="Partita IVA" field="partita_iva" required />
                    <FieldInput label="Codice Fiscale" field="codice_fiscale_azienda" required />
                    <FieldInput label="Codice SDI" field="codice_sdi" />
                    <FieldSelect label="Forma Giuridica" field="forma_giuridica" required options={[
                      { value: "srl", label: "S.R.L." }, { value: "spa", label: "S.P.A." }, { value: "sas", label: "S.A.S." },
                      { value: "snc", label: "S.N.C." }, { value: "ditta_individuale", label: "Ditta Individuale" },
                      { value: "cooperativa", label: "Cooperativa" }, { value: "associazione", label: "Associazione" },
                      { value: "ente_pubblico", label: "Ente Pubblico" }, { value: "fondazione", label: "Fondazione" },
                      { value: "consorzio", label: "Consorzio" }, { value: "altro", label: "Altro" },
                    ]} />
                    <FieldAddress label="Sede" field="indirizzo_sede" capField="cap_sede" cittaField="citta_sede" provinciaField="provincia_sede" required />
                    <FieldInput label="Città Sede" field="citta_sede" />
                    <FieldInput label="Provincia Sede" field="provincia_sede" />
                    <FieldInput label="CAP Sede" field="cap_sede" />
                    {/* Codice CIG rimosso dall'anagrafica: vive solo a livello di polizza/quietanza per clienti Ente. */}
                  </>
                )}
                <FieldInput
                  label="Email"
                  field="email"
                  required
                  errorMessage={!ef.email ? "Campo obbligatorio" : "Email non valida"}
                />

                <FieldInput label="Telefono" field="telefono" />
                <FieldInput label="Cellulare" field="cellulare" />
                <FieldInput label="Fax" field="fax" />
                <FieldInput label="PEC" field="pec" />
                <FieldInput label="Nazione" field="nazione" />
                <FieldInput label="Attenzione di" field="attenzione_di" />
              </div>
              {/* Note */}
              <div className="mt-4">
                <Label className="text-xs">Note</Label>
                {readOnly ? (
                  <p className="text-sm mt-1 whitespace-pre-wrap">{ef.note || "—"}</p>
                ) : (
                  <Textarea className="text-xs" rows={3} value={ef.note || ""} onChange={(e) => updateField("note", e.target.value)} />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Indirizzi Aggiuntivi */}
          <Card>
            <CardHeader><CardTitle className="text-base">Indirizzi Aggiuntivi</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Indirizzo Alternativo</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <FieldAddress label="Indirizzo" field="indirizzo_alternativo" capField="cap_alternativo" cittaField="citta_alternativa" provinciaField="provincia_alternativa" />
                  <FieldInput label="CAP" field="cap_alternativo" />
                  <FieldInput label="Città" field="citta_alternativa" />
                  <FieldInput label="Provincia" field="provincia_alternativa" />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Indirizzo Fiscale</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <FieldAddress label="Indirizzo" field="indirizzo_fiscale" capField="cap_fiscale" cittaField="citta_fiscale" provinciaField="provincia_fiscale" />
                  <FieldInput label="CAP" field="cap_fiscale" />
                  <FieldInput label="Città" field="citta_fiscale" />
                  <FieldInput label="Provincia" field="provincia_fiscale" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Nominativi */}
          <NominativiSection clienteId={id!} readOnly={readOnly} />

          {/* Accordion sections */}
          <Accordion type="multiple" className="space-y-2">
            <AccordionItem value="gestionali" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2"><Settings className="h-4 w-4 text-primary" /><span className="font-semibold">Dati Gestionali</span></div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                  <FieldSelect label="Tipo Persona" field="tipo_persona" options={[
                    { value: "fisica", label: "Fisica" }, { value: "giuridica", label: "Giuridica" }, { value: "na", label: "N/A" },
                  ]} />
                  <FieldSelect label="Sesso" field="sesso" options={[
                    { value: "M", label: "M" }, { value: "F", label: "F" }, { value: "na", label: "N/A" },
                  ]} />
                  <FieldComuneItaliano label="Comune Nascita" field="comune_nascita" />
                  <FieldInput label="Provincia Nascita" field="provincia_nascita" />
                  <FieldSelect label="Tipo Sommario" field="tipo_sommario" options={[
                    { value: "A", label: "A" }, { value: "B", label: "B" }, { value: "C", label: "C" }, { value: "D", label: "D" }, { value: "E", label: "E" },
                  ]} />
                  <FieldSwitch label="Cliente Non Ceduto" field="cliente_non_ceduto" />
                  <FieldSwitch label="Azienda SSN/SX" field="azienda_ssn_sx" />
                  <FieldSwitch label="Stat. Premi/Sinistri" field="statistica_premi_sinistri" />
                  <FieldInput label="Spec. SX Danni" field="spec_sx_danni" />
                  <FieldInput label="Spec. SX Sanità" field="spec_sx_sanita" />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="statistici" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /><span className="font-semibold">Dati Statistici</span></div>
              </AccordionTrigger>
              <AccordionContent>
                <DatiStatisticiSection ef={ef} readOnly={readOnly} updateField={updateField} gruppiFinanziari={gruppiFinanziari} isFieldMissing={isFieldMissing} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="commerciali" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><span className="font-semibold">Rete Commerciale</span></div>
              </AccordionTrigger>
              <AccordionContent>
                <CodiciCommercialiSection clienteId={id!} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="contabili" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /><span className="font-semibold">Dati Contabili</span></div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                  <FieldInput label="Fido Credito €" field="fido_credito" type="number" />
                  <FieldInput label="Fido Cauzioni €" field="fido_cauzioni" type="number" />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          </AnagraficaFormCtx.Provider>
        </TabsContent>
      </Tabs>

      {/* Dialog Aggiungi Relazione */}
      <Dialog open={relazioneOpen} onOpenChange={setRelazioneOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aggiungi Relazione</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cerca Cliente / Azienda</Label>
              <Input placeholder="Nome, cognome o ragione sociale..." value={searchCliente} onChange={(e) => setSearchCliente(e.target.value)} />
              {clientiSearch.length > 0 && (
                <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                  {clientiSearch.map((c: any) => (
                    <div
                      key={c.id}
                      className={`px-3 py-2 cursor-pointer hover:bg-muted text-sm ${selectedCollegatoId === c.id ? "bg-primary/10 font-medium" : ""}`}
                      onClick={() => { setSelectedCollegatoId(c.id); setSearchCliente(getClienteDisplayName(c)); }}
                    >
                      {getClienteDisplayName(c)}
                      <span className="text-muted-foreground ml-2">({c.tipo_cliente === "privato" ? "Privato" : "Azienda"})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Tipo Relazione</Label>
              <Select value={tipoRelazione} onValueChange={setTipoRelazione}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tipiRelazione.map(t => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Note (opzionale)</Label>
              <Input value={noteRelazione} onChange={(e) => setNoteRelazione(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addRelazioneMutation.mutate()} disabled={!selectedCollegatoId || addRelazioneMutation.isPending}>Aggiungi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(() => {
        const _clienteName = cliente?.ragione_sociale || `${cliente?.nome || ""} ${cliente?.cognome || ""}`.trim() || "Cliente";
        return (
        <DeleteWithImpactDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          entityId={cliente?.id}
          entityType="cliente"
          entityName={_clienteName}
          checks={[
            { table: "titoli", column: "cliente_anagrafica_id", label: "Polizze (restano nello storico)", blocking: false },
            { table: "sinistri", column: "cliente_anagrafica_id", label: "Sinistri (restano nello storico)", blocking: false },
            { table: "documenti", column: "entita_id", label: "Documenti (restano nello storico)", blocking: false },
            { table: "trattative", column: "cliente_id", label: "Trattative (eliminate in cascata)", blocking: false },
            { table: "privacy_consensi", column: "cliente_id", label: "Consensi privacy (eliminati in cascata)", blocking: false },
          ]}
          extraNotes={
            <div>
              <span className="font-semibold">Nota:</span> polizze, sinistri e documenti collegati al cliente
              <strong> non vengono eliminati</strong>: restano nei rispettivi archivi e mostreranno
              "— Cliente rimosso —" al posto del nome.
            </div>
          }
          isDeleting={isDeleting}
          onConfirmDelete={async () => {
            if (!cliente?.id) return;
            setIsDeleting(true);
            const { error } = await supabase.from("clienti").delete().eq("id", cliente.id);
            setIsDeleting(false);
            if (error) {
              toast.error("Errore eliminazione: " + error.message);
              return;
            }
            toast.success(`Cliente "${_clienteName}" eliminato. Storico preservato.`);
            setDeleteOpen(false);
            queryClient.invalidateQueries({ queryKey: ["clienti"] });
            navigate("/archivi/clienti");
          }}
        />
        );
      })()}
    </div>
  );
}
