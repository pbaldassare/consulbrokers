import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Banknote, Plus, Pencil, Star, Trash2, Search, Building2, Briefcase, Landmark, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import ServerPagination from "@/components/ServerPagination";
import DeleteWithImpactDialog from "@/components/common/DeleteWithImpactDialog";
import { validateIban } from "@/lib/validateIban";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface ContoBancario {
  id: string;
  etichetta: string;
  iban: string;
  intestato_a: string;
  banca: string | null;
  bic: string | null;
  codice_abi: string | null;
  codice_cab: string | null;
  citta_banca: string | null;
  tipo: string;
  is_default: boolean;
  ufficio_id: string | null;
  piano_conti_conto_id: string | null;
  attivo: boolean;
  note: string | null;
}

const TIPI = [
  { value: "incasso_clienti", label: "Incasso clienti" },
  { value: "provvigioni", label: "Provvigioni" },
  { value: "generico", label: "Generico" },
  { value: "compagnia", label: "Compagnia" },
  { value: "agenzia", label: "Agenzia" },
];

type CategoriaKey = "consul" | "compagnie" | "agenzie" | "all";

const CATEGORIE: Record<CategoriaKey, { label: string; icon: React.ComponentType<any>; tipi: string[] | null; defaultTipo: string }> = {
  consul: { label: "Consulbrokers", icon: Briefcase, tipi: ["incasso_clienti", "provvigioni", "generico"], defaultTipo: "incasso_clienti" },
  compagnie: { label: "Compagnie", icon: Building2, tipi: ["compagnia"], defaultTipo: "compagnia" },
  agenzie: { label: "Agenzie", icon: Landmark, tipi: ["agenzia"], defaultTipo: "agenzia" },
  all: { label: "Tutti", icon: List, tipi: null, defaultTipo: "incasso_clienti" },
};

const PAGE_SIZE = 25;

const emptyForm: Partial<ContoBancario> = {
  etichetta: "",
  iban: "",
  intestato_a: "",
  banca: "",
  bic: "",
  codice_abi: "",
  codice_cab: "",
  citta_banca: "",
  tipo: "incasso_clienti",
  is_default: false,
  ufficio_id: null,
  attivo: true,
  note: "",
};

const maskIban = (iban: string) => {
  if (!iban || iban.length < 8) return iban;
  return iban.slice(0, 4) + " **** **** **** " + iban.slice(-4);
};

