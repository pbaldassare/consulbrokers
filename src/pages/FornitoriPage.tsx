import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Search, Edit, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Fornitore {
  id: string;
  codice: string | null;
  nome: string;
  indirizzo: string | null;
  cap: string | null;
  localita: string | null;
  provincia: string | null;
  nazione: string | null;
  codice_fiscale: string | null;
  partita_iva: string | null;
  email: string | null;
  pec: string | null;
  ultima_fattura: string | null;
  stato_soggetto: boolean | null;
  stato_cliente: boolean | null;
  stato_fornitore: boolean | null;
  attivo: boolean | null;
  created_at: string | null;
}

const PAGE_SIZE = 25;

const emptyForm = {
  codice: "",
  nome: "",
  indirizzo: "",
  cap: "",
  localita: "",
  provincia: "",
  nazione: "IT",
  codice_fiscale: "",
  partita_iva: "",
  email: "",
  pec: "",
  ultima_fattura: "",
  stato_soggetto: false,
  stato_cliente: false,
  stato_fornitore: true,
  attivo: true,
};

export default function FornitoriPage() {
  const [fornitori, setFornitori] = useState<Fornitore[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [provinciaFilter, setProvinciaFilter] = useState("all");
  const [statoFilter, setStatoFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [province, setProvince] = useState<string[]>([]);

  const fetchProvince = useCallback(async () => {
    const { data } = await supabase
      .from("fornitori")
      .select("provincia")
      .not("provincia", "is", null)
      .order("provincia");
    if (data) {
      const unique = [...new Set(data.map((d: any) => d.provincia).filter(Boolean))];
      setProvince(unique as string[]);
    }
  }, []);

  const fetchFornitori = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("fornitori").select("*", { count: "exact" });

    if (search) {
      query = query.or(`nome.ilike.%${search}%,codice.ilike.%${search}%,partita_iva.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (provinciaFilter !== "all") {
      query = query.eq("provincia", provinciaFilter);
    }
    if (statoFilter === "attivo") {
      query = query.eq("attivo", true);
    } else if (statoFilter === "inattivo") {
      query = query.eq("attivo", false);
    }

    const { data, count, error } = await query
      .order("codice", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      toast.error("Errore nel caricamento fornitori");
    } else {
      setFornitori(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [search, provinciaFilter, statoFilter, page]);

  useEffect(() => { fetchProvince(); }, [fetchProvince]);
  useEffect(() => { fetchFornitori(); }, [fetchFornitori]);
  useEffect(() => { setPage(0); }, [search, provinciaFilter, statoFilter]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (f: Fornitore) => {
    setEditingId(f.id);
    setForm({
      codice: f.codice || "",
      nome: f.nome,
      indirizzo: f.indirizzo || "",
      cap: f.cap || "",
      localita: f.localita || "",
      provincia: f.provincia || "",
      nazione: f.nazione || "IT",
      codice_fiscale: f.codice_fiscale || "",
      partita_iva: f.partita_iva || "",
      email: f.email || "",
      pec: f.pec || "",
      ultima_fattura: f.ultima_fattura || "",
      stato_soggetto: f.stato_soggetto || false,
      stato_cliente: f.stato_cliente || false,
      stato_fornitore: f.stato_fornitore || true,
      attivo: f.attivo !== false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error("Il nome è obbligatorio");
      return;
    }
    const payload = {
      codice: form.codice || null,
      nome: form.nome,
      indirizzo: form.indirizzo || null,
      cap: form.cap || null,
      localita: form.localita || null,
      provincia: form.provincia || null,
      nazione: form.nazione || "IT",
      codice_fiscale: form.codice_fiscale || null,
      partita_iva: form.partita_iva || null,
      email: form.email || null,
      pec: form.pec || null,
      ultima_fattura: form.ultima_fattura || null,
      stato_soggetto: form.stato_soggetto,
      stato_cliente: form.stato_cliente,
      stato_fornitore: form.stato_fornitore,
      attivo: form.attivo,
    };

    if (editingId) {
      const { error } = await supabase.from("fornitori").update(payload).eq("id", editingId);
      if (error) { toast.error("Errore aggiornamento: " + error.message); return; }
      toast.success("Fornitore aggiornato");
    } else {
      const { error } = await supabase.from("fornitori").insert(payload);
      if (error) { toast.error("Errore inserimento: " + error.message); return; }
      toast.success("Fornitore creato");
    }
    setDialogOpen(false);
    fetchFornitori();
    fetchProvince();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Fornitori</h1>
            <p className="text-sm text-muted-foreground">Gestione anagrafica fornitori · {totalCount} record</p>
          </div>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> Nuovo Fornitore
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Cerca</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, codice, P.IVA, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-[160px]">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Provincia</Label>
              <Select value={provinciaFilter} onValueChange={setProvinciaFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  {province.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[140px]">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Stato</Label>
              <Select value={statoFilter} onValueChange={setStatoFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="attivo">Attivi</SelectItem>
                  <SelectItem value="inattivo">Inattivi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setSearch(""); setProvinciaFilter("all"); setStatoFilter("all"); }}
              title="Reset filtri"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[90px]">Codice</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Località</TableHead>
                  <TableHead className="hidden md:table-cell w-[60px]">Prov</TableHead>
                  <TableHead className="hidden lg:table-cell">P.IVA</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead className="hidden xl:table-cell w-[100px]">Ult. Fattura</TableHead>
                  <TableHead className="w-[80px]">Stato</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell>
                  </TableRow>
                ) : fornitori.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nessun fornitore trovato</TableCell>
                  </TableRow>
                ) : (
                  fornitori.map((f) => (
                    <TableRow key={f.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => openEdit(f)}>
                      <TableCell className="font-mono text-xs">{f.codice}</TableCell>
                      <TableCell className="font-medium max-w-[260px] truncate">{f.nome}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{f.localita}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{f.provincia}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm font-mono">{f.partita_iva}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{f.email}</TableCell>
                      <TableCell className="hidden xl:table-cell text-sm">
                        {f.ultima_fattura ? new Date(f.ultima_fattura).toLocaleDateString("it-IT") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.attivo ? "default" : "secondary"} className="text-xs">
                          {f.attivo ? "Attivo" : "Inattivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEdit(f); }}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Pagina {page + 1} di {totalPages} · {totalCount} risultati
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifica Fornitore" : "Nuovo Fornitore"}</DialogTitle>
            <DialogDescription>Compila i dati del fornitore</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Codice</Label>
              <Input value={form.codice} onChange={(e) => setForm({ ...form, codice: e.target.value })} />
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Indirizzo</Label>
              <Input value={form.indirizzo} onChange={(e) => setForm({ ...form, indirizzo: e.target.value })} />
            </div>
            <div>
              <Label>CAP</Label>
              <Input value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} />
            </div>
            <div>
              <Label>Località</Label>
              <Input value={form.localita} onChange={(e) => setForm({ ...form, localita: e.target.value })} />
            </div>
            <div>
              <Label>Provincia</Label>
              <Input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} maxLength={2} />
            </div>
            <div>
              <Label>Nazione</Label>
              <Input value={form.nazione} onChange={(e) => setForm({ ...form, nazione: e.target.value })} maxLength={3} />
            </div>
            <div>
              <Label>Codice Fiscale</Label>
              <Input value={form.codice_fiscale} onChange={(e) => setForm({ ...form, codice_fiscale: e.target.value })} />
            </div>
            <div>
              <Label>Partita IVA</Label>
              <Input value={form.partita_iva} onChange={(e) => setForm({ ...form, partita_iva: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>PEC</Label>
              <Input type="email" value={form.pec} onChange={(e) => setForm({ ...form, pec: e.target.value })} />
            </div>
            <div>
              <Label>Ultima Fattura</Label>
              <Input type="date" value={form.ultima_fattura} onChange={(e) => setForm({ ...form, ultima_fattura: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.stato_fornitore} onChange={(e) => setForm({ ...form, stato_fornitore: e.target.checked })} className="rounded" />
                Fornitore
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.stato_cliente} onChange={(e) => setForm({ ...form, stato_cliente: e.target.checked })} className="rounded" />
                Cliente
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.stato_soggetto} onChange={(e) => setForm({ ...form, stato_soggetto: e.target.checked })} className="rounded" />
                Soggetto
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.attivo} onChange={(e) => setForm({ ...form, attivo: e.target.checked })} className="rounded" />
                Attivo
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSave}>{editingId ? "Salva Modifiche" : "Crea Fornitore"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
