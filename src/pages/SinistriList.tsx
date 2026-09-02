import { useState, useEffect } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import ServerPagination from "@/components/ServerPagination";
import { SearchableSelect } from "@/components/SearchableSelect";
import { formatTipoSinistro } from "@/lib/tipiSinistro";
import { resolveClienteNome } from "@/lib/ecClienteAnagrafica";

const statiSinistro = ["bozza", "in_valutazione", "aperto", "in_lavorazione", "in_attesa_documenti", "in_liquidazione", "chiuso", "respinto"];

const statoBadge: Record<string, string> = {
  bozza: "bg-slate-100 text-slate-700 border border-slate-300",
  in_valutazione: "bg-amber-100 text-amber-800",
  aperto: "bg-blue-100 text-blue-800",
  in_lavorazione: "bg-yellow-100 text-yellow-800",
  in_attesa_documenti: "bg-orange-100 text-orange-800",
  in_liquidazione: "bg-purple-100 text-purple-800",
  chiuso: "bg-green-100 text-green-800",
  respinto: "bg-red-100 text-red-800",
};

type SortField =
  | "numero_sinistro"
  | "tipo_sinistro"
  | "stato"
  | "compagnia_id"
  | "data_apertura"
  | "data_denuncia"
  | "controparte"
  | "created_at";

