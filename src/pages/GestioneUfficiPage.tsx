import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Plus, Users, Briefcase, Pencil, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  const { data: counts = {} } = useQuery({
    queryKey: ["uffici-counts"],
    queryFn: async () => {
      const [profilesRes, clientiRes, anagRes] = await Promise.all([
        supabase.from("profiles").select("ufficio_id"),
        supabase.from("clienti").select("ufficio_id"),
        supabase.from("anagrafiche_professionali").select("ufficio_id, tipo"),
      ]);

      const result: Record<string, { utenti: number; clienti: number; anagrafiche: number; produttori: number }> = {};
      const initEntry = (uid: string) => {
        if (!result[uid]) result[uid] = { utenti: 0, clienti: 0, anagrafiche: 0, produttori: 0 };
      };
      (profilesRes.data || []).forEach((p: any) => {
        if (p.ufficio_id) { initEntry(p.ufficio_id); result[p.ufficio_id].utenti++; }
      });
      (clientiRes.data || []).forEach((c: any) => {
        if (c.ufficio_id) { initEntry(c.ufficio_id); result[c.ufficio_id].clienti++; }
      });
      (anagRes.data || []).forEach((a: any) => {
        if (a.ufficio_id) {
          initEntry(a.ufficio_id);
          result[a.ufficio_id].anagrafiche++;
          if (a.tipo === "account_executive" || a.tipo === "corrispondente") {
            result[a.ufficio_id].produttori++;
          }
        }
      });
      return result;
    },
  });

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Totale Uffici</p><p className="text-2xl font-bold text-foreground">{uffici.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Attivi</p><p className="text-2xl font-bold text-primary">{uffici.filter(u => u.attivo).length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Disattivi</p><p className="text-2xl font-bold text-destructive">{uffici.filter(u => !u.attivo).length}</p></CardContent></Card>
      </div>

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
                  <TableHead className="text-center">Produttori</TableHead>
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
                    <TableCell className="text-center">{counts[u.id]?.produttori || 0}</TableCell>
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
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nessun ufficio trovato</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedUfficio && <UfficioDetail ufficio={selectedUfficio} uffici={uffici} />}

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

const UfficioDetail = ({ ufficio, uffici }: { ufficio: Ufficio; uffici: Ufficio[] }) => {
  const queryClient = useQueryClient();

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

  const { data: produttori = [] } = useQuery({
    queryKey: ["ufficio-produttori", ufficio.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, tipo, cognome, nome, codice, sigla, email, ragione_sociale")
        .eq("ufficio_id", ufficio.id)
        .in("tipo", ["account_executive", "corrispondente"]);
      return data || [];
    },
  });

  const reassignMutation = useMutation({
    mutationFn: async ({ id, newUfficioId }: { id: string; newUfficioId: string }) => {
      const { error } = await supabase.from("anagrafiche_professionali").update({ ufficio_id: newUfficioId }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ufficio-produttori"] });
      queryClient.invalidateQueries({ queryKey: ["ufficio-anagrafiche"] });
      queryClient.invalidateQueries({ queryKey: ["uffici-counts"] });
      toast.success("Produttore riassegnato");
    },
    onError: (err: any) => toast.error(err.message),
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
            <TabsTrigger value="produttori"><UserCheck className="w-4 h-4 mr-1" /> Produttori ({produttori.length})</TabsTrigger>
            <TabsTrigger value="anagrafiche"><Briefcase className="w-4 h-4 mr-1" /> Anagrafiche ({anagrafiche.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="utenti">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Nome</TableHead><TableHead>Cognome</TableHead><TableHead>Ruolo</TableHead><TableHead>Email</TableHead>
              </TableRow></TableHeader>
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
              <TableHeader><TableRow>
                <TableHead>Cognome/Ragione Sociale</TableHead><TableHead>Nome</TableHead><TableHead>Tipo</TableHead>
              </TableRow></TableHeader>
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

          <TabsContent value="produttori">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Codice</TableHead><TableHead>Tipo</TableHead><TableHead>Nominativo</TableHead><TableHead>Sigla</TableHead><TableHead>Email</TableHead><TableHead>Riassegna a</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {produttori.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.codice || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{p.tipo === "account_executive" ? "AE" : "Corr."}</Badge></TableCell>
                    <TableCell className="font-medium">{p.ragione_sociale || [p.cognome, p.nome].filter(Boolean).join(" ") || "—"}</TableCell>
                    <TableCell>{p.sigla || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email || "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={ufficio.id}
                        onValueChange={(v) => {
                          if (v !== ufficio.id) reassignMutation.mutate({ id: p.id, newUfficioId: v });
                        }}
                      >
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {uffici.filter(u => u.attivo).map((u) => (
                            <SelectItem key={u.id} value={u.id}>{u.codice_ufficio} — {u.nome_ufficio}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                {produttori.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Nessun produttore collegato</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="anagrafiche">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Codice</TableHead><TableHead>Tipo</TableHead><TableHead>Cognome</TableHead><TableHead>Nome</TableHead><TableHead>Email</TableHead>
              </TableRow></TableHeader>
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