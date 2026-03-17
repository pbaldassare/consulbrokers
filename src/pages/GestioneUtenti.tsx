import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Pencil, RefreshCw } from "lucide-react";

const ROLES = ["admin", "ufficio", "produttore", "contabilita", "cfo", "cliente"] as const;

interface UserProfile {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  ruolo: string | null;
  attivo: boolean | null;
  ufficio_id: string | null;
  created_at: string | null;
}

const GestioneUtenti = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
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

  // Edit form
  const [editRuolo, setEditRuolo] = useState<string>("");
  const [editAttivo, setEditAttivo] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, cognome, email, ruolo, attivo, ufficio_id, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter((u) => {
    if (filterRole !== "all" && u.ruolo !== filterRole) return false;
    if (filterStatus === "attivo" && !u.attivo) return false;
    if (filterStatus === "disattivo" && u.attivo) return false;
    return true;
  });

  const handleCreate = async () => {
    if (!newNome || !newCognome || !newEmail || !newRuolo) {
      toast({ title: "Errore", description: "Compila tutti i campi obbligatori", variant: "destructive" });
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
      toast({ title: "Errore", description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({ title: "Utente creato", description: `${newEmail} creato con successo` });
      setCreateOpen(false);
      setNewNome(""); setNewCognome(""); setNewEmail(""); setNewPassword("");
      fetchUsers();
    }
    setSaving(false);
  };

  const openEdit = (user: UserProfile) => {
    setEditUser(user);
    setEditRuolo(user.ruolo || "");
    setEditAttivo(user.attivo ?? true);
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setSaving(true);

    // Update profile
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ ruolo: editRuolo, attivo: editAttivo })
      .eq("id", editUser.id);

    if (profileErr) {
      toast({ title: "Errore", description: profileErr.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Update user_roles: delete old, insert new
    if (editRuolo !== editUser.ruolo) {
      await supabase.from("user_roles").delete().eq("user_id", editUser.id);
      const { error: roleErr } = await supabase.from("user_roles").insert({
        user_id: editUser.id,
        role: editRuolo as any,
      });
      if (roleErr) {
        console.error("Role update error:", roleErr.message);
      }
    }

    toast({ title: "Utente aggiornato" });
    setEditOpen(false);
    fetchUsers();
    setSaving(false);
  };

  const roleBadgeColor = (role: string | null) => {
    switch (role) {
      case "admin": return "destructive";
      case "cfo": return "default";
      case "ufficio": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestione Utenti</h1>
          <p className="text-muted-foreground text-sm">Crea, modifica e assegna ruoli agli utenti</p>
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
                {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
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
                  {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifica Utente</DialogTitle></DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{editUser.cognome} {editUser.nome} — {editUser.email}</p>
              <div className="space-y-1">
                <Label>Ruolo</Label>
                <Select value={editRuolo} onValueChange={setEditRuolo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={editAttivo} onCheckedChange={setEditAttivo} />
                <Label>{editAttivo ? "Attivo" : "Disattivo"}</Label>
              </div>
            </div>
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
