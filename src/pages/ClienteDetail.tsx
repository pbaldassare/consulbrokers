import { useState, useEffect, useRef } from "react";
import { logAttivita } from "@/lib/logAttivita";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { ArrowLeft, User, Building2, Plus, Link2, FileText, Settings, BarChart3, Users, Wallet, AlertTriangle, Trash2, Globe, Key, ExternalLink } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import AddressAutocomplete, { type AddressComponents } from "@/components/AddressAutocomplete";
import DocumentiTab from "@/components/DocumentiTab";
import SinistriClienteTab from "@/components/SinistriClienteTab";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import AiDocumentScanner from "@/components/AiDocumentScanner";
import type { DocumentType } from "@/components/AiDocumentScanner";
import { toast } from "sonner";
import { parseCF } from "@/lib/parseCF";
import { lookupComune } from "@/lib/comuniItaliani";
import { useLookupZone, useLookupIndotti, useLookupAttivita, useLookupSettori, useLookupContratti, useLookupFasceFatturato, useLookupFasceDipendenti, useGruppiStatistici } from "@/hooks/useLookupTables";

const tipiRelazione = [
  { value: "dipendente", label: "Dipendente" },
  { value: "legale_rappresentante", label: "Legale Rappresentante" },
  { value: "referente", label: "Referente" },
  { value: "socio", label: "Socio" },
];

