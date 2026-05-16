import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Plus, Percent, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const TIPI_LABEL: Record<string, string> = {
  agenzia: "Agenzia",
  broker: "Broker",
  direzione: "Direzione",
  plurimandataria: "Plurimandataria",
};

const TIPO_CLS: Record<string, string> = {
  agenzia: "bg-emerald-100 text-emerald-800 border-emerald-200",
  broker: "bg-blue-100 text-blue-800 border-blue-200",
  direzione: "bg-purple-100 text-purple-800 border-purple-200",
  plurimandataria: "bg-orange-100 text-orange-800 border-orange-200",
};

export default function ProvvigioniCompagnieRamoPage() {
  const queryClient = useQueryClient();
  const [filterCompagnia, setFilterCompagnia] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterRamo, setFilterRamo] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newRow, setNewRow] = useState({ compagnia_id: "", categoria_id: "", percentuale: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie_for_provv"],
    queryFn: async () => {
      const { data } = await supabase
        .from("compagnie")
        .select("id, codice, nome, tipo, attiva")
        .eq("attiva", true)
        .order("nome");
      return data || [];
    },
  });

  const { data: categorie = [] } = useQuery({
    queryKey: ["categorie_prodotto_all"],
    queryFn: async () => {
      const { data } = await supabase.from("categorie_prodotto").select("id, nome").order("nome");
      return data || [];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["provvigioni_compagnia_ramo_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provvigioni_compagnia_ramo")
        .select("id, percentuale_provvigione, attiva, compagnia_id, categoria_id, compagnie:compagnia_id(id, codice, nome, tipo), categorie_prodotto:categoria_id(id, nome)")
        .eq("attiva", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const compagniaOpts = useMemo(
    () => [{ value: "all", label: "Tutte le agenzie" }, ...compagnie.map((c: any) => ({ value: c.id, label: `${c.codice || "—"} · ${c.nome}` }))],
    [compagnie],
  );
  const ramoOpts = useMemo(
    () => [{ value: "all", label: "Tutti i rami" }, ...categorie.map((c: any) => ({ value: c.id, label: c.nome }))],
    [categorie],
  );

  const filtered = rows.filter((r: any) => {
    if (filterCompagnia !== "all" && r.compagnia_id !== filterCompagnia) return false;
    if (filterRamo !== "all" && r.categoria_id !== filterRamo) return false;
    if (filterTipo !== "all" && r.compagnie?.tipo !== filterTipo) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      const hay = `${r.compagnie?.nome || ""} ${r.compagnie?.codice || ""} ${r.categorie_prodotto?.nome || ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("provvigioni_compagnia_ramo").insert({
        compagnia_id: newRow.compagnia_id,
        categoria_id: newRow.categoria_id,
        percentuale_provvigione: parseFloat(newRow.percentuale),
        attiva: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provvigioni_compagnia_ramo_all"] });
      setCreateOpen(false);
      setNewRow({ compagnia_id: "", categoria_id: "", percentuale: "" });
      toast.success("Provvigione creata");
    },
    onError: (err: any) => toast.error(err.message?.includes("duplicate") ? "Ramo già configurato per questa agenzia" : "Errore: " + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await supabase.from("provvigioni_compagnia_ramo").update({ percentuale_provvigione: value } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provvigioni_compagnia_ramo_all"] });
      setEditingId(null);
      toast.success("Provvigione aggiornata");
    },
    onError: () => toast.error("Errore nell'aggiornamento"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("provvigioni_compagnia_ramo").update({ attiva: false } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provvigioni_compagnia_ramo_all"] });
      toast.success("Provvigione rimossa");
    },
  });

  const compagniaSelectOpts = useMemo(
    () => compagnie.map((c: any) => ({ value: c.id, label: `${c.codice || "—"} · ${c.nome} (${TIPI_LABEL[c.tipo] || c.tipo})` })),
    [compagnie],
  );
  const categoriaSelectOpts = useMemo(() => categorie.map((c: any) => ({ value: c.id, label: c.nome })), [categorie]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Percent className="w-6 h-6" /> Provvigioni Compagnie / Ramo
          </h1>
          <p className="text-muted-foreground">
            Configurazione % provvigioni per combinazione agenzia + ramo · <span className="font-semibold">{rows.length}</span> regole attive
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuova Provvigione</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuova Provvigione per Ramo</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Agenzia *</Label>
                <SearchableSelect
                  options={compagniaSelectOpts}
                  value={newRow.compagnia_id}
                  onValueChange={(v) => setNewRow((p) => ({ ...p, compagnia_id: v }))}
                  placeholder="Seleziona agenzia / broker..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Ramo (Categoria) *</Label>
                <SearchableSelect
                  options={categoriaSelectOpts}
                  value={newRow.categoria_id}
                  onValueChange={(v) => setNewRow((p) => ({ ...p, categoria_id: v }))}
                  placeholder="Seleziona ramo..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Provvigione % *</Label>
                <Input type="number" step="0.01" value={newRow.percentuale} onChange={(e) => setNewRow((p) => ({ ...p, percentuale: e.target.value }))} placeholder="es. 5" />
              </div>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newRow.compagnia_id || !newRow.categoria_id || !newRow.percentuale || createMutation.isPending}
                className="w-full"
              >
                Crea Provvigione
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filtri</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ricerca testo</Label>
              <Input placeholder="Cerca agenzia o ramo..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Agenzia</Label>
              <SearchableSelect options={compagniaOpts} value={filterCompagnia} onValueChange={setFilterCompagnia} placeholder="Filtra agenzia..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <SearchableSelect
                options={[
                  { value: "all", label: "Tutti" },
                  { value: "agenzia", label: "Agenzia" },
                  { value: "broker", label: "Broker" },
                  { value: "direzione", label: "Direzione" },
                  { value: "plurimandataria", label: "Plurimandataria" },
                ]}
                value={filterTipo}
                onValueChange={setFilterTipo}
                placeholder="Filtra tipo..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ramo</Label>
              <SearchableSelect options={ramoOpts} value={filterRamo} onValueChange={setFilterRamo} placeholder="Filtra ramo..." />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button variant="secondary" size="sm" onClick={() => { setSearchText(""); setFilterCompagnia("all"); setFilterTipo("all"); setFilterRamo("all"); }}>
              Reset filtri
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Provvigioni configurate ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Caricamento...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Codice</TableHead>
                  <TableHead>Agenzia</TableHead>
                  <TableHead className="w-40">Tipo</TableHead>
                  <TableHead>Ramo</TableHead>
                  <TableHead className="w-32 text-right">Provvigione</TableHead>
                  <TableHead className="w-20 text-right">Az.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any, idx: number) => {
                  const t = r.compagnie?.tipo || "agenzia";
                  return (
                    <TableRow key={r.id} className={idx % 2 === 0 ? "" : "bg-muted/30"}>
                      <TableCell className="font-mono text-sm">{r.compagnie?.codice || "—"}</TableCell>
                      <TableCell className="font-medium">{r.compagnie?.nome || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={TIPO_CLS[t] || ""}>{TIPI_LABEL[t] || t}</Badge>
                      </TableCell>
                      <TableCell><Badge variant="outline">{r.categorie_prodotto?.nome || "—"}</Badge></TableCell>
                      <TableCell className="text-right">
                        {editingId === r.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              className="w-24 h-8 text-right"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && editValue) updateMutation.mutate({ id: r.id, value: parseFloat(editValue) });
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              autoFocus
                            />
                            <span className="text-muted-foreground">%</span>
                          </div>
                        ) : (
                          <button
                            className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                            onClick={() => { setEditingId(r.id); setEditValue(String(r.percentuale_provvigione ?? "")); }}
                          >
                            <span className="font-semibold">{r.percentuale_provvigione}%</span>
                            <Pencil className="w-3 h-3 text-muted-foreground" />
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm("Rimuovere questa provvigione?")) deleteMutation.mutate(r.id); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nessuna provvigione trovata con i filtri correnti.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