export default function SinistriList() {
  const navigate = useNavigate();
  const [filtroStato, setFiltroStato] = useState<string>("tutti");
  const [filtroCompagnia, setFiltroCompagnia] = useState<string>("tutti");
  const [filtroTerzi, setFiltroTerzi] = useState<string>("tutti");
  const [filtroResponsabile, setFiltroResponsabile] = useState<string>("tutti");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const { page, setPage, pageSize, range } = useServerPagination(25, [
    filtroStato,
    filtroCompagnia,
    filtroTerzi,
    filtroResponsabile,
    debouncedSearch,
    sortField,
    sortDirection,
  ]);
  const qc = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const ch = supabase
      .channel("sinistri-list-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "sinistri" },
        () => qc.invalidateQueries({ queryKey: ["sinistri"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const { data: sinistriResult } = useQuery({
    queryKey: ["sinistri", filtroStato, filtroCompagnia, filtroTerzi, filtroResponsabile, debouncedSearch, page, sortField, sortDirection],
    queryFn: async () => {
      let q = supabase.from("sinistri").select(
        `id, numero_sinistro, stato, descrizione, data_apertura, data_denuncia, controparte, sinistro_terzi, titolo_id, compagnia_id,
         tipo_sinistro, tipo_sinistro_personalizzato,
         compagnie(nome), profiles!sinistri_responsabile_id_fkey(nome, cognome),
         clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente),
         titoli(numero_titolo)`,
        { count: "exact" }
      );
      if (filtroStato !== "tutti") q = q.eq("stato", filtroStato);
      if (filtroCompagnia !== "tutti") q = q.eq("compagnia_id", filtroCompagnia);
      if (filtroTerzi === "terzi") q = q.eq("sinistro_terzi", true);
      if (filtroTerzi === "con_polizza") q = q.eq("sinistro_terzi", false).not("titolo_id", "is", null);
      if (filtroResponsabile !== "tutti") q = q.eq("responsabile_id", filtroResponsabile);

      const term = debouncedSearch.trim();
      if (term) {
        const [{ data: clientiMatch }, { data: profilesMatch }, { data: titoliMatch }] = await Promise.all([
          supabase
            .from("clienti")
            .select("id")
            .or(`cognome.ilike.%${term}%,nome.ilike.%${term}%,ragione_sociale.ilike.%${term}%`)
            .limit(500),
          supabase
            .from("profiles")
            .select("id")
            .or(`cognome.ilike.%${term}%,nome.ilike.%${term}%`)
            .limit(100),
          supabase
            .from("titoli")
            .select("id")
            .ilike("numero_titolo", `%${term}%`)
            .limit(200),
        ]);

        const parts = [
          `numero_sinistro.ilike.%${term}%`,
          `numero_sinistro_compagnia.ilike.%${term}%`,
          `descrizione.ilike.%${term}%`,
        ];
        const clienteIds = (clientiMatch || []).map((c) => c.id);
        if (clienteIds.length > 0) {
          parts.push(`cliente_anagrafica_id.in.(${clienteIds.join(",")})`);
        }
        const responsabileIds = (profilesMatch || []).map((p) => p.id);
        if (responsabileIds.length > 0) {
          parts.push(`responsabile_id.in.(${responsabileIds.join(",")})`);
        }
        const titoloIds = (titoliMatch || []).map((t) => t.id);
        if (titoloIds.length > 0) {
          parts.push(`titolo_id.in.(${titoloIds.join(",")})`);
        }
        q = q.or(parts.join(","));
      }

      const { data, error, count } = await q
        .order(sortField, { ascending: sortDirection === "asc" })
        .range(range.from, range.to);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const sinistri = sinistriResult?.data || [];
  const totalCount = sinistriResult?.count || 0;

  const { data: compagnie } = useQuery({
    queryKey: ["agenzie"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  const { data: responsabili = [] } = useQuery({
    queryKey: ["profiles-responsabili-list"],
    queryFn: async () => {
      const { data: ss } = await supabase
        .from("specialist_sinistri_sedi" as any)
        .select("profilo_id");
      const ids = [...new Set(((ss || []) as unknown as { profilo_id: string }[]).map((r) => r.profilo_id))];
      let q = supabase.from("profiles").select("id, nome, cognome").eq("attivo", true).order("cognome");
      if (ids.length > 0) q = q.in("id", ids);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: eventiScaduti } = useQuery({
    queryKey: ["eventi-scaduti"],
    queryFn: async () => {
      const { data } = await supabase.from("sinistro_eventi").select("id").eq("stato", "scaduto");
      return data?.length || 0;
    },
  });

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(0);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setPage(0);
  };

  const SortableHeader = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => {
    const Icon = sortField === field ? (sortDirection === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <TableHead
        className={`cursor-pointer select-none bg-background ${className || ""}`}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {children}
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </TableHead>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" /> Sinistri
          </h1>
          <p className="text-muted-foreground">Gestione pratiche sinistri</p>
        </div>
        <div className="flex items-center gap-2">
          {(eventiScaduti ?? 0) > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              ⚠ {eventiScaduti} eventi scaduti
            </Badge>
          )}
          <Button onClick={() => navigate("/sinistri/apertura")}>
            <Plus className="h-4 w-4 mr-1" /> Nuovo Sinistro
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per cliente, numero, polizza, descrizione..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroStato} onValueChange={handleFilterChange(setFiltroStato)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            {statiSinistro.map(s => (
              <SelectItem key={s} value={s}>{s === "bozza" ? "Bozza" : s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroCompagnia} onValueChange={handleFilterChange(setFiltroCompagnia)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutte le compagnie</SelectItem>
            {compagnie?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroTerzi} onValueChange={handleFilterChange(setFiltroTerzi)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti</SelectItem>
            <SelectItem value="con_polizza">Con polizza</SelectItem>
            <SelectItem value="terzi">Sinistro Terzi</SelectItem>
          </SelectContent>
        </Select>
        <SearchableSelect
          value={filtroResponsabile === "tutti" ? "" : filtroResponsabile}
          onValueChange={(v) => handleFilterChange(setFiltroResponsabile)(v || "tutti")}
          placeholder="Responsabile interno"
          clearable
          clearLabel="Tutti"
          className="w-52"
          options={responsabili.map((r) => ({
            value: r.id,
            label: `${r.cognome || ""} ${r.nome || ""}`.trim(),
          }))}
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="numero_sinistro">N° Sinistro</SortableHeader>
              <TableHead>Cliente</TableHead>
              <TableHead>Polizza</TableHead>
              <SortableHeader field="controparte">Controparte</SortableHeader>
              <SortableHeader field="tipo_sinistro">Tipo</SortableHeader>
              <SortableHeader field="stato">Stato</SortableHeader>
              <SortableHeader field="compagnia_id">Compagnia</SortableHeader>
              <SortableHeader field="data_apertura">Data Apertura</SortableHeader>
              <SortableHeader field="data_denuncia">Data Denuncia</SortableHeader>
              <TableHead className="min-w-[20rem] max-w-[40rem]">Descrizione</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sinistri.map((s: any) => (
              <TableRow
                key={s.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  if (s.stato === "bozza") {
                    navigate(`/sinistri/apertura?bozza_id=${s.id}`);
                  } else {
                    navigate(`/sinistri/${s.id}`);
                  }
                }}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{s.numero_sinistro || "—"}</span>
                    {s.stato === "bozza" && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-400 text-slate-700 bg-slate-50">
                        Bozza
                      </Badge>
                    )}
                    {s.sinistro_terzi && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-800 bg-amber-50">
                        Sinistro Terzi
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{resolveClienteNome(s.clienti)}</TableCell>
                <TableCell>{s.sinistro_terzi ? "—" : (s.titoli?.numero_titolo || "—")}</TableCell>
                <TableCell className="max-w-[10rem] truncate">{s.controparte || "—"}</TableCell>
                <TableCell>{formatTipoSinistro(s)}</TableCell>
                <TableCell>
                  <Badge className={statoBadge[s.stato] || "bg-muted"}>
                    {s.stato === "bozza" ? "Bozza" : s.stato.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>{s.compagnie?.nome || "—"}</TableCell>
                <TableCell>{s.data_apertura ? format(new Date(s.data_apertura), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell>{s.data_denuncia ? format(new Date(s.data_denuncia), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell className="min-w-[20rem] max-w-[40rem]">
                  <span className="line-clamp-4 whitespace-normal break-words">{s.descrizione || "—"}</span>
                </TableCell>
              </TableRow>
            ))}
            {!sinistri.length && (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nessun sinistro trovato</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <div className="p-4">
          <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
