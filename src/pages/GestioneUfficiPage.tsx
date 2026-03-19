import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Plus, Users, Briefcase, Settings, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Ufficio {
  id: string;
  codice_ufficio: string;
  nome_ufficio: string;
  attivo: boolean;
  created_at: string;
}

const GestioneUfficiPage = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUfficio, setEditingUfficio] = useState<Ufficio | null>(null);
  const [selectedUfficio, setSelectedUfficio] = useState<Ufficio | null>(null);
  const [formData, setFormData] = useState({ codice_ufficio: "", nome_ufficio: "", attivo: true });

  // Fetch uffici
  const { data: uffici = [], isLoading } = useQuery({
    queryKey: ["uffici"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uffici" as any)
        .select("*")
        .order("codice_ufficio");
      if (error) throw error;
      return (data || []) as unknown as Ufficio[];
    },
  });

  // Fetch counts per ufficio
  const { data: counts = {} } = useQuery({
    queryKey: ["uffici-counts"],
    queryFn: async () => {
      const [profilesRes, clientiRes, anagRes] = await Promise.all([
        supabase.from("profiles").select("ufficio_id"),
        supabase.from("clienti").select("ufficio_id"),
        supabase.from("anagrafiche_professionali").select("ufficio_id"),
      ]);

      const result: Record<string, { utenti: number; clienti: number; anagrafiche: number }> = {};
      (profilesRes.data || []).forEach((p: any) => {
        if (p.ufficio_id) {
          if (!result[p.ufficio_id]) result[p.ufficio_id] = { utenti: 0, clienti: 0, anagrafiche: 0 };
          result[p.ufficio_id].utenti++;
        }
      });
      (clientiRes.data || []).forEach((c: any) => {
        if (c.ufficio_id) {
          if (!result[c.ufficio_id]) result[c.ufficio_id] = { utenti: 0, clienti: 0, anagrafiche: 0 };
          result[c.ufficio_id].clienti++;
        }
      });
      (anagRes.data || []).forEach((a: any) => {
        if (a.ufficio_id) {
          if (!result[a.ufficio_id]) result[a.ufficio_id] = { utenti: 0, clienti: 0, anagrafiche: 0 };
          result[a.ufficio_id].anagrafiche++;
        }
      });
      return result;
    },
  });

  // Upsert mutation
  const upsertMutation = useMutation({
    mutationFn: async (data: { id?: string; codice_ufficio: string; nome_ufficio: string; attivo: boolean }) => {
      if (data.id) {
        const { error } = await supabase
          .from("uffici" as any)
          .update({ codice_ufficio: data.codice_ufficio, nome_ufficio: data.nome_ufficio, attivo: data.attivo })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("uffici" as any)
          .insert({ codice_ufficio: data.codice_ufficio, nome_ufficio: data.nome_ufficio, attivo: data.attivo });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uffici"] });
      toast.success(editingUfficio ? "Ufficio aggiornato" : "Ufficio creato");
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openCreateDialog = () => {
    setEditingUfficio(null);
    setFormData({ codice_ufficio: "", nome_ufficio: "", attivo: true });
    setDialogOpen(true);
  };

  const openEditDialog = (u: Ufficio) => {
    setEditingUfficio(u);
    setFormData({ codice_ufficio: u.codice_ufficio, nome_ufficio: u.nome_ufficio, attivo: u.attivo });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingUfficio(null);
  };

  const handleSave = () => {
    if (!formData.codice_ufficio.trim() || !formData.nome_ufficio.trim()) {
      toast.error("Compilare tutti i campi obbligatori");
      return;
    }
    upsertMutation.mutate({ id: editingUfficio?.id, ...formData });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6" /> Gestione Uffici
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gestisci gli uffici e le entità collegate</p>
        </div>
        <Button onClick={openCreateDialog}><Plus className="w-4 h-4 mr-2" /> Nuovo Ufficio</Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Totale Uffici</p><p className="text-2xl font-bold text-foreground">{uffici.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Attivi</p><p className="text-2xl font-bold text-primary">{uffici.filter(u => u.attivo).length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Disattivi</p><p className="text-2xl font-bold text-destructive">{uffici.filter(u => !u.attivo).length}</p></CardContent></Card>
      </div>

      {/* Lista Uffici */}
      <Card>
        <CardHeader><CardTitle>Elenco Uffici</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Caricamento...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Nome Ufficio</TableHead>
                  <TableHead className="text-center">Utenti</TableHead>
                  <TableHead className="text-center">Clienti</TableHead>
                  <TableHead className="text-center">Anagrafiche</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uffici.map((u) => (
                  <TableRow
                    key={u.id}
                    className={`cursor-pointer ${selectedUfficio?.id === u.id ? "bg-muted" : ""}`}
                    onClick={() => setSelectedUfficio(selectedUfficio?.id === u.id ? null : u)}
                  >
                    <TableCell className="font-mono font-medium">{u.codice_ufficio}</TableCell>
                    <TableCell className="font-medium">{u.nome_ufficio}</TableCell>
                    <TableCell className="text-center">{counts[u.id]?.utenti || 0}</TableCell>
                    <TableCell className="text-center">{counts[u.id]?.clienti || 0}</TableCell>
                    <TableCell className="text-center">{counts[u.id]?.anagrafiche || 0}</TableCell>
                    <TableCell>
                      <Badge variant={u.attivo ? "default" : "secondary"}>
                        {u.attivo ? "Attivo" : "Disattivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditDialog(u); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {uffici.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nessun ufficio trovato</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dettaglio Ufficio Selezionato */}
      {selectedUfficio && <UfficioDetail ufficio={selectedUfficio} />}

      {/* Dialog Crea/Modifica */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUfficio ? "Modifica Ufficio" : "Nuovo Ufficio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Codice Ufficio *</Label>
              <Input value={formData.codice_ufficio} onChange={(e) => setFormData({ ...formData, codice_ufficio: e.target.value })} placeholder="es. UFF001" />
            </div>
            <div>
              <Label>Nome Ufficio *</Label>
              <Input value={formData.nome_ufficio} onChange={(e) => setFormData({ ...formData, nome_ufficio: e.target.value })} placeholder="es. Ufficio Milano" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formData.attivo} onCheckedChange={(v) => setFormData({ ...formData, attivo: v })} />
              <Label>Attivo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Annulla</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Sub-component: detail tabs for selected ufficio
const UfficioDetail = ({ ufficio }: { ufficio: Ufficio }) => {
  const { data: utenti = [] } = useQuery({
    queryKey: ["ufficio-utenti", ufficio.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, cognome, ruolo, email").eq("ufficio_id", ufficio.id);
      return data || [];
    },
  });

  const { data: clienti = [] } = useQuery({
    queryKey: ["ufficio-clienti", ufficio.id],
    queryFn: async () => {
      const { data } = await supabase.from("clienti").select("id, cognome, nome, ragione_sociale, tipo_cliente").eq("ufficio_id", ufficio.id).limit(100);
      return data || [];
    },
  });

  const { data: anagrafiche = [] } = useQuery({
    queryKey: ["ufficio-anagrafiche", ufficio.id],
    queryFn: async () => {
      const { data } = await supabase.from("anagrafiche_professionali").select("id, tipo, cognome, nome, codice, email").eq("ufficio_id", ufficio.id);
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Dettaglio: {ufficio.nome_ufficio} ({ufficio.codice_ufficio})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="utenti">
          <TabsList>
            <TabsTrigger value="utenti"><Users className="w-4 h-4 mr-1" /> Utenti ({utenti.length})</TabsTrigger>
            <TabsTrigger value="clienti"><Users className="w-4 h-4 mr-1" /> Clienti ({clienti.length})</TabsTrigger>
            <TabsTrigger value="anagrafiche"><Briefcase className="w-4 h-4 mr-1" /> Anagrafiche ({anagrafiche.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="utenti">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cognome</TableHead>
                  <TableHead>Ruolo</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {utenti.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.nome || "—"}</TableCell>
                    <TableCell>{u.cognome || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{u.ruolo || "—"}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                  </TableRow>
                ))}
                {utenti.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Nessun utente collegato</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="clienti">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cognome/Ragione Sociale</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clienti.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.cognome || c.ragione_sociale || "—"}</TableCell>
                    <TableCell>{c.nome || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{c.tipo_cliente}</Badge></TableCell>
                  </TableRow>
                ))}
                {clienti.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Nessun cliente collegato</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="anagrafiche">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cognome</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anagrafiche.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono">{a.codice || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{a.tipo}</Badge></TableCell>
                    <TableCell>{a.cognome || "—"}</TableCell>
                    <TableCell>{a.nome || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{a.email || "—"}</TableCell>
                  </TableRow>
                ))}
                {anagrafiche.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Nessuna anagrafica collegata</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default GestioneUfficiPage;
