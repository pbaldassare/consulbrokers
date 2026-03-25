import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, Building2, Search, User } from "lucide-react";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import AiDocumentScanner from "@/components/AiDocumentScanner";
import type { DocumentType } from "@/components/AiDocumentScanner";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useToast } from "@/hooks/use-toast";

const ClientiList = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tipoTab, setTipoTab] = useState("privato");

  // Form state
  const [tipoCliente, setTipoCliente] = useState<"privato" | "azienda">("privato");
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [codiceFiscale, setCodiceFiscale] = useState("");
  const [dataNascita, setDataNascita] = useState("");
  const [luogoNascita, setLuogoNascita] = useState("");
  const [indirizzoResidenza, setIndirizzoResidenza] = useState("");
  const [capResidenza, setCapResidenza] = useState("");
  const [cittaResidenza, setCittaResidenza] = useState("");
  const [provinciaResidenza, setProvinciaResidenza] = useState("");
  const [ragioneSociale, setRagioneSociale] = useState("");
  const [partitaIva, setPartitaIva] = useState("");
  const [codiceFiscaleAzienda, setCodiceFiscaleAzienda] = useState("");
  const [codiceSdi, setCodiceSdi] = useState("");
  const [formaGiuridica, setFormaGiuridica] = useState("");
  const [indirizzoSede, setIndirizzoSede] = useState("");
  const [capSede, setCapSede] = useState("");
  const [cittaSede, setCittaSede] = useState("");
  const [provinciaSede, setProvinciaSede] = useState("");
  const [referenteNome, setReferenteNome] = useState("");
  const [referenteCognome, setReferenteCognome] = useState("");
  const [referenteTelefono, setReferenteTelefono] = useState("");
  const [referenteEmail, setReferenteEmail] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [pec, setPec] = useState("");
  const [gruppoFinanziarioId, setGruppoFinanziarioId] = useState("");
  const scannedFilesRef = useRef<{ file: File; documentType: string }[]>([]);

  const handleFileReady = useCallback((file: File, documentType: DocumentType) => {
    scannedFilesRef.current.push({ file, documentType });
  }, []);

  const uploadScannedFiles = useCallback(async (clienteId: string) => {
    const files = scannedFilesRef.current;
    if (files.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    for (const { file, documentType } of files) {
      const ts = Date.now();
      const path = `cliente/${clienteId}/${ts}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("documenti_clienti")
        .upload(path, file);
      if (uploadErr) {
        console.error("Upload error:", uploadErr);
        continue;
      }
      await supabase.from("documenti").insert({
        nome_file: file.name,
        path_storage: path,
        bucket_name: "documenti_clienti",
        entita_tipo: "cliente",
        entita_id: clienteId,
        caricato_da: userId,
        categoria: documentType,
      });
    }
    scannedFilesRef.current = [];
  }, []);

  const { data: clienti = [], isLoading } = useQuery({
    queryKey: ["clienti"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clienti")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: gruppiFinanziari = [] } = useQuery({
    queryKey: ["gruppi_finanziari_lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gruppi_finanziari" as any)
        .select("id, codice, nome")
        .eq("attivo", true)
        .order("codice");
      return (data || []) as any[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("clienti").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clienti"] }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        tipo_cliente: tipoCliente,
        email: email || null,
        telefono: telefono || null,
        pec: pec || null,
        gruppo_finanziario_id: gruppoFinanziarioId || null,
      };
      if (tipoCliente === "privato") {
        payload.nome = nome || null;
        payload.cognome = cognome || null;
        payload.codice_fiscale = codiceFiscale || null;
        payload.data_nascita = dataNascita || null;
        payload.luogo_nascita = luogoNascita || null;
        payload.indirizzo_residenza = indirizzoResidenza || null;
        payload.cap_residenza = capResidenza || null;
        payload.citta_residenza = cittaResidenza || null;
        payload.provincia_residenza = provinciaResidenza || null;
      } else {
        payload.ragione_sociale = ragioneSociale || null;
        payload.partita_iva = partitaIva || null;
        payload.codice_fiscale_azienda = codiceFiscaleAzienda || null;
        payload.codice_sdi = codiceSdi || null;
        payload.forma_giuridica = formaGiuridica || null;
        payload.indirizzo_sede = indirizzoSede || null;
        payload.cap_sede = capSede || null;
        payload.citta_sede = cittaSede || null;
        payload.provincia_sede = provinciaSede || null;
        payload.referente_nome = referenteNome || null;
        payload.referente_cognome = referenteCognome || null;
        payload.referente_telefono = referenteTelefono || null;
        payload.referente_email = referenteEmail || null;
      }
      const { data, error } = await supabase.from("clienti").insert(payload as any).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      if (data?.id) {
        await uploadScannedFiles(data.id);
      }
      queryClient.invalidateQueries({ queryKey: ["clienti"] });
      toast({ title: "Cliente creato con successo" });
      resetForm();
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setNome(""); setCognome(""); setCodiceFiscale(""); setDataNascita("");
    setLuogoNascita(""); setIndirizzoResidenza(""); setCapResidenza("");
    setCittaResidenza(""); setProvinciaResidenza(""); setRagioneSociale("");
    setPartitaIva(""); setCodiceFiscaleAzienda(""); setCodiceSdi("");
    setFormaGiuridica(""); setIndirizzoSede(""); setCapSede("");
    setCittaSede(""); setProvinciaSede(""); setReferenteNome("");
    setReferenteCognome(""); setReferenteTelefono(""); setReferenteEmail("");
    setEmail(""); setTelefono(""); setPec(""); setTipoCliente("privato");
    setGruppoFinanziarioId("");
    scannedFilesRef.current = [];
  };

  const filtered = clienti.filter((c) => {
    if (c.tipo_cliente !== tipoTab) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    if (c.tipo_cliente === "privato") {
      return (
        (c.nome?.toLowerCase().includes(s)) ||
        (c.cognome?.toLowerCase().includes(s)) ||
        (c.codice_fiscale?.toLowerCase().includes(s)) ||
        (c.email?.toLowerCase().includes(s))
      );
    }
    return (
      (c.ragione_sociale?.toLowerCase().includes(s)) ||
      (c.partita_iva?.toLowerCase().includes(s)) ||
      (c.email?.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clienti</h1>
          <p className="text-muted-foreground">Anagrafica clienti privati e aziende</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuovo Cliente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nuovo Cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tipo Cliente</Label>
                <Select value={tipoCliente} onValueChange={(v) => setTipoCliente(v as "privato" | "azienda")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="privato">Privato</SelectItem>
                    <SelectItem value="azienda">Azienda</SelectItem>
                  </SelectContent>
                </Select>
               </div>

              {/* AI Document Scanner */}
              {tipoCliente === "privato" ? (
                <div className="flex flex-wrap gap-2">
                  <AiDocumentScanner
                    documentType="carta_identita"
                    onFileReady={handleFileReady}
                    onExtracted={(data) => {
                      if (data.nome) setNome(data.nome as string);
                      if (data.cognome) setCognome(data.cognome as string);
                      if (data.codice_fiscale) setCodiceFiscale((data.codice_fiscale as string).toUpperCase());
                      if (data.data_nascita) setDataNascita(data.data_nascita as string);
                      if (data.luogo_nascita) setLuogoNascita(data.luogo_nascita as string);
                      if (data.indirizzo) setIndirizzoResidenza(data.indirizzo as string);
                      if (data.cap) setCapResidenza(data.cap as string);
                      if (data.citta) setCittaResidenza(data.citta as string);
                      if (data.provincia) setProvinciaResidenza((data.provincia as string).toUpperCase());
                    }}
                  />
                  <AiDocumentScanner
                    documentType="tessera_sanitaria"
                    onFileReady={handleFileReady}
                    onExtracted={(data) => {
                      if (data.codice_fiscale) setCodiceFiscale((data.codice_fiscale as string).toUpperCase());
                      if (data.nome) setNome(data.nome as string);
                      if (data.cognome) setCognome(data.cognome as string);
                      if (data.data_nascita) setDataNascita(data.data_nascita as string);
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <AiDocumentScanner
                    documentType="visura_camerale"
                    onFileReady={handleFileReady}
                    onExtracted={(data) => {
                      if (data.ragione_sociale) setRagioneSociale(data.ragione_sociale as string);
                      if (data.partita_iva) setPartitaIva(data.partita_iva as string);
                      if (data.codice_fiscale) setCodiceFiscaleAzienda((data.codice_fiscale as string).toUpperCase());
                      if (data.codice_sdi) setCodiceSdi(data.codice_sdi as string);
                      if (data.forma_giuridica) {
                        const fg = (data.forma_giuridica as string).toLowerCase().replace(/\s/g, "_");
                        setFormaGiuridica(fg);
                      }
                      if (data.indirizzo_sede) setIndirizzoSede(data.indirizzo_sede as string);
                      if (data.cap) setCapSede(data.cap as string);
                      if (data.citta) setCittaSede(data.citta as string);
                      if (data.provincia) setProvinciaSede((data.provincia as string).toUpperCase());
                      if (data.pec) setPec(data.pec as string);
                    }}
                  />
                </div>
              )}

              {tipoCliente === "privato" ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                    <div><Label>Cognome</Label><Input value={cognome} onChange={(e) => setCognome(e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Codice Fiscale</Label><Input value={codiceFiscale} onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())} maxLength={16} /></div>
                    <div><Label>Data di Nascita</Label><Input type="date" value={dataNascita} onChange={(e) => setDataNascita(e.target.value)} /></div>
                  </div>
                  <div><Label>Luogo di Nascita</Label><Input value={luogoNascita} onChange={(e) => setLuogoNascita(e.target.value)} /></div>
                  <div><Label>Indirizzo Residenza</Label><AddressAutocomplete value={indirizzoResidenza} onChange={setIndirizzoResidenza} onSelect={(c) => { setCapResidenza(c.cap); setCittaResidenza(c.citta); setProvinciaResidenza(c.provincia); }} /></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><Label>CAP</Label><Input value={capResidenza} onChange={(e) => setCapResidenza(e.target.value)} maxLength={5} /></div>
                    <div><Label>Città</Label><Input value={cittaResidenza} onChange={(e) => setCittaResidenza(e.target.value)} /></div>
                    <div><Label>Provincia</Label><Input value={provinciaResidenza} onChange={(e) => setProvinciaResidenza(e.target.value)} maxLength={2} /></div>
                  </div>
                </>
              ) : (
                <>
                  <div><Label>Ragione Sociale</Label><Input value={ragioneSociale} onChange={(e) => setRagioneSociale(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Partita IVA</Label><Input value={partitaIva} onChange={(e) => setPartitaIva(e.target.value)} maxLength={11} /></div>
                    <div><Label>Codice Fiscale Azienda</Label><Input value={codiceFiscaleAzienda} onChange={(e) => setCodiceFiscaleAzienda(e.target.value.toUpperCase())} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Codice SDI</Label><Input value={codiceSdi} onChange={(e) => setCodiceSdi(e.target.value)} maxLength={7} /></div>
                    <div>
                      <Label>Forma Giuridica</Label>
                      <Select value={formaGiuridica} onValueChange={setFormaGiuridica}>
                        <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="srl">SRL</SelectItem>
                          <SelectItem value="srls">SRLS</SelectItem>
                          <SelectItem value="spa">SPA</SelectItem>
                          <SelectItem value="snc">SNC</SelectItem>
                          <SelectItem value="sas">SAS</SelectItem>
                          <SelectItem value="ditta_individuale">Ditta Individuale</SelectItem>
                          <SelectItem value="cooperativa">Cooperativa</SelectItem>
                          <SelectItem value="altro">Altro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Indirizzo Sede</Label><AddressAutocomplete value={indirizzoSede} onChange={setIndirizzoSede} onSelect={(c) => { setCapSede(c.cap); setCittaSede(c.citta); setProvinciaSede(c.provincia); }} /></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><Label>CAP</Label><Input value={capSede} onChange={(e) => setCapSede(e.target.value)} maxLength={5} /></div>
                    <div><Label>Città</Label><Input value={cittaSede} onChange={(e) => setCittaSede(e.target.value)} /></div>
                    <div><Label>Provincia</Label><Input value={provinciaSede} onChange={(e) => setProvinciaSede(e.target.value)} maxLength={2} /></div>
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Referente Aziendale</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Nome Referente</Label><Input value={referenteNome} onChange={(e) => setReferenteNome(e.target.value)} /></div>
                      <div><Label>Cognome Referente</Label><Input value={referenteCognome} onChange={(e) => setReferenteCognome(e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div><Label>Telefono Referente</Label><Input value={referenteTelefono} onChange={(e) => setReferenteTelefono(e.target.value)} /></div>
                      <div><Label>Email Referente</Label><Input type="email" value={referenteEmail} onChange={(e) => setReferenteEmail(e.target.value)} /></div>
                    </div>
                  </div>
                </>
              )}

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Contatti</p>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div><Label>Telefono</Label><Input value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
                  <div><Label>PEC</Label><Input type="email" value={pec} onChange={(e) => setPec(e.target.value)} /></div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Clienti ({filtered.length})
            </CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per nome, CF, P.IVA..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tipoTab} onValueChange={setTipoTab}>
            <TabsList>
              <TabsTrigger value="privato" className="gap-2">
                <User className="w-4 h-4" />Privati
              </TabsTrigger>
              <TabsTrigger value="azienda" className="gap-2">
                <Building2 className="w-4 h-4" />Aziende
              </TabsTrigger>
            </TabsList>

            <TabsContent value="privato">
              {isLoading ? (
                <p className="text-muted-foreground py-4">Caricamento...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cognome</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Codice Fiscale</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefono</TableHead>
                      <TableHead>Città</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Attivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/archivi/clienti/${c.id}`)}>
                        <TableCell className="font-medium">{c.cognome || "—"}</TableCell>
                        <TableCell>{c.nome || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{c.codice_fiscale || "—"}</TableCell>
                        <TableCell>{c.email || "—"}</TableCell>
                        <TableCell>{c.telefono || "—"}</TableCell>
                        <TableCell>{c.citta_residenza || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={c.attivo ? "default" : "secondary"}>
                            {c.attivo ? "Attivo" : "Disattivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={c.attivo ?? true}
                            onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, attivo: v })}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Nessun cliente privato trovato
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="azienda">
              {isLoading ? (
                <p className="text-muted-foreground py-4">Caricamento...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ragione Sociale</TableHead>
                      <TableHead>Partita IVA</TableHead>
                      <TableHead>Codice SDI</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>PEC</TableHead>
                      <TableHead>Città</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Attivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/archivi/clienti/${c.id}`)}>
                        <TableCell className="font-medium">{c.ragione_sociale || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{c.partita_iva || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{c.codice_sdi || "—"}</TableCell>
                        <TableCell>{c.email || "—"}</TableCell>
                        <TableCell>{c.pec || "—"}</TableCell>
                        <TableCell>{c.citta_sede || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={c.attivo ? "default" : "secondary"}>
                            {c.attivo ? "Attivo" : "Disattivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={c.attivo ?? true}
                            onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, attivo: v })}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Nessuna azienda trovata
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientiList;
