import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, User, Building2, Plus, Link2, FileText, Settings, BarChart3, Users, Wallet } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import DocumentiTab from "@/components/DocumentiTab";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import AiDocumentScanner from "@/components/AiDocumentScanner";
import type { DocumentType } from "@/components/AiDocumentScanner";
import { toast } from "sonner";
import { parseCF } from "@/lib/parseCF";
import { lookupComune } from "@/lib/comuniItaliani";

const tipiRelazione = [
  { value: "dipendente", label: "Dipendente" },
  { value: "legale_rappresentante", label: "Legale Rappresentante" },
  { value: "referente", label: "Referente" },
  { value: "socio", label: "Socio" },
];

const ruoliCommerciali = [
  { value: "account_executive", label: "Account Executive" },
  { value: "corrispondente_1", label: "Corrispondente 1" },
  { value: "corrispondente_2", label: "Corrispondente 2" },
  { value: "corrispondente_3", label: "Corrispondente 3" },
];

/* ── Codici Commerciali Sub-component ── */
function CodiciCommercialiSection({ clienteId }: { clienteId: string }) {
  const queryClient = useQueryClient();

  const { data: codici = [] } = useQuery({
    queryKey: ["codici_commerciali", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("codici_commerciali_cliente" as any)
        .select("*")
        .eq("cliente_id", clienteId)
        .order("ruolo");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: profili = [] } = useQuery({
    queryKey: ["profili_commerciali"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, cognome, ruolo")
        .in("ruolo", ["produttore", "ufficio", "backoffice", "admin"])
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await (supabase.from("codici_commerciali_cliente" as any) as any)
        .upsert(payload, { onConflict: "cliente_id,ruolo" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["codici_commerciali", clienteId] });
      toast.success("Codice commerciale salvato");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getByRuolo = (ruolo: string) => codici.find((c: any) => c.ruolo === ruolo);

  return (
    <div className="space-y-4">
      {ruoliCommerciali.map((r) => {
        const existing = getByRuolo(r.value);
        return (
          <CodiceCommercialeRow
            key={r.value}
            ruolo={r.value}
            label={r.label}
            existing={existing}
            profili={profili}
            clienteId={clienteId}
            onSave={(payload: any) => upsertMutation.mutate(payload)}
            saving={upsertMutation.isPending}
          />
        );
      })}
    </div>
  );
}

function CodiceCommercialeRow({ ruolo, label, existing, profili, clienteId, onSave, saving }: any) {
  const [profiloId, setProfiloId] = useState(existing?.profilo_id || "");
  const [percentuale, setPercentuale] = useState(existing?.percentuale?.toString() || "0");
  const [societaBrand, setSocietaBrand] = useState(existing?.societa_brand || "");
  const [filiale, setFiliale] = useState(existing?.filiale || "");
  const [mandato, setMandato] = useState(existing?.mandato || "");
  const [dataAcquisito, setDataAcquisito] = useState(existing?.data_acquisito || "");
  const [scadenzaMandato, setScadenzaMandato] = useState(existing?.scadenza_mandato || "");
  const [altroBroker, setAltroBroker] = useState(existing?.altro_broker || false);
  const [altroBrokerNome, setAltroBrokerNome] = useState(existing?.altro_broker_nome || "");

  useEffect(() => {
    if (existing) {
      setProfiloId(existing.profilo_id || "");
      setPercentuale(existing.percentuale?.toString() || "0");
      setSocietaBrand(existing.societa_brand || "");
      setFiliale(existing.filiale || "");
      setMandato(existing.mandato || "");
      setDataAcquisito(existing.data_acquisito || "");
      setScadenzaMandato(existing.scadenza_mandato || "");
      setAltroBroker(existing.altro_broker || false);
      setAltroBrokerNome(existing.altro_broker_nome || "");
    }
  }, [existing]);

  const handleSave = () => {
    onSave({
      ...(existing?.id ? { id: existing.id } : {}),
      cliente_id: clienteId,
      ruolo,
      profilo_id: profiloId || null,
      percentuale: parseFloat(percentuale) || 0,
      societa_brand: societaBrand || null,
      filiale: filiale || null,
      mandato: mandato || null,
      data_acquisito: dataAcquisito || null,
      scadenza_mandato: scadenzaMandato || null,
      altro_broker: altroBroker,
      altro_broker_nome: altroBrokerNome || null,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <Label className="text-xs">Profilo</Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={profiloId}
              onValueChange={setProfiloId}
              placeholder="Seleziona profilo..."
              options={profili.map((p: any) => ({ value: p.id, label: `${p.cognome} ${p.nome}` }))}
            />
          </div>
          <div>
            <Label className="text-xs">% Provvigione</Label>
            <Input className="h-8 text-xs" type="number" step="0.01" value={percentuale} onChange={(e) => setPercentuale(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Società/Brand</Label>
            <Input className="h-8 text-xs" value={societaBrand} onChange={(e) => setSocietaBrand(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Filiale</Label>
            <Input className="h-8 text-xs" value={filiale} onChange={(e) => setFiliale(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Mandato</Label>
            <Input className="h-8 text-xs" value={mandato} onChange={(e) => setMandato(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Data Acquisito</Label>
            <Input className="h-8 text-xs" type="date" value={dataAcquisito} onChange={(e) => setDataAcquisito(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Scadenza Mandato</Label>
            <Input className="h-8 text-xs" type="date" value={scadenzaMandato} onChange={(e) => setScadenzaMandato(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <Switch checked={altroBroker} onCheckedChange={setAltroBroker} />
            <Label className="text-xs">Altro Broker</Label>
            {altroBroker && (
              <Input className="h-8 text-xs flex-1" placeholder="Nome broker..." value={altroBrokerNome} onChange={(e) => setAltroBrokerNome(e.target.value)} />
            )}
          </div>
          <div className="col-span-2 md:col-span-4 flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={saving}>Salva</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main Component ── */
export default function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [relazioneOpen, setRelazioneOpen] = useState(false);
  const [searchCliente, setSearchCliente] = useState("");
  const [selectedCollegatoId, setSelectedCollegatoId] = useState("");
  const [tipoRelazione, setTipoRelazione] = useState("referente");
  const [noteRelazione, setNoteRelazione] = useState("");
  const [editMode, setEditMode] = useState(false);

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
        .from("gruppi_finanziari" as any)
        .select("id, codice, nome, descrizione")
        .eq("attivo", true)
        .order("codice");
      return (data || []) as any[];
    },
  });

  // Inline edit state
  const [editFields, setEditFields] = useState<Record<string, any>>({});

  useEffect(() => {
    if (cliente) {
      setEditFields({ ...cliente });
    }
  }, [cliente]);

  const updateField = (field: string, value: any) => {
    setEditFields((prev) => ({ ...prev, [field]: value }));
  };

  const saveDetailsMutation = useMutation({
    mutationFn: async () => {
      const {
        id: _id, created_at, updated_at, user_id, ufficio_id, ...rest
      } = editFields;
      const { error } = await supabase.from("clienti").update(rest as any).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", id] });
      toast.success("Dati aggiornati");
      setEditMode(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Polizze collegate al cliente
  const { data: polizze = [] } = useQuery({
    queryKey: ["polizze_cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("id, numero_titolo, stato, premio_lordo, importo_incassato, data_incasso, prodotti(nome_prodotto, compagnie(nome))")
        .eq("cliente_anagrafica_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Relazioni
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

  const provisionedRef = useRef(false);
  useEffect(() => {
    if (cliente && !cliente.user_id && cliente.email && !provisionedRef.current) {
      provisionedRef.current = true;
      provisionMutation.mutate(cliente.id);
    }
  }, [cliente]);

  if (!cliente) return null;

  const isPrivato = cliente.tipo_cliente === "privato";
  const displayName = isPrivato
    ? `${cliente.cognome || ""} ${cliente.nome || ""}`.trim() || "—"
    : cliente.ragione_sociale || "—";

  const getClienteDisplayName = (c: any) => {
    if (!c) return "—";
    return c.tipo_cliente === "privato"
      ? `${c.cognome || ""} ${c.nome || ""}`.trim() || "—"
      : c.ragione_sociale || "—";
  };

  const ef = editFields;
  const readOnly = !editMode;

  const FieldDisplay = ({ label, value }: { label: string; value: any }) => (
    <div><span className="text-muted-foreground text-xs">{label}</span><p className="text-sm">{value || "—"}</p></div>
  );

  const handleCFAutoFill = (cf: string) => {
    if (cf.length === 16) {
      const parsed = parseCF(cf);
      if (parsed) {
        if (!ef.sesso) updateField("sesso", parsed.sesso);
        if (!ef.data_nascita) updateField("data_nascita", parsed.dataNascita);
        const info = lookupComune(parsed.codiceCatastale);
        if (info) {
          if (!ef.comune_nascita) updateField("comune_nascita", info.comune);
          if (!ef.provincia_nascita) updateField("provincia_nascita", info.provincia);
        }
        toast.info("Dati estratti automaticamente dal Codice Fiscale");
      }
    }
  };

  const FieldInput = ({ label, field, type = "text" }: { label: string; field: string; type?: string }) => (
    <div>
      <Label className="text-xs">{label}</Label>
      {readOnly ? (
        <p className="text-sm mt-1">{ef[field] || "—"}</p>
      ) : (
        <Input className="h-8 text-xs" type={type} value={ef[field] || ""} onChange={(e) => {
          const val = field === "codice_fiscale" || field === "codice_fiscale_azienda" ? e.target.value.toUpperCase() : e.target.value;
          updateField(field, val);
          if ((field === "codice_fiscale" || field === "codice_fiscale_azienda") && val.length === 16) {
            handleCFAutoFill(val);
          }
        }} />
      )}
    </div>
  );

  const FieldSelect = ({ label, field, options }: { label: string; field: string; options: { value: string; label: string }[] }) => (
    <div>
      <Label className="text-xs">{label}</Label>
      {readOnly ? (
        <p className="text-sm mt-1">{options.find(o => o.value === ef[field])?.label || ef[field] || "—"}</p>
      ) : (
        <SearchableSelect
          className="h-8 text-xs"
          value={ef[field] || ""}
          onValueChange={(v) => updateField(field, v)}
          placeholder="—"
          options={options}
        />
      )}
    </div>
  );

  const FieldSwitch = ({ label, field }: { label: string; field: string }) => (
    <div className="flex items-center gap-2">
      <Switch checked={!!ef[field]} onCheckedChange={(v) => updateField(field, v)} disabled={readOnly} />
      <Label className="text-xs">{label}</Label>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/archivi/clienti")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <p className="text-muted-foreground flex items-center gap-1.5">
            {isPrivato ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
            {isPrivato ? "Cliente Privato" : "Azienda"}
          </p>
        </div>
        <Badge variant={cliente.attivo ? "default" : "secondary"}>
          {cliente.attivo ? "Attivo" : "Disattivo"}
        </Badge>
        {editMode ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setEditFields({ ...cliente }); setEditMode(false); }}>Annulla</Button>
            <Button size="sm" onClick={() => saveDetailsMutation.mutate()} disabled={saveDetailsMutation.isPending}>Salva</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>Modifica</Button>
        )}
      </div>

      {/* Dati Anagrafici */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dati Anagrafici</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <FieldInput label="Codice Ricerca" field="codice_ricerca" />
            <FieldSelect label="Titolo" field="titolo" options={[
              { value: "sig", label: "Sig." }, { value: "sig.ra", label: "Sig.ra" },
              { value: "dott", label: "Dott." }, { value: "dott.ssa", label: "Dott.ssa" },
              { value: "ing", label: "Ing." }, { value: "avv", label: "Avv." },
            ]} />
            <FieldSelect label="Stato" field="stato_cliente" options={[
              { value: "attivo", label: "Attivo" }, { value: "sospeso", label: "Sospeso" }, { value: "non_operativo", label: "Non Operativo" },
            ]} />
            <FieldSelect label="Prospect" field="prospect" options={[
              { value: "si", label: "Sì" }, { value: "ex", label: "Ex" }, { value: "na", label: "N/A" },
            ]} />
            {isPrivato ? (
              <>
                <FieldInput label="Codice Fiscale" field="codice_fiscale" />
                <FieldInput label="Data di Nascita" field="data_nascita" type="date" />
                <FieldInput label="Luogo di Nascita" field="luogo_nascita" />
                <FieldDisplay label="Indirizzo" value={cliente.indirizzo_residenza} />
                <FieldDisplay label="Città" value={`${cliente.citta_residenza || ""} ${cliente.provincia_residenza ? `(${cliente.provincia_residenza})` : ""}`} />
                <FieldDisplay label="CAP" value={cliente.cap_residenza} />
              </>
            ) : (
              <>
                <FieldInput label="Partita IVA" field="partita_iva" />
                <FieldInput label="Codice Fiscale" field="codice_fiscale_azienda" />
                <FieldDisplay label="Codice SDI" value={cliente.codice_sdi} />
                <FieldDisplay label="Forma Giuridica" value={cliente.forma_giuridica?.toUpperCase()} />
                <FieldDisplay label="Sede" value={cliente.indirizzo_sede} />
                <FieldDisplay label="Città" value={`${cliente.citta_sede || ""} ${cliente.provincia_sede ? `(${cliente.provincia_sede})` : ""}`} />
              </>
            )}
            <FieldDisplay label="Email" value={cliente.email} />
            <FieldDisplay label="Telefono" value={cliente.telefono} />
            <FieldInput label="Cellulare" field="cellulare" />
            <FieldInput label="Fax" field="fax" />
            <FieldDisplay label="PEC" value={cliente.pec} />
            <FieldInput label="Nazione" field="nazione" />
            <FieldInput label="Attenzione di" field="attenzione_di" />
          </div>
        </CardContent>
      </Card>

      {/* Accordion sections */}
      <Accordion type="multiple" className="space-y-2">
        {/* Dati Gestionali */}
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
              <FieldInput label="Comune Nascita" field="comune_nascita" />
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

        {/* Dati Statistici */}
        <AccordionItem value="statistici" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /><span className="font-semibold">Dati Statistici</span></div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
              <FieldInput label="Zona" field="zona" />
              <FieldInput label="Indotto" field="indotto" />
              <div>
                <Label className="text-xs">Gruppo Finanziario</Label>
                {readOnly ? (
                  <p className="text-sm mt-1">{gruppiFinanziari.find((g: any) => g.id === ef.gruppo_finanziario_id)?.nome || gruppiFinanziari.find((g: any) => g.id === ef.gruppo_finanziario_id)?.descrizione || "—"}</p>
                ) : (
                  <SearchableSelect
                    className="h-8 text-xs"
                    value={ef.gruppo_finanziario_id || ""}
                    onValueChange={(v) => updateField("gruppo_finanziario_id", v || null)}
                    placeholder="— Seleziona gruppo —"
                    options={gruppiFinanziari.map((g: any) => ({ value: g.id, label: `${g.codice} - ${g.nome}` }))}
                  />
                )}
              </div>
              <FieldInput label="Attività" field="attivita" />
              <FieldInput label="Settore" field="settore" />
              <FieldInput label="Azienda Stat." field="azienda_stat" />
              <FieldInput label="Contratto" field="contratto" />
              <FieldInput label="Matricola" field="matricola" />
              <FieldInput label="Riferimento" field="riferimento" />
              <FieldInput label="Fatturato" field="fatturato" type="number" />
              <FieldInput label="N. Dipendenti" field="num_dipendenti" type="number" />
              <FieldInput label="Codice ATECO" field="codice_ateco" />
              <FieldSwitch label="Cliente Associato" field="cliente_associato" />
              <FieldSwitch label="Cliente Captive" field="cliente_captive" />
              <FieldSwitch label="Internazionale" field="internazionale" />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Codici Commerciali */}
        <AccordionItem value="commerciali" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><span className="font-semibold">Codici Commerciali (Rete)</span></div>
          </AccordionTrigger>
          <AccordionContent>
            <CodiciCommercialiSection clienteId={id!} />
          </AccordionContent>
        </AccordionItem>

        {/* Dati Contabili */}
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

      {/* Tabs */}
      <Tabs defaultValue="polizze">
        <TabsList>
          <TabsTrigger value="polizze"><FileText className="w-4 h-4 mr-1" />Polizze ({polizze.length})</TabsTrigger>
          <TabsTrigger value="relazioni"><Link2 className="w-4 h-4 mr-1" />{isPrivato ? "Aziende" : "Persone"} ({relazioni.length})</TabsTrigger>
          <TabsTrigger value="documenti">Documenti</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="polizze">
          <Card>
            <CardContent className="pt-6">
              {polizze.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nessuna polizza collegata a questo cliente</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N. Polizza</TableHead>
                      <TableHead>Prodotto</TableHead>
                      <TableHead>Compagnia</TableHead>
                      <TableHead>Premio €</TableHead>
                      <TableHead>Incassato €</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Data Incasso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {polizze.map((p: any) => (
                      <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/titoli/${p.id}`)}>
                        <TableCell className="font-medium">{p.numero_titolo || "—"}</TableCell>
                        <TableCell>{p.prodotti?.nome_prodotto || "—"}</TableCell>
                        <TableCell>{p.prodotti?.compagnie?.nome || "—"}</TableCell>
                        <TableCell className="font-mono">{p.premio_lordo?.toFixed(2) ?? "—"}</TableCell>
                        <TableCell className="font-mono">{p.importo_incassato?.toFixed(2) ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={p.stato === "incassato" ? "default" : p.stato === "stornato" ? "destructive" : "secondary"}>{p.stato}</Badge>
                        </TableCell>
                        <TableCell>{p.data_incasso || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
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
                {isPrivato ? (
                  <>
                    <AiDocumentScanner documentType="carta_identita" onFileReady={handleScanUpload} onExtracted={() => {}} label="Scansiona Carta d'Identità" />
                    <AiDocumentScanner documentType="tessera_sanitaria" onFileReady={handleScanUpload} onExtracted={() => {}} label="Scansiona Tessera Sanitaria" />
                  </>
                ) : (
                  <AiDocumentScanner documentType="visura_camerale" onFileReady={handleScanUpload} onExtracted={() => {}} label="Scansiona Visura Camerale" />
                )}
              </div>
            </CardContent>
          </Card>
          <DocumentiTab entitaTipo="cliente" entitaId={id!} bucketName="documenti_clienti" />
        </TabsContent>

        <TabsContent value="chat"><ChatTab entitaTipo="cliente" entitaId={id!} /></TabsContent>
        <TabsContent value="timeline"><TimelineTab entitaTipo="cliente" entitaId={id!} /></TabsContent>
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
    </div>
  );
}
