import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { UserPlus, Pencil, RefreshCw, Upload, Download, Trash2, FileText } from "lucide-react";

const ROLES = ["admin", "ufficio", "produttore", "backoffice", "contabilita", "cfo", "corrispondente"] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  ufficio: "Sede",
  produttore: "Produttore",
  backoffice: "Specialist",
  contabilita: "Contabilità",
  cfo: "CFO",
  corrispondente: "Corrispondente",
};

const DOC_CATEGORIE = [
  { value: "carta_identita", label: "Carta d'Identità" },
  { value: "mandato", label: "Mandato" },
  { value: "visura", label: "Visura" },
  { value: "patente", label: "Patente" },
  { value: "altro", label: "Altro" },
] as const;

interface UserProfile {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  ruolo: string | null;
  attivo: boolean | null;
  ufficio_id: string | null;
  created_at: string | null;
  descrizione: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  telefono: string | null;
  fax: string | null;
  codice_fiscale: string | null;
  nome_rui: string | null;
  data_iscrizione_rui: string | null;
  numero_rui: string | null;
  sezione_rui: string | null;
  codice_contabile: string | null;
  percentuale_ra: number | null;
  iban: string | null;
  intestatario_cc: string | null;
  percentuale_base: number | null;
  percentuale_consulenza: number | null;
}

interface DocUtente {
  id: string;
  nome_file: string;
  path_storage: string;
  categoria: string;
  note: string | null;
  created_at: string | null;
}

interface Ufficio {
  id: string;
  nome_ufficio: string;
}

