import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, Building2 } from "lucide-react";
import DocumentiTab from "@/components/DocumentiTab";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import AiDocumentScanner from "@/components/AiDocumentScanner";
import type { DocumentType } from "@/components/AiDocumentScanner";
import { toast } from "sonner";

export default function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

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

  if (!cliente) return null;

  const isPrivato = cliente.tipo_cliente === "privato";
  const displayName = isPrivato
    ? `${cliente.cognome || ""} ${cliente.nome || ""}`.trim() || "—"
    : cliente.ragione_sociale || "—";

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

      <Tabs defaultValue="documenti">
        <TabsList>
          <TabsTrigger value="documenti">Documenti</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="documenti" className="space-y-4">
          {/* AI Scanner per caricare documenti con estrazione dati */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scansione AI Documenti</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {isPrivato ? (
                  <>
                    <AiDocumentScanner
                      documentType="carta_identita"
                      onFileReady={handleScanUpload}
                      onExtracted={() => {}}
                      label="Scansiona Carta d'Identità"
                    />
                    <AiDocumentScanner
                      documentType="tessera_sanitaria"
                      onFileReady={handleScanUpload}
                      onExtracted={() => {}}
                      label="Scansiona Tessera Sanitaria"
                    />
                  </>
                ) : (
                  <AiDocumentScanner
                    documentType="visura_camerale"
                    onFileReady={handleScanUpload}
                    onExtracted={() => {}}
                    label="Scansiona Visura Camerale"
                  />
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
    </div>
  );
}