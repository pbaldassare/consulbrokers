import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileStack, Search, Wand2, Loader2 } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import ServerPagination from "@/components/ServerPagination";
import { format } from "date-fns";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
const DichiarativiCUPage = () => {
  const queryClient = useQueryClient();
  const { page, setPage, pageSize, range } = useServerPagination();
  const [search, setSearch] = useState("");
  const [annoFilter, setAnnoFilter] = useState(new Date().getFullYear().toString());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["certificazioni_cu", page, search, annoFilter],
    queryFn: async () => {
      let q = supabase.from("certificazioni_cu").select("*, fornitori(nome)", { count: "exact" });
      if (annoFilter) q = q.eq("anno_fiscale", parseInt(annoFilter));
      if (search) q = q.or(`codice_fornitore.ilike.%${search}%,nome_fornitore.ilike.%${search}%,numero_primanota.ilike.%${search}%`);
      q = q.order("codice_fornitore").order("data_primanota").range(range.from, range.to);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: data || [], total: count || 0 };
    },
  });

  // Count primanota records for the selected year (preview)
  const { data: pnCount } = useQuery({
    queryKey: ["primanota_count_for_cu", annoFilter],
    queryFn: async () => {
      const anno = parseInt(annoFilter);
      const from = `${anno}-01-01`;
      const to = `${anno}-12-31`;
      const { count, error } = await supabase
        .from("primanota_generale")
        .select("id", { count: "exact", head: true })
        .gte("data_pn", from)
        .lte("data_pn", to)
        .not("fornitore_id", "is", null);
      if (error) throw error;
      return count || 0;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const anno = parseInt(annoFilter);
      const from = `${anno}-01-01`;
      const to = `${anno}-12-31`;

      // Fetch all primanota for the year with a fornitore
      const { data: pnRows, error: pnErr } = await supabase
        .from("primanota_generale")
        .select("id, numero_pn, data_pn, fornitore_id, tipo, descrizione, totale, imponibile, aliquota_ritenuta, ritenuta, non_soggetto, altri_importi, numero_documento, numero_protocollo, fornitori(nome, codice), ufficio_id")
        .gte("data_pn", from)
        .lte("data_pn", to)
        .not("fornitore_id", "is", null)
        .order("data_pn")
        .limit(1000);

      if (pnErr) throw pnErr;
      if (!pnRows || pnRows.length === 0) throw new Error("Nessun movimento di primanota trovato per l'anno " + anno);

      // Delete existing generated CU for this year (only stato='bozza' or 'generata')
      await supabase
        .from("certificazioni_cu")
        .delete()
        .eq("anno_fiscale", anno)
        .in("stato", ["bozza", "generata"]);

      // Map each primanota row to a CU record
      const cuRecords = pnRows.map((pn: any) => ({
        anno_fiscale: anno,
        fornitore_id: pn.fornitore_id,
        codice_fornitore: pn.fornitori?.codice || null,
        nome_fornitore: pn.fornitori?.nome || null,
        numero_primanota: pn.numero_pn,
        data_primanota: pn.data_pn,
        numero_protocollo: pn.numero_protocollo,
        numero_documento: pn.numero_documento,
        tipo_reddito: pn.tipo || "EE",
        totale: Number(pn.totale) || 0,
        imponibile: Number(pn.imponibile) || 0,
        aliquota_ritenuta: Number(pn.aliquota_ritenuta) || 0,
        ritenuta: Number(pn.ritenuta) || 0,
        non_soggetto: Number(pn.non_soggetto) || 0,
        altri_importi: Number(pn.altri_importi) || 0,
        stato: "generata",
        ufficio_id: pn.ufficio_id,
      }));

      // Insert in batches of 100
      for (let i = 0; i < cuRecords.length; i += 100) {
        const batch = cuRecords.slice(i, i + 100);
        const { error: insErr } = await supabase.from("certificazioni_cu").insert(batch);
        if (insErr) throw insErr;
      }

      return cuRecords.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["certificazioni_cu"] });
      setConfirmOpen(false);
      setPage(0);
      toast.success(`${count} certificazioni CU generate dall'anno ${annoFilter}`);
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const rows = data?.rows || [];
  const totalCount = data?.total || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageBreadcrumb />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileStack className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dichiarativi — Certificazioni CU</h1>
            <p className="text-sm text-muted-foreground">Certificazioni Uniche per fornitore con dettaglio movimenti</p>
          </div>
        </div>
        <Button onClick={() => setConfirmOpen(true)} variant="default">
          <Wand2 className="w-4 h-4 mr-2" />
          Genera da Primanota
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Cerca codice, nome, N° PN..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
            </div>
            <Select value={annoFilter} onValueChange={v => { setAnnoFilter(v); setPage(0); }}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2026, 2025, 2024, 2023].map(a => <SelectItem key={a} value={a.toString()}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge variant="outline">{totalCount} record</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codice</TableHead>
                <TableHead>Fornitore</TableHead>
                <TableHead>N° PN</TableHead>
                <TableHead>Data PN</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Imponibile</TableHead>
                <TableHead className="text-right">Ritenuta</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nessuna CU trovata per l'anno selezionato</TableCell></TableRow>
              ) : rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.codice_fornitore || "—"}</TableCell>
                  <TableCell>{r.nome_fornitore || r.fornitori?.nome || "—"}</TableCell>
                  <TableCell className="font-mono">{r.numero_primanota || "—"}</TableCell>
                  <TableCell>{r.data_primanota ? format(new Date(r.data_primanota), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell><Badge variant="outline">{r.tipo_reddito}</Badge></TableCell>
                  <TableCell className="text-right font-mono">€ {Number(r.imponibile).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-mono">€ {Number(r.ritenuta).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <Badge variant={r.stato === "inviata" ? "default" : r.stato === "generata" ? "secondary" : "outline"}>{r.stato}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </CardContent>
      </Card>

      {/* Confirm generation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Genera Certificazioni CU {annoFilter}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Verranno letti tutti i movimenti di Primanota Generale dell'anno <strong>{annoFilter}</strong> con fornitore associato
              e creati i corrispondenti record di Certificazione Unica.
            </p>
            <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground">Movimenti trovati:</span>{" "}
                <span className="font-mono font-semibold">{pnCount ?? "..."}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Le CU esistenti in stato "bozza" o "generata" per quest'anno verranno sostituite. Le CU "inviate" non saranno toccate.
              </p>
            </div>
            {generateMutation.isPending && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Generazione in corso...
                </p>
                <Progress value={50} className="h-2" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={generateMutation.isPending}>
              Annulla
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || !pnCount}
            >
              {generateMutation.isPending ? "Generazione..." : `Genera ${pnCount || 0} CU`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DichiarativiCUPage;
