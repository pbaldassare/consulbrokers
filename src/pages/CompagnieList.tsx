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
import { Plus, Building2, Search, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AddressAutocomplete from "@/components/AddressAutocomplete";

interface CompagniaForm {
  nome: string;
  codice: string;
  nome_segue: string;
  indirizzo: string;
  cap: string;
  comune: string;
  provincia: string;
  telefono: string;
  fax: string;
  codice_fiscale: string;
  partita_iva: string;
  stato: string;
  gruppo_compagnia: string;
  tipo_mandatario: string;
  gruppo_statistico: string;
  mail: string;
  pec: string;
  mail_ec: string;
  mail_avvisi: string;
  percentuale_ra: string;
  iban: string;
  intestato_a: string;
}

const emptyForm: CompagniaForm = {
  nome: "", codice: "", nome_segue: "", indirizzo: "", cap: "", comune: "", provincia: "",
  telefono: "", fax: "", codice_fiscale: "", partita_iva: "", stato: "Operativo",
  gruppo_compagnia: "", tipo_mandatario: "", gruppo_statistico: "",
  mail: "", pec: "", mail_ec: "", mail_avvisi: "",
  percentuale_ra: "", iban: "", intestato_a: "",
};

const CompagnieList = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CompagniaForm>(emptyForm);

  // Anagrafica filters
  const [searchNome, setSearchNome] = useState("");
  const [searchCodice, setSearchCodice] = useState("");

  // Sinistri filters
  const [searchSinistri, setSearchSinistri] = useState("");

  const setField = (key: keyof CompagniaForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

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
      const payload: Record<string, unknown> = {
        nome: form.nome,
        codice: form.codice || null,
        nome_segue: form.nome_segue || null,
        indirizzo: form.indirizzo || null,
        cap: form.cap || null,
        comune: form.comune || null,
        provincia: form.provincia || null,
        telefono: form.telefono || null,
        fax: form.fax || null,
        codice_fiscale: form.codice_fiscale || null,
        partita_iva: form.partita_iva || null,
        stato: form.stato || null,
        gruppo_compagnia: form.gruppo_compagnia || null,
        tipo_mandatario: form.tipo_mandatario || null,
        gruppo_statistico: form.gruppo_statistico || null,
        mail: form.mail || null,
        pec: form.pec || null,
        mail_ec: form.mail_ec || null,
        mail_avvisi: form.mail_avvisi || null,
        percentuale_ra: form.percentuale_ra ? parseFloat(form.percentuale_ra) : null,
        iban: form.iban || null,
        intestato_a: form.intestato_a || null,
      };
      const { error } = await supabase.from("compagnie").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compagnie"] });
      setOpen(false);
      setForm(emptyForm);
      toast({ title: "Compagnia creata con successo" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, attiva }: { id: string; attiva: boolean }) => {
      const { error } = await supabase.from("compagnie").update({ attiva }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compagnie"] }),
  });

  // Anagrafica filtered list
  const filteredAnagrafica = compagnie.filter((c: any) => {
    const matchNome = !searchNome || c.nome?.toLowerCase().includes(searchNome.toLowerCase());
    const matchCodice = !searchCodice || c.codice?.toLowerCase().startsWith(searchCodice.toLowerCase());
    return matchNome && matchCodice;
  });

  // Sinistri filtered list
  const filteredSinistri = compagnie.filter((c: any) => {
    if (!searchSinistri) return true;
    return c.nome?.toLowerCase().includes(searchSinistri.toLowerCase());
  });

  const Field = ({ label, field, placeholder }: { label: string; field: keyof CompagniaForm; placeholder?: string }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={form[field]} onChange={(e) => setField(field, e.target.value)} placeholder={placeholder} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compagnie</h1>
          <p className="text-muted-foreground">Gestione compagnie assicurative</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuova Compagnia</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nuova Compagnia</DialogTitle></DialogHeader>
            <Tabs defaultValue="generali" className="w-full">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="generali">Generali</TabsTrigger>
                <TabsTrigger value="sede">Sede</TabsTrigger>
                <TabsTrigger value="contatti">Contatti</TabsTrigger>
                <TabsTrigger value="fiscale">Fiscale / Banca</TabsTrigger>
              </TabsList>

              <TabsContent value="generali" className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Codice" field="codice" />
                  <Field label="Nome *" field="nome" />
                </div>
                <Field label="Nome (segue)" field="nome_segue" />
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Gruppo Compagnia" field="gruppo_compagnia" />
                  <Field label="Tipo Mandatario" field="tipo_mandatario" />
                  <Field label="Gruppo Statistico" field="gruppo_statistico" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Stato</Label>
                    <Input value={form.stato} onChange={(e) => setField("stato", e.target.value)} placeholder="Operativo" />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="sede" className="space-y-3 mt-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Indirizzo</Label>
                  <AddressAutocomplete
                    value={form.indirizzo}
                    onChange={(v) => setField("indirizzo", v)}
                    onSelect={(c) => { setField("cap", c.cap); setField("comune", c.citta); setField("provincia", c.provincia); }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="CAP" field="cap" />
                  <Field label="Comune" field="comune" />
                  <Field label="Provincia" field="provincia" placeholder="es. MI" />
                </div>
              </TabsContent>

              <TabsContent value="contatti" className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Telefono" field="telefono" />
                  <Field label="Fax" field="fax" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Mail" field="mail" />
                  <Field label="PEC" field="pec" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Mail Estratto Conto" field="mail_ec" />
                  <Field label="Mail Avvisi" field="mail_avvisi" />
                </div>
              </TabsContent>

              <TabsContent value="fiscale" className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Codice Fiscale" field="codice_fiscale" />
                  <Field label="Partita IVA" field="partita_iva" />
                </div>
                <Field label="% Ritenuta d'Acconto" field="percentuale_ra" placeholder="es. 23" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="IBAN" field="iban" />
                  <Field label="Intestato a" field="intestato_a" />
                </div>
              </TabsContent>
            </Tabs>
            <Button onClick={() => createMutation.mutate()} disabled={!form.nome || createMutation.isPending} className="w-full mt-4">
              Crea Compagnia
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main page tabs */}
      <Tabs defaultValue="anagrafica" className="w-full">
        <TabsList>
          <TabsTrigger value="anagrafica" className="gap-2">
            <Building2 className="w-4 h-4" />Anagrafica Compagnia
          </TabsTrigger>
          <TabsTrigger value="sinistri" className="gap-2">
            <ShieldAlert className="w-4 h-4" />Compagnie Sinistri
          </TabsTrigger>
        </TabsList>

        {/* === ANAGRAFICA COMPAGNIA === */}
        <TabsContent value="anagrafica" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Specificare il nome, anche parziale (vuoto = tutto)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca per nome..."
                      value={searchNome}
                      onChange={(e) => setSearchNome(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-40 space-y-1">
                  <Label className="text-xs text-muted-foreground">Oppure il codice iniziale</Label>
                  <Input
                    placeholder="Codice..."
                    value={searchCodice}
                    onChange={(e) => setSearchCodice(e.target.value)}
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() => { setSearchNome(""); setSearchCodice(""); }}
                >
                  Reset
                </Button>
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
                      <TableHead>Gruppo</TableHead>
                      <TableHead>Comune</TableHead>
                      <TableHead>Prov</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Attiva</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnagrafica.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-sm">{c.codice || "—"}</TableCell>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell>{c.gruppo_compagnia || "—"}</TableCell>
                        <TableCell>{c.comune || "—"}</TableCell>
                        <TableCell>{c.provincia || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={c.stato === "Operativo" ? "default" : "secondary"}>
                            {c.stato || (c.attiva ? "Operativo" : "Non operativo")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={c.attiva ?? true}
                            onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, attiva: v })}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredAnagrafica.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          Nessuna compagnia trovata
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === COMPAGNIE SINISTRI === */}
        <TabsContent value="sinistri" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Specificare il nome (anche parziale)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca compagnia..."
                      value={searchSinistri}
                      onChange={(e) => setSearchSinistri(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Button variant="secondary" onClick={() => setSearchSinistri("")}>
                  Reset
                </Button>
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
                      <TableRow key={c.id}>
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
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Nessuna compagnia trovata
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompagnieList;