export default function ContiBancariPage() {
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState<CategoriaKey>("consul");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [soloAttivi, setSoloAttivi] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<ContoBancario>>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<ContoBancario | null>(null);

  // Debounce ricerca 350ms
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset paginazione quando cambio tab o filtro attivi
  useEffect(() => { setPage(0); }, [categoria, soloAttivi]);

  // Conteggi per tab
  const { data: counts } = useQuery({
    queryKey: ["conti_bancari_counts", soloAttivi],
    queryFn: async () => {
      const fetchCount = async (tipi: string[] | null) => {
        let q = supabase.from("conti_bancari" as any).select("id", { count: "exact", head: true });
        if (soloAttivi) q = q.eq("attivo", true);
        if (tipi) q = q.in("tipo", tipi);
        const { count, error } = await q;
        if (error) throw error;
        return count || 0;
      };
      const [consul, compagnie, agenzie, all] = await Promise.all([
        fetchCount(CATEGORIE.consul.tipi),
        fetchCount(CATEGORIE.compagnie.tipi),
        fetchCount(CATEGORIE.agenzie.tipi),
        fetchCount(null),
      ]);
      return { consul, compagnie, agenzie, all };
    },
    staleTime: 60_000,
  });

  const tipiCorrenti = CATEGORIE[categoria].tipi;

  const { data: result, isLoading } = useQuery({
    queryKey: ["conti_bancari_admin", categoria, search, page, soloAttivi],
    queryFn: async () => {
      let q = supabase.from("conti_bancari" as any).select("*", { count: "exact" });
      if (tipiCorrenti) q = q.in("tipo", tipiCorrenti);
      if (soloAttivi) q = q.eq("attivo", true);
      if (search) {
        const s = search.replace(/[%,]/g, "");
        q = q.or(`etichetta.ilike.%${s}%,iban.ilike.%${s}%,intestato_a.ilike.%${s}%,banca.ilike.%${s}%`);
      }
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await q
        .order("tipo")
        .order("is_default", { ascending: false })
        .order("etichetta")
        .range(from, to);
      if (error) throw error;
      return { rows: (data || []) as unknown as ContoBancario[], total: count || 0 };
    },
  });

  const conti = result?.rows || [];
  const total = result?.total || 0;

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici_for_conti"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici" as any).select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return (data || []) as unknown as Array<{ id: string; nome_ufficio: string }>;
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<ContoBancario>) => {
      const data = {
        etichetta: payload.etichetta?.trim(),
        iban: payload.iban?.trim(),
        intestato_a: payload.intestato_a?.trim(),
        banca: payload.banca?.trim() || null,
        bic: payload.bic?.trim() || null,
        codice_abi: payload.codice_abi?.trim() || null,
        codice_cab: payload.codice_cab?.trim() || null,
        citta_banca: payload.citta_banca?.trim() || null,
        tipo: payload.tipo,
        is_default: !!payload.is_default,
        ufficio_id: payload.ufficio_id || null,
        attivo: payload.attivo ?? true,
        note: payload.note?.trim() || null,
      };
      if (data.is_default) {
        await supabase.from("conti_bancari" as any).update({ is_default: false }).eq("tipo", data.tipo).eq("is_default", true);
      }
      if (payload.id) {
        const { error } = await supabase.from("conti_bancari" as any).update(data).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("conti_bancari" as any).insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conti_bancari_admin"] });
      qc.invalidateQueries({ queryKey: ["conti_bancari_counts"] });
      qc.invalidateQueries({ queryKey: ["conti_bancari"] });
      toast.success("Conto bancario salvato");
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message || "Errore"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("conti_bancari" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conti_bancari_admin"] });
      qc.invalidateQueries({ queryKey: ["conti_bancari_counts"] });
      qc.invalidateQueries({ queryKey: ["conti_bancari"] });
      toast.success("Conto eliminato");
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message || "Impossibile eliminare (potrebbe essere referenziato)"),
  });

  const setAsDefault = useMutation({
    mutationFn: async (c: ContoBancario) => {
      await supabase.from("conti_bancari" as any).update({ is_default: false }).eq("tipo", c.tipo).eq("is_default", true);
      const { error } = await supabase.from("conti_bancari" as any).update({ is_default: true }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conti_bancari_admin"] });
      qc.invalidateQueries({ queryKey: ["conti_bancari"] });
      toast.success("Default aggiornato");
    },
    onError: (e: any) => toast.error(e.message || "Errore"),
  });

  const openNew = () => {
    setForm({ ...emptyForm, tipo: CATEGORIE[categoria].defaultTipo });
    setDialogOpen(true);
  };
  const openEdit = (c: ContoBancario) => { setForm(c); setDialogOpen(true); };

  const ibanValidation = validateIban(form.iban || "");

  const handleSave = () => {
    if (!form.etichetta?.trim() || !form.intestato_a?.trim()) {
      toast.error("Etichetta e intestatario sono obbligatori");
      return;
    }
    if (!ibanValidation.valid) {
      toast.error(ibanValidation.error || "IBAN non valido");
      return;
    }
    upsert.mutate({ ...form, iban: ibanValidation.normalized });
  };

  const mostraDefault = categoria === "consul" || categoria === "all";

  const tabBadge = (n: number | undefined) =>
    typeof n === "number" ? <span className="ml-1.5 text-xs opacity-70">({n})</span> : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="w-6 h-6 text-primary" /> Conti Bancari
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registro unico degli IBAN. <Star className="inline w-3 h-3 fill-primary text-primary" /> indica il conto di default per tipo (catena IBAN cliente: Specialist → Sede → Default Consulbrokers).
          </p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Nuovo Conto</Button>
      </div>

      <Tabs value={categoria} onValueChange={(v) => setCategoria(v as CategoriaKey)}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="consul"><Briefcase className="w-4 h-4 mr-1.5" />Consulbrokers{tabBadge(counts?.consul)}</TabsTrigger>
          <TabsTrigger value="compagnie"><Building2 className="w-4 h-4 mr-1.5" />Compagnie{tabBadge(counts?.compagnie)}</TabsTrigger>
          <TabsTrigger value="agenzie"><Landmark className="w-4 h-4 mr-1.5" />Agenzie{tabBadge(counts?.agenzie)}</TabsTrigger>
          <TabsTrigger value="all"><List className="w-4 h-4 mr-1.5" />Tutti{tabBadge(counts?.all)}</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cerca per etichetta, IBAN, intestatario, banca…"
                className="pl-9"
              />
            </div>
            <Label className="flex items-center gap-2 text-sm font-normal cursor-pointer whitespace-nowrap">
              <Switch checked={soloAttivi} onCheckedChange={setSoloAttivi} /> Solo attivi
            </Label>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Caricamento...</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {mostraDefault && <TableHead className="w-[80px]">Default</TableHead>}
                    <TableHead>Etichetta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>IBAN</TableHead>
                    <TableHead>Intestato a</TableHead>
                    <TableHead>Banca</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conti.map((c, i) => (
                    <TableRow key={c.id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                      {mostraDefault && (
                        <TableCell>
                          {c.is_default ? (
                            <Badge className="gap-1"><Star className="w-3 h-3 fill-current" /> Default</Badge>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => setAsDefault.mutate(c)} title="Imposta come default">
                              <Star className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{c.etichetta}</TableCell>
                      <TableCell><Badge variant="secondary">{TIPI.find(t => t.value === c.tipo)?.label || c.tipo}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{maskIban(c.iban)}</TableCell>
                      <TableCell className="text-sm">{c.intestato_a}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.banca || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={c.attivo ? "default" : "secondary"}>{c.attivo ? "Attivo" : "Disattivo"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(c)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {conti.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={mostraDefault ? 8 : 7} className="text-center text-muted-foreground py-10">
                        {search ? (
                          <>Nessun conto trovato per "<span className="font-medium">{search}</span>"</>
                        ) : (
                          <div className="space-y-3">
                            <p>Nessun conto in questa categoria.</p>
                            <Button size="sm" variant="outline" onClick={openNew}>
                              <Plus className="w-4 h-4 mr-2" /> Nuovo conto {CATEGORIE[categoria].label}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <ServerPagination page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifica Conto Bancario" : "Nuovo Conto Bancario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Etichetta *</Label>
                <Input value={form.etichetta || ""} onChange={(e) => setForm({ ...form, etichetta: e.target.value })} placeholder="Es. Conto incassi Napoli" />
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPI.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>IBAN *</Label>
              <Input
                value={form.iban || ""}
                onChange={(e) => setForm({ ...form, iban: e.target.value.toUpperCase().replace(/\s+/g, "") })}
                placeholder="IT70Q0306904214100000016469"
                className={`font-mono ${form.iban && !ibanValidation.valid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                aria-invalid={!!form.iban && !ibanValidation.valid}
              />
              {form.iban ? (
                ibanValidation.valid ? (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> IBAN valido ({form.iban.slice(0, 2)})
                  </p>
                ) : (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {ibanValidation.error}
                  </p>
                )
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Inserisci un IBAN valido (es. IT + 25 caratteri)</p>
              )}
            </div>

            <div>
              <Label>Intestato a *</Label>
              <Input value={form.intestato_a || ""} onChange={(e) => setForm({ ...form, intestato_a: e.target.value })} placeholder="Es. Consulbrokers Digital SRL" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Banca</Label>
                <Input value={form.banca || ""} onChange={(e) => setForm({ ...form, banca: e.target.value })} placeholder="Es. Intesa Sanpaolo SpA" />
              </div>
              <div>
                <Label>BIC / SWIFT</Label>
                <Input value={form.bic || ""} onChange={(e) => setForm({ ...form, bic: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>ABI</Label>
                <Input value={form.codice_abi || ""} onChange={(e) => setForm({ ...form, codice_abi: e.target.value })} />
              </div>
              <div>
                <Label>CAB</Label>
                <Input value={form.codice_cab || ""} onChange={(e) => setForm({ ...form, codice_cab: e.target.value })} />
              </div>
              <div>
                <Label>Città banca</Label>
                <Input value={form.citta_banca || ""} onChange={(e) => setForm({ ...form, citta_banca: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Sede di riferimento (opzionale)</Label>
              <Select value={form.ufficio_id || "none"} onValueChange={(v) => setForm({ ...form, ufficio_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Tutte le sedi —</SelectItem>
                  {uffici.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Note</Label>
              <Textarea value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
            </div>

            <div className="flex items-center gap-6">
              <Label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={!!form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
                Imposta come default per questo tipo
              </Label>
              <Label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={form.attivo ?? true} onCheckedChange={(v) => setForm({ ...form, attivo: v })} />
                Attivo
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSave} disabled={upsert.isPending || !ibanValidation.valid}>{upsert.isPending ? "Salvataggio…" : "Salva"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteWithImpactDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        entityId={deleteTarget?.id}
        entityType="conto bancario"
        entityName={deleteTarget ? `${deleteTarget.etichetta} (${deleteTarget.iban?.slice(0, 4)}…${deleteTarget.iban?.slice(-4)})` : "—"}
        checks={[
          { table: "uffici", column: "conto_bancario_id", label: "Sedi (IBAN incassi)" },
          { table: "uffici", column: "conto_incasso_id", label: "Sedi (IBAN secondario)" },
          { table: "compagnie", column: "conto_bancario_id", label: "Agenzie collegate" },
          { table: "compagnia_rapporti", column: "conto_bancario_id", label: "Rapporti agenzia-compagnia" },
          { table: "profiles", column: "conto_bancario_id", label: "Specialist collegati" },
        ]}
        onConfirmDelete={() => deleteTarget && del.mutate(deleteTarget.id)}
        onDeactivateInstead={
          deleteTarget?.attivo
            ? () => deleteTarget && upsert.mutate({ ...deleteTarget, attivo: false })
            : undefined
        }
        isDeleting={del.isPending}
      />
    </div>
  );
}