const GestioneUtenti = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [uffici, setUffici] = useState<Ufficio[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [newNome, setNewNome] = useState("");
  const [newCognome, setNewCognome] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRuolo, setNewRuolo] = useState<string>("produttore");
  const [newPassword, setNewPassword] = useState("");

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});

  // Documents state
  const [userDocs, setUserDocs] = useState<DocUtente[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docCategoria, setDocCategoria] = useState("altro");
  const [docNote, setDocNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, cognome, email, ruolo, attivo, ufficio_id, created_at, descrizione, indirizzo, cap, citta, provincia, telefono, fax, codice_fiscale, nome_rui, data_iscrizione_rui, numero_rui, sezione_rui, codice_contabile, percentuale_ra, iban, intestatario_cc, percentuale_base, percentuale_consulenza")
      .neq("ruolo", "cliente")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Errore");
    } else {
      setUsers((data as UserProfile[]) || []);
    }
    setLoading(false);
  };

  const fetchUffici = async () => {
    const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
    setUffici(data || []);
  };

  useEffect(() => { fetchUsers(); fetchUffici(); }, []);

  const fetchUserDocs = async (userId: string) => {
    setDocsLoading(true);
    const { data } = await supabase
      .from("documenti_utenti")
      .select("id, nome_file, path_storage, categoria, note, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setUserDocs((data as DocUtente[]) || []);
    setDocsLoading(false);
  };

  const filtered = users.filter((u) => {
    if (filterRole !== "all" && u.ruolo !== filterRole) return false;
    if (filterStatus === "attivo" && !u.attivo) return false;
    if (filterStatus === "disattivo" && u.attivo) return false;
    return true;
  });

  const handleCreate = async () => {
    if (!newNome || !newCognome || !newEmail || !newRuolo) {
      toast.error("Errore", { description: "Compila tutti i campi obbligatori" });
      return;
    }
    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const res = await supabase.functions.invoke("create-user", {
      body: {
        nome: newNome,
        cognome: newCognome,
        email: newEmail,
        ruolo: newRuolo,
        password: newPassword || undefined,
      },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (res.error || res.data?.error) {
      toast.error("Errore");
    } else {
      toast.success("Utente creato", { description: `${newEmail} creato con successo` });
      setCreateOpen(false);
      setNewNome(""); setNewCognome(""); setNewEmail(""); setNewPassword("");
      fetchUsers();
    }
    setSaving(false);
  };

  const openEdit = (user: UserProfile) => {
    setEditUser(user);
    setEditForm({ ...user });
    setEditOpen(true);
    fetchUserDocs(user.id);
  };

  const updateEditField = (field: keyof UserProfile, value: any) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setSaving(true);

    const { error: profileErr } = await supabase
      .from("profiles")
      .update({
        nome: editForm.nome,
        cognome: editForm.cognome,
        email: editForm.email,
        ruolo: editForm.ruolo,
        attivo: editForm.attivo,
        ufficio_id: editForm.ufficio_id || null,
        descrizione: editForm.descrizione || null,
        indirizzo: editForm.indirizzo || null,
        cap: editForm.cap || null,
        citta: editForm.citta || null,
        provincia: editForm.provincia || null,
        telefono: editForm.telefono || null,
        fax: editForm.fax || null,
        codice_fiscale: editForm.codice_fiscale || null,
        nome_rui: editForm.nome_rui || null,
        data_iscrizione_rui: editForm.data_iscrizione_rui || null,
        numero_rui: editForm.numero_rui || null,
        sezione_rui: editForm.sezione_rui || null,
        codice_contabile: editForm.codice_contabile || null,
        percentuale_ra: editForm.percentuale_ra ?? null,
        iban: editForm.iban || null,
        intestatario_cc: editForm.intestatario_cc || null,
        percentuale_base: editForm.percentuale_base ?? null,
        percentuale_consulenza: editForm.percentuale_consulenza ?? null,
      })
      .eq("id", editUser.id);

    if (profileErr) {
      toast.error("Errore");
      setSaving(false);
      return;
    }

    // Update user_roles if role changed
    if (editForm.ruolo !== editUser.ruolo) {
      await supabase.from("user_roles").delete().eq("user_id", editUser.id);
      const { error: roleErr } = await supabase.from("user_roles").insert({
        user_id: editUser.id,
        role: editForm.ruolo as any,
      });
      if (roleErr) {
        console.error("Role update error:", roleErr.message);
      }
    }

    toast.success("Utente aggiornato");
    setEditOpen(false);
    fetchUsers();
    setSaving(false);
  };

  const handleUploadDoc = async (file: File) => {
    if (!editUser) return;
    setUploadingDoc(true);
    const path = `${editUser.id}/${Date.now()}_${file.name}`;

    const { error: uploadErr } = await supabase.storage
      .from("documenti_utenti")
      .upload(path, file);

    if (uploadErr) {
      toast.error("Errore upload");
      setUploadingDoc(false);
      return;
    }

    const { error: insertErr } = await supabase.from("documenti_utenti").insert({
      user_id: editUser.id,
      nome_file: file.name,
      path_storage: path,
      categoria: docCategoria,
      note: docNote || null,
    });

    if (insertErr) {
      toast.error("Errore salvataggio");
    } else {
      toast.success("Documento caricato");
      setDocNote("");
      fetchUserDocs(editUser.id);
    }
    setUploadingDoc(false);
  };

  const handleDownloadDoc = async (doc: DocUtente) => {
    const { data, error } = await supabase.storage
      .from("documenti_utenti")
      .download(doc.path_storage);

    if (error || !data) {
      toast.error("Errore download");
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.nome_file;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteDoc = async (doc: DocUtente) => {
    if (!editUser) return;
    await supabase.storage.from("documenti_utenti").remove([doc.path_storage]);
    await supabase.from("documenti_utenti").delete().eq("id", doc.id);
    toast.success("Documento eliminato");
    fetchUserDocs(editUser.id);
  };

  const roleBadgeColor = (role: string | null) => {
    switch (role) {
      case "admin": return "destructive";
      case "cfo": return "default";
      case "ufficio": return "secondary";
      default: return "outline";
    }
  };

  const getCategoriaLabel = (cat: string) => DOC_CATEGORIE.find(c => c.value === cat)?.label || cat;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestione Utenti</h1>
          <p className="text-muted-foreground text-sm">Crea, modifica e assegna ruoli agli utenti (esclusi clienti)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchUsers}>
            <RefreshCw className="w-4 h-4 mr-1" /> Aggiorna
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="w-4 h-4 mr-1" /> Nuovo Utente
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 flex gap-4 items-end flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">Ruolo</Label>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                {ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Stato</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="attivo">Attivi</SelectItem>
                <SelectItem value="disattivo">Disattivi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">{filtered.length} utenti</p>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Creato il</TableHead>
                <TableHead className="w-20">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nessun utente trovato</TableCell></TableRow>
              ) : filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.cognome} {u.nome}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Badge variant={roleBadgeColor(u.ruolo) as any}>{u.ruolo}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={u.attivo ? "default" : "outline"}>
                      {u.attivo ? "Attivo" : "Disattivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString("it-IT") : "-"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuovo Utente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input value={newNome} onChange={e => setNewNome(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Cognome *</Label>
                <Input value={newCognome} onChange={e => setNewCognome(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Ruolo *</Label>
              <Select value={newRuolo} onValueChange={setNewRuolo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Lascia vuoto per Temp123!" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Salvataggio..." : "Crea Utente"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog - Full Form */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Modifica Utente</DialogTitle></DialogHeader>
          {editForm && (
            <ScrollArea className="max-h-[65vh] pr-4">
              <Tabs defaultValue="generali" className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="generali" className="text-xs">Generali</TabsTrigger>
                  <TabsTrigger value="recapiti" className="text-xs">Recapiti</TabsTrigger>
                  <TabsTrigger value="rui" className="text-xs">RUI</TabsTrigger>
                  <TabsTrigger value="fiscale" className="text-xs">Fiscale</TabsTrigger>
                  <TabsTrigger value="provvigioni" className="text-xs">Provvigioni</TabsTrigger>
                  <TabsTrigger value="documenti" className="text-xs">Documenti</TabsTrigger>
                </TabsList>

                <TabsContent value="generali" className="space-y-4 mt-4">
                  <div className="space-y-1">
                    <Label>Descrizione</Label>
                    <Input value={editForm.descrizione || ""} onChange={e => updateEditField("descrizione", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Cognome / Denominazione</Label>
                      <Input value={editForm.cognome || ""} onChange={e => updateEditField("cognome", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Nome / Seguito Denominazione</Label>
                      <Input value={editForm.nome || ""} onChange={e => updateEditField("nome", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Ruolo</Label>
                      <Select value={editForm.ruolo || ""} onValueChange={v => updateEditField("ruolo", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Sede (opzionale)</Label>
                      <Select value={editForm.ufficio_id || "none"} onValueChange={v => updateEditField("ufficio_id", v === "none" ? null : v)}>
                        <SelectTrigger><SelectValue placeholder="Nessuna sede" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nessuna sede</SelectItem>
                          {uffici.map(u => <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Switch checked={editForm.attivo ?? true} onCheckedChange={v => updateEditField("attivo", v)} />
                    <Label>{editForm.attivo ? "Attivo" : "Annullato"}</Label>
                  </div>
                </TabsContent>

                <TabsContent value="recapiti" className="space-y-4 mt-4">
                  <div className="space-y-1">
                    <Label>Indirizzo</Label>
                    <Input value={editForm.indirizzo || ""} onChange={e => updateEditField("indirizzo", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label>CAP</Label>
                      <Input value={editForm.cap || ""} onChange={e => updateEditField("cap", e.target.value)} maxLength={5} />
                    </div>
                    <div className="space-y-1">
                      <Label>Comune</Label>
                      <Input value={editForm.citta || ""} onChange={e => updateEditField("citta", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Prov.</Label>
                      <Input value={editForm.provincia || ""} onChange={e => updateEditField("provincia", e.target.value)} maxLength={2} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Indirizzo Mail</Label>
                    <Input type="email" value={editForm.email || ""} onChange={e => updateEditField("email", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Telefono</Label>
                      <Input value={editForm.telefono || ""} onChange={e => updateEditField("telefono", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Fax</Label>
                      <Input value={editForm.fax || ""} onChange={e => updateEditField("fax", e.target.value)} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="rui" className="space-y-4 mt-4">
                  <div className="space-y-1">
                    <Label>Nome Iscrizione RUI</Label>
                    <Input value={editForm.nome_rui || ""} onChange={e => updateEditField("nome_rui", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label>Data Iscrizione RUI</Label>
                      <Input type="date" value={editForm.data_iscrizione_rui || ""} onChange={e => updateEditField("data_iscrizione_rui", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Numero</Label>
                      <Input value={editForm.numero_rui || ""} onChange={e => updateEditField("numero_rui", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Sezione</Label>
                      <Input value={editForm.sezione_rui || ""} onChange={e => updateEditField("sezione_rui", e.target.value)} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="fiscale" className="space-y-4 mt-4">
                  <div className="space-y-1">
                    <Label>Codice Contabile</Label>
                    <Input value={editForm.codice_contabile || ""} onChange={e => updateEditField("codice_contabile", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Codice Fiscale</Label>
                      <Input value={editForm.codice_fiscale || ""} onChange={e => updateEditField("codice_fiscale", e.target.value.toUpperCase())} />
                    </div>
                    <div className="space-y-1">
                      <Label>% Rit. Acconto</Label>
                      <Input type="number" step="0.01" value={editForm.percentuale_ra ?? ""} onChange={e => updateEditField("percentuale_ra", e.target.value ? parseFloat(e.target.value) : null)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Numero IBAN</Label>
                    <Input value={editForm.iban || ""} onChange={e => updateEditField("iban", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Intestato a</Label>
                    <Input value={editForm.intestatario_cc || ""} onChange={e => updateEditField("intestatario_cc", e.target.value)} />
                  </div>
                </TabsContent>

                <TabsContent value="provvigioni" className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">Percentuali provvigionali applicate all'utente</p>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>% Provvigione Produzione</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={editForm.percentuale_base ?? ""}
                          onChange={e => updateEditField("percentuale_base", e.target.value ? parseFloat(e.target.value) : null)}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>% Provvigione Intermediazione</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={editForm.percentuale_consulenza ?? ""}
                          onChange={e => updateEditField("percentuale_consulenza", e.target.value ? parseFloat(e.target.value) : null)}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="documenti" className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">Documenti associati all'utente (carta d'identità, mandati, visure...)</p>
                  <Separator />

                  {/* Upload area */}
                  <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Categoria</Label>
                        <Select value={docCategoria} onValueChange={setDocCategoria}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {DOC_CATEGORIE.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Note (opzionale)</Label>
                        <Input value={docNote} onChange={e => setDocNote(e.target.value)} placeholder="es. Scadenza 2027" />
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={e => { if (e.target.files?.[0]) handleUploadDoc(e.target.files[0]); e.target.value = ""; }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingDoc}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      {uploadingDoc ? "Caricamento..." : "Carica Documento"}
                    </Button>
                  </div>

                  {/* Documents list */}
                  {docsLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Caricamento documenti...</p>
                  ) : userDocs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nessun documento caricato</p>
                  ) : (
                    <div className="space-y-2">
                      {userDocs.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between border rounded-md p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{doc.nome_file}</p>
                              <div className="flex gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-xs">{getCategoriaLabel(doc.categoria)}</Badge>
                                {doc.note && <span>{doc.note}</span>}
                                {doc.created_at && <span>{new Date(doc.created_at).toLocaleDateString("it-IT")}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => handleDownloadDoc(doc)}>
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteDoc(doc)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annulla</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? "Salvataggio..." : "Salva"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GestioneUtenti;