const ruoliCommerciali = [
  { value: "account_executive", label: "Account Executive" },
  { value: "backoffice", label: "Specialist" },
  { value: "agente", label: "Agente" },
  { value: "produttore_sede", label: "Produttore Sede" },
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
  const [dataDisdetta, setDataDisdetta] = useState(existing?.data_disdetta || "");
  const [termineProroga, setTermineProroga] = useState(existing?.termine_proroga || "");
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
      setDataDisdetta(existing.data_disdetta || "");
      setTermineProroga(existing.termine_proroga || "");
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
      data_disdetta: dataDisdetta || null,
      termine_proroga: termineProroga || null,
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
          <div>
            <Label className="text-xs">Data Disdetta</Label>
            <Input className="h-8 text-xs" type="date" value={dataDisdetta} onChange={(e) => setDataDisdetta(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Termine Proroga</Label>
            <Input className="h-8 text-xs" type="date" value={termineProroga} onChange={(e) => setTermineProroga(e.target.value)} />
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
        .from("nominativi_cliente" as any)
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("nominativi_cliente" as any) as any).insert({
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
      const { error } = await (supabase.from("nominativi_cliente" as any) as any).delete().eq("id", id);
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
function DatiStatisticiSection({ ef, readOnly, updateField, gruppiFinanziari }: { ef: Record<string, any>; readOnly: boolean; updateField: (f: string, v: any) => void; gruppiFinanziari: any[] }) {
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

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
      <LookupField label="Zona" field="zona" options={zoneOpts} />
      <LookupField label="Indotto" field="indotto" options={indottiOpts} />
      <div>
        <Label className="text-xs">Gruppo Finanziario</Label>
        {readOnly ? (
          <p className="text-sm mt-1">{gruppiFinanziari.find((g: any) => g.id === ef.gruppo_finanziario_id)?.nome || "—"}</p>
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
                <Label>Ramo</Label>
                <SearchableSelect options={ramiOpts} value={form.ramo_id} onValueChange={(v) => setForm({ ...form, ramo_id: v })} placeholder="Seleziona ramo..." />
              </div>
              <div className="space-y-1.5">
                <Label>Compagnia</Label>
                <SearchableSelect options={compagnieOpts} value={form.compagnia_id} onValueChange={(v) => setForm({ ...form, compagnia_id: v })} placeholder="Seleziona compagnia..." />
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

  const currentTipo = (cliente as any).area_riservata_tipo || "nessuna";
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
        .update({ area_riservata_tipo: tipo } as any)
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
        .update({ area_riservata_tipo: "nessuna" } as any)
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
    mutationFn: async (missing: { field: string; label: string }[]) => {
      if (missing.length > 0) {
        throw new Error("Campi obbligatori mancanti: " + missing.map((m) => m.label).join(", "));
      }
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
  const isCFValid = (cf: string) => /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test((cf || "").toUpperCase());
  const isPIVAValid = (p: string) => /^\d{11}$/.test(p || "");

  const requiredFieldsList: { field: string; label: string; ok: boolean }[] = isPrivato
    ? [
        { field: "codice_fiscale", label: "Codice Fiscale", ok: isCFValid(ef.codice_fiscale || "") },
        { field: "data_nascita", label: "Data di Nascita", ok: !!ef.data_nascita },
        { field: "luogo_nascita", label: "Luogo di Nascita", ok: !!(ef.luogo_nascita || "").trim() },
        { field: "indirizzo_residenza", label: "Indirizzo Residenza", ok: !!(ef.indirizzo_residenza || "").trim() },
      ]
    : [
        {
          field: "partita_iva",
          label: "Partita IVA o Codice Fiscale",
          ok: isPIVAValid(ef.partita_iva || "") || isPIVAValid(ef.codice_fiscale_azienda || "") || isCFValid(ef.codice_fiscale_azienda || ""),
        },
        { field: "forma_giuridica", label: "Forma Giuridica", ok: !!(ef.forma_giuridica || "").trim() },
        { field: "indirizzo_sede", label: "Indirizzo Sede", ok: !!(ef.indirizzo_sede || "").trim() },
      ];

  const missingRequired = requiredFieldsList.filter((r) => !r.ok);
  const requiredFieldNames = new Set(requiredFieldsList.map((r) => r.field));
  const missingFieldNames = new Set(missingRequired.map((r) => r.field));

  const isFieldRequired = (field: string) => requiredFieldNames.has(field);
  const isFieldMissing = (field: string) => missingFieldNames.has(field);
  // Per il campo P.IVA/CF azienda, se manca uno mancano entrambi visivamente
  const isAziendaIdMissing = !isPrivato && missingFieldNames.has("partita_iva");

  const RequiredMark = () => <span className="text-destructive ml-0.5">*</span>;

  const FieldHint = ({ field, customWarning }: { field: string; customWarning?: string | null }) => {
    if (!readOnly && isFieldRequired(field) && (isFieldMissing(field) || (field === "codice_fiscale_azienda" && isAziendaIdMissing))) {
      return <p className="text-xs text-destructive mt-0.5">Campo obbligatorio</p>;
    }
    if (customWarning) {
      return <p className="text-xs text-amber-600 mt-0.5">{customWarning}</p>;
    }
    return null;
  };

  const FieldInput = ({ label, field, type = "text", required, warning }: { label: string; field: string; type?: string; required?: boolean; warning?: string | null }) => {
    const showError = !readOnly && required && isFieldMissing(field);
    return (
      <div>
        <Label className="text-xs">{label}{required && <RequiredMark />}</Label>
        {readOnly ? (
          <p className="text-sm mt-1">{ef[field] || "—"}</p>
        ) : (
          <Input
            className={`h-8 text-xs ${showError ? "border-destructive focus-visible:ring-destructive" : ""}`}
            type={type}
            value={ef[field] || ""}
            onChange={(e) => {
              const val = field === "codice_fiscale" || field === "codice_fiscale_azienda" || field === "partita_iva" ? e.target.value.toUpperCase() : e.target.value;
              updateField(field, val);
              if ((field === "codice_fiscale" || field === "codice_fiscale_azienda") && val.length === 16) {
                handleCFAutoFill(val);
              }
              if (field === "codice_fiscale_azienda" && val.length === 11 && /^\d{11}$/.test(val) && !ef.partita_iva) {
                updateField("partita_iva", val);
                toast.info("Partita IVA copiata dal Codice Fiscale Azienda");
              }
            }}
          />
        )}
        {!readOnly && (
          <>
            {showError && <p className="text-xs text-destructive mt-0.5">Campo obbligatorio</p>}
            {!showError && warning && <p className="text-xs text-amber-600 mt-0.5">{warning}</p>}
          </>
        )}
      </div>
    );
  };

  const FieldSelect = ({ label, field, options, required }: { label: string; field: string; options: { value: string; label: string }[]; required?: boolean }) => {
    const showError = !readOnly && required && isFieldMissing(field);
    return (
      <div>
        <Label className="text-xs">{label}{required && <RequiredMark />}</Label>
        {readOnly ? (
          <p className="text-sm mt-1">{options.find(o => o.value === ef[field])?.label || ef[field] || "—"}</p>
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
  };

  const FieldSwitch = ({ label, field }: { label: string; field: string }) => (
    <div className="flex items-center gap-2">
      <Switch checked={!!ef[field]} onCheckedChange={(v) => updateField(field, v)} disabled={readOnly} />
      <Label className="text-xs">{label}</Label>
    </div>
  );

  const FieldAddress = ({ label, field, capField, cittaField, provinciaField, required }: { label: string; field: string; capField: string; cittaField: string; provinciaField: string; required?: boolean }) => {
    const showError = !readOnly && required && isFieldMissing(field);
    return (
      <div>
        <Label className="text-xs">{label}{required && <RequiredMark />}</Label>
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
  };

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
        {editMode ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setEditFields({ ...cliente }); setEditMode(false); }}>Annulla</Button>
            <Button size="sm" onClick={() => saveDetailsMutation.mutate()} disabled={saveDetailsMutation.isPending}>Salva</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>Modifica</Button>
        )}
      </div>

      {/* Tabs - positioned right after header */}
      <Tabs defaultValue="polizze">
        <div className="flex items-center flex-wrap gap-1">
          <TabsList className="flex-wrap">
            <TabsTrigger value="polizze"><FileText className="w-4 h-4 mr-1" />Polizze ({polizze.length})</TabsTrigger>
            <TabsTrigger value="sinistri"><AlertTriangle className="w-4 h-4 mr-1" />Sinistri</TabsTrigger>
            <TabsTrigger value="relazioni"><Link2 className="w-4 h-4 mr-1" />{isPrivato ? "Aziende" : "Persone"} ({relazioni.length})</TabsTrigger>
            <TabsTrigger value="documenti">Documenti</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="trattative"><FileText className="w-4 h-4 mr-1" />Trattative</TabsTrigger>
            <TabsTrigger value="anagrafica"><User className="w-4 h-4 mr-1" />Anagrafica</TabsTrigger>
          </TabsList>
          <AreaRiservataHeaderButton cliente={cliente} onUpdate={() => queryClient.invalidateQueries({ queryKey: ["cliente", id] })} />
        </div>

        <TabsContent value="polizze">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Polizze del cliente</CardTitle>
              <Button size="sm" onClick={() => navigate(`/portafoglio/immissione?clienteId=${id}`)}>
                + Nuova Polizza
              </Button>
            </CardHeader>
            <CardContent className="pt-2">
              {polizze.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10">
                  <p className="text-muted-foreground">Nessuna polizza collegata a questo cliente</p>
                  <Button variant="outline" onClick={() => navigate(`/portafoglio/immissione?clienteId=${id}`)}>
                    + Crea la prima polizza
                  </Button>
                </div>
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

        <TabsContent value="sinistri">
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

        <TabsContent value="trattative">
          <TrattativeClienteSection clienteId={id!} />
        </TabsContent>

        <TabsContent value="anagrafica" className="space-y-6">
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
                    <FieldAddress label="Indirizzo Residenza" field="indirizzo_residenza" capField="cap_residenza" cittaField="citta_residenza" provinciaField="provincia_residenza" />
                    <FieldInput label="Città" field="citta_residenza" />
                    <FieldInput label="Provincia" field="provincia_residenza" />
                    <FieldInput label="CAP" field="cap_residenza" />
                  </>
                ) : (
                  <>
                    <FieldInput label="Partita IVA" field="partita_iva" />
                    <FieldInput label="Codice Fiscale" field="codice_fiscale_azienda" />
                    <FieldInput label="Codice SDI" field="codice_sdi" />
                    <FieldSelect label="Forma Giuridica" field="forma_giuridica" options={[
                      { value: "srl", label: "S.R.L." }, { value: "spa", label: "S.P.A." }, { value: "sas", label: "S.A.S." },
                      { value: "snc", label: "S.N.C." }, { value: "ditta_individuale", label: "Ditta Individuale" },
                      { value: "cooperativa", label: "Cooperativa" }, { value: "associazione", label: "Associazione" },
                      { value: "ente_pubblico", label: "Ente Pubblico" }, { value: "fondazione", label: "Fondazione" },
                      { value: "consorzio", label: "Consorzio" }, { value: "altro", label: "Altro" },
                    ]} />
                    <FieldAddress label="Sede" field="indirizzo_sede" capField="cap_sede" cittaField="citta_sede" provinciaField="provincia_sede" />
                    <FieldInput label="Città Sede" field="citta_sede" />
                    <FieldInput label="Provincia Sede" field="provincia_sede" />
                    <FieldInput label="CAP Sede" field="cap_sede" />
                  </>
                )}
                <FieldInput label="Email" field="email" />
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

            <AccordionItem value="statistici" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /><span className="font-semibold">Dati Statistici</span></div>
              </AccordionTrigger>
              <AccordionContent>
                <DatiStatisticiSection ef={ef} readOnly={readOnly} updateField={updateField} gruppiFinanziari={gruppiFinanziari} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="commerciali" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><span className="font-semibold">Codici Commerciali (Rete)</span></div>
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
    </div>
  );
}
