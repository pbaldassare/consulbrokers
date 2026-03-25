import { useState } from "react";
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
import { ArrowLeft, User, Building2, Plus, Link2, FileText } from "lucide-react";
import DocumentiTab from "@/components/DocumentiTab";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import AiDocumentScanner from "@/components/AiDocumentScanner";
import type { DocumentType } from "@/components/AiDocumentScanner";
import { toast } from "sonner";

const tipiRelazione = [
  { value: "dipendente", label: "Dipendente" },
  { value: "legale_rappresentante", label: "Legale Rappresentante" },
  { value: "referente", label: "Referente" },
  { value: "socio", label: "Socio" },
];

export default function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [relazioneOpen, setRelazioneOpen] = useState(false);
  const [searchCliente, setSearchCliente] = useState("");
  const [selectedCollegatoId, setSelectedCollegatoId] = useState("");
  const [tipoRelazione, setTipoRelazione] = useState("referente");
  const [noteRelazione, setNoteRelazione] = useState("");

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

  // Relazioni (sia come cliente_id che come cliente_collegato_id)
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
        result.push({
          id: r.id,
          tipo_relazione: r.tipo_relazione,
          note: r.note,
          collegato: r.clienti_collegato,
        });
      });
      (rel2 || []).forEach((r: any) => {
        result.push({
          id: r.id,
          tipo_relazione: r.tipo_relazione,
          note: r.note,
          collegato: r.clienti_origine,
        });
      });
      return result;
    },
    enabled: !!id,
  });

  // Search clienti for relazione dialog
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
      const { error: uploadErr } = await supabase.storage
        .from("documenti_clienti")
        .upload(path, file);
      if (uploadErr) throw uploadErr;
      await supabase.from("documenti").insert({
        nome_file: file.name,
        path_storage: path,
        bucket_name: "documenti_clienti",
        entita_tipo: "cliente",
        entita_id: id!,
        caricato_da: user?.id,
        categoria: documentType,
      });
      toast.success("Documento scansionato e salvato");
    } catch (err: any) {
      toast.error("Errore salvataggio documento: " + err.message);
    }
  };

  // Auto-provision user when client has no user_id and has email
  const provisionMutation = useMutation({
    mutationFn: async (clienteId: string) => {
      const { data, error } = await supabase.functions.invoke("create-cliente-user", {
        body: { cliente_id: clienteId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", id] });
      toast.success("Account cliente creato automaticamente");
    },
    onError: (err: any) => {
      console.error("Provisioning error:", err.message);
    },
  });

  // Trigger provisioning once when client loads without user_id
  useState(() => {
    if (cliente && !cliente.user_id && cliente.email) {
      provisionMutation.mutate(cliente.id);
    }
  });

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
      </div>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dati Anagrafici</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {isPrivato ? (
              <>
                <div><span className="text-muted-foreground">Codice Fiscale</span><p className="font-mono">{cliente.codice_fiscale || "—"}</p></div>
                <div><span className="text-muted-foreground">Data di Nascita</span><p>{cliente.data_nascita || "—"}</p></div>
                <div><span className="text-muted-foreground">Luogo di Nascita</span><p>{cliente.luogo_nascita || "—"}</p></div>
                <div><span className="text-muted-foreground">Indirizzo</span><p>{cliente.indirizzo_residenza || "—"}</p></div>
                <div><span className="text-muted-foreground">Città</span><p>{cliente.citta_residenza || "—"} {cliente.provincia_residenza ? `(${cliente.provincia_residenza})` : ""}</p></div>
                <div><span className="text-muted-foreground">CAP</span><p>{cliente.cap_residenza || "—"}</p></div>
              </>
            ) : (
              <>
                <div><span className="text-muted-foreground">Partita IVA</span><p className="font-mono">{cliente.partita_iva || "—"}</p></div>
                <div><span className="text-muted-foreground">Codice Fiscale</span><p className="font-mono">{cliente.codice_fiscale_azienda || "—"}</p></div>
                <div><span className="text-muted-foreground">Codice SDI</span><p className="font-mono">{cliente.codice_sdi || "—"}</p></div>
                <div><span className="text-muted-foreground">Forma Giuridica</span><p>{cliente.forma_giuridica?.toUpperCase() || "—"}</p></div>
                <div><span className="text-muted-foreground">Sede</span><p>{cliente.indirizzo_sede || "—"}</p></div>
                <div><span className="text-muted-foreground">Città</span><p>{cliente.citta_sede || "—"} {cliente.provincia_sede ? `(${cliente.provincia_sede})` : ""}</p></div>
              </>
            )}
            <div><span className="text-muted-foreground">Email</span><p>{cliente.email || "—"}</p></div>
            <div><span className="text-muted-foreground">Telefono</span><p>{cliente.telefono || "—"}</p></div>
            <div><span className="text-muted-foreground">PEC</span><p>{cliente.pec || "—"}</p></div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="polizze">
        <TabsList>
          <TabsTrigger value="polizze">
            <FileText className="w-4 h-4 mr-1" />Polizze ({polizze.length})
          </TabsTrigger>
          <TabsTrigger value="relazioni">
            <Link2 className="w-4 h-4 mr-1" />{isPrivato ? "Aziende" : "Persone"} ({relazioni.length})
          </TabsTrigger>
          <TabsTrigger value="documenti">Documenti</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* TAB POLIZZE */}
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
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/titoli/${p.id}`)}
                      >
                        <TableCell className="font-medium">{p.numero_titolo || "—"}</TableCell>
                        <TableCell>{p.prodotti?.nome_prodotto || "—"}</TableCell>
                        <TableCell>{p.prodotti?.compagnie?.nome || "—"}</TableCell>
                        <TableCell className="font-mono">{p.premio_lordo?.toFixed(2) ?? "—"}</TableCell>
                        <TableCell className="font-mono">{p.importo_incassato?.toFixed(2) ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={p.stato === "incassato" ? "default" : p.stato === "stornato" ? "destructive" : "secondary"}>
                            {p.stato}
                          </Badge>
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

        {/* TAB RELAZIONI */}
        <TabsContent value="relazioni">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">{isPrivato ? "Aziende Collegate" : "Persone Collegate"}</CardTitle>
              <Button size="sm" onClick={() => setRelazioneOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />Aggiungi
              </Button>
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
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/archivi/clienti/${r.collegato?.id}`)}
                      >
                        <TableCell className="font-medium">{getClienteDisplayName(r.collegato)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {r.collegato?.tipo_cliente === "privato" ? "Privato" : "Azienda"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {tipiRelazione.find(t => t.value === r.tipo_relazione)?.label || r.tipo_relazione}
                          </Badge>
                        </TableCell>
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
            <CardHeader>
              <CardTitle className="text-base">Scansione AI Documenti</CardTitle>
            </CardHeader>
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

        <TabsContent value="chat">
          <ChatTab entitaTipo="cliente" entitaId={id!} />
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineTab entitaTipo="cliente" entitaId={id!} />
        </TabsContent>
      </Tabs>

      {/* Dialog Aggiungi Relazione */}
      <Dialog open={relazioneOpen} onOpenChange={setRelazioneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi Relazione</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cerca Cliente / Azienda</Label>
              <Input
                placeholder="Nome, cognome o ragione sociale..."
                value={searchCliente}
                onChange={(e) => setSearchCliente(e.target.value)}
              />
              {clientiSearch.length > 0 && (
                <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                  {clientiSearch.map((c: any) => (
                    <div
                      key={c.id}
                      className={`px-3 py-2 cursor-pointer hover:bg-muted text-sm ${selectedCollegatoId === c.id ? "bg-primary/10 font-medium" : ""}`}
                      onClick={() => {
                        setSelectedCollegatoId(c.id);
                        setSearchCliente(getClienteDisplayName(c));
                      }}
                    >
                      {getClienteDisplayName(c)}
                      <span className="text-muted-foreground ml-2">
                        ({c.tipo_cliente === "privato" ? "Privato" : "Azienda"})
                      </span>
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
                  {tipiRelazione.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Note (opzionale)</Label>
              <Input value={noteRelazione} onChange={(e) => setNoteRelazione(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addRelazioneMutation.mutate()}
              disabled={!selectedCollegatoId || addRelazioneMutation.isPending}
            >
              Aggiungi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
