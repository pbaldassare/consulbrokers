import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Plus, Users, Briefcase, Pencil, UserCheck, Mail, Phone, MapPin } from "lucide-react";
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
import AddressAutocomplete from "@/components/AddressAutocomplete";

interface Ufficio {
  id: string;
  codice_ufficio: string;
  nome_ufficio: string;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  email: string | null;
  telefono: string | null;
  attivo: boolean;
  created_at: string;
}

interface SediManagerProps {
  /** Quando true mostra l'header con titolo "Gestione Sedi". Default true (route legacy). */
  showHeader?: boolean;
}

const composeIndirizzoFull = (u: Pick<Ufficio, "indirizzo" | "cap" | "citta" | "provincia">) => {
  const cityPart = [u.cap, u.citta].filter(Boolean).join(" ");
  const tail = [cityPart, u.provincia ? `(${u.provincia})` : ""].filter(Boolean).join(" ");
  return [u.indirizzo, tail].filter(Boolean).join(", ");
};

const SediManager = ({ showHeader = true }: SediManagerProps) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUfficio, setEditingUfficio] = useState<Ufficio | null>(null);
  const [selectedUfficio, setSelectedUfficio] = useState<Ufficio | null>(null);
  const [formData, setFormData] = useState({ codice_ufficio: "", nome_ufficio: "", indirizzo: "", cap: "", citta: "", provincia: "", email: "", telefono: "", attivo: true });

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
    mutationFn: async (data: { id?: string; codice_ufficio: string; nome_ufficio: string; indirizzo: string; cap: string; citta: string; provincia: string; email: string; telefono: string; attivo: boolean }) => {
      const payload = {
        codice_ufficio: data.codice_ufficio,
        nome_ufficio: data.nome_ufficio,
        indirizzo: data.indirizzo || null,
        cap: data.cap || null,
        citta: data.citta || null,
        provincia: data.provincia ? data.provincia.toUpperCase() : null,
        email: data.email || null,
        telefono: data.telefono || null,
        attivo: data.attivo,
      };
      if (data.id) {
        const { error } = await supabase.from("uffici" as any).update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("uffici" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uffici"] });
      toast.success(editingUfficio ? "Sede aggiornata" : "Sede creata");
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openCreateDialog = () => {
    setEditingUfficio(null);
    setFormData({ codice_ufficio: "", nome_ufficio: "", indirizzo: "", cap: "", citta: "", provincia: "", email: "", telefono: "", attivo: true });
    setDialogOpen(true);
  };

  const openEditDialog = (u: Ufficio) => {
    setEditingUfficio(u);
    setFormData({
      codice_ufficio: u.codice_ufficio || "",
      nome_ufficio: u.nome_ufficio || "",
      indirizzo: u.indirizzo || "",
      cap: u.cap || "",
      citta: u.citta || "",
      provincia: u.provincia || "",
      email: u.email || "",
      telefono: u.telefono || "",
      attivo: u.attivo,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingUfficio(null);
  };

  const handleSave = () => {
    const codice = (formData.codice_ufficio || "").trim();
    const nome = (formData.nome_ufficio || "").trim();
    if (!codice || !nome) {
      toast.error("Compilare codice e nome sede");
      return;
    }
    upsertMutation.mutate({
      id: editingUfficio?.id,
      ...formData,
      codice_ufficio: codice,
      nome_ufficio: nome,
    });
  };

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-5 h-5" /> Gestione Sedi
            </h2>
            <p className="text-muted-foreground text-sm mt-1">Gestisci le sedi e le entità collegate</p>
          </div>
          <Button onClick={openCreateDialog}><Plus className="w-4 h-4 mr-2" /> Nuova Sede</Button>
        </div>
      )}

      {!showHeader && (
        <div className="flex justify-end">
          <Button onClick={openCreateDialog}><Plus className="w-4 h-4 mr-2" /> Nuova Sede</Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Totale Sedi</p><p className="text-2xl font-bold text-foreground">{uffici.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Attive</p><p className="text-2xl font-bold text-primary">{uffici.filter(u => u.attivo).length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Disattive</p><p className="text-2xl font-bold text-destructive">{uffici.filter(u => !u.attivo).length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Elenco Sedi</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Caricamento...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Nome Sede</TableHead>
                  <TableHead>Indirizzo</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead className="text-center">Utenti</TableHead>
                  <TableHead className="text-center">Clienti</TableHead>
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
                    <TableCell className="text-sm text-muted-foreground max-w-[260px] truncate">{composeIndirizzoFull(u) || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.telefono || "—"}</TableCell>
                    <TableCell className="text-center">{counts[u.id]?.utenti || 0}</TableCell>
                    <TableCell className="text-center">{counts[u.id]?.clienti || 0}</TableCell>
                    <TableCell>
                      <Badge variant={u.attivo ? "default" : "secondary"}>
                        {u.attivo ? "Attiva" : "Disattiva"}
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
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nessuna sede trovata</TableCell></TableRow>
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
            <DialogTitle>{editingUfficio ? "Modifica Sede" : "Nuova Sede"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Codice Sede *</Label>
              <Input value={formData.codice_ufficio ?? ""} onChange={(e) => setFormData({ ...formData, codice_ufficio: e.target.value })} placeholder="es. NAP, SDO" />
            </div>
            <div>
              <Label>Nome Sede *</Label>
              <Input value={formData.nome_ufficio} onChange={(e) => setFormData({ ...formData, nome_ufficio: e.target.value })} placeholder="es. Sede Milano" />
            </div>
            <div>
              <Label className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Indirizzo (via e civico)</Label>
              <AddressAutocomplete
                value={formData.indirizzo}
                onChange={(v) => setFormData({ ...formData, indirizzo: v })}
                onSelect={(c) => setFormData({
                  ...formData,
                  indirizzo: c.indirizzo || formData.indirizzo,
                  cap: c.cap || formData.cap,
                  citta: c.citta || formData.citta,
                  provincia: (c.provincia || formData.provincia || "").toUpperCase(),
                })}
                placeholder="es. Via Roma 1"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>CAP</Label>
                <Input
                  value={formData.cap}
                  onChange={(e) => setFormData({ ...formData, cap: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                  placeholder="20121"
                  inputMode="numeric"
                  maxLength={5}
                />
              </div>
              <div>
                <Label>Città</Label>
                <Input
                  value={formData.citta}
                  onChange={(e) => setFormData({ ...formData, citta: e.target.value })}
                  placeholder="Milano"
                />
              </div>
              <div>
                <Label>Provincia</Label>
                <Input
                  value={formData.provincia}
                  onChange={(e) => setFormData({ ...formData, provincia: e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2) })}
                  placeholder="MI"
                  maxLength={2}
                />
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="es. sede-milano@azienda.it" />
            </div>
            <div>
              <Label className="flex items-center gap-1"><Phone className="w-3 h-3" /> Telefono</Label>
              <Input value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} placeholder="es. 02 1234567" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formData.attivo} onCheckedChange={(v) => setFormData({ ...formData, attivo: v })} />
              <Label>Attiva</Label>
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
        {(ufficio.indirizzo || ufficio.email || ufficio.telefono) && (
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-1">
            {composeIndirizzoFull(ufficio) && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{composeIndirizzoFull(ufficio)}</span>}
            {ufficio.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{ufficio.email}</span>}
            {ufficio.telefono && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{ufficio.telefono}</span>}
          </div>
        )}
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

export default SediManager;
