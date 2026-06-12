import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell, TableFooter } from "@/components/ui/table";
import { Shield, Calendar, X, FileSpreadsheet, FileText } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import { SearchableSelect } from "@/components/SearchableSelect";
import { fmtEuro as fmt } from "@/lib/formatCurrency";
import { DatePicker } from "@/components/contabilita/DatePicker";

const statoBadge: Record<string, string> = {
  attivo: "bg-emerald-100 text-emerald-800 border-emerald-300",
  scaduto: "bg-red-100 text-red-800 border-red-300",
  sospeso: "bg-yellow-100 text-yellow-800 border-yellow-300",
  incassato: "bg-blue-100 text-blue-800 border-blue-300",
};


const ClientePolizze = () => {
  const { user } = useAuth();
  const [titoli, setTitoli] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // filtri
  const [stato, setStato] = useState<string>("");
  const [ramo, setRamo] = useState<string>("");
  const [compagnia, setCompagnia] = useState<string>("");
  const [search, setSearch] = useState("");
  const [scadDa, setScadDa] = useState<Date | null>(null);
  const [scadA, setScadA] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: clienteIds } = await supabase.rpc("get_my_cliente_ids");
      if (!clienteIds?.length) { setLoading(false); return; }
      const ids = clienteIds.map((c: any) => c);

      const [titoliRes, cgaRes] = await Promise.all([
        supabase
          .from("titoli")
          .select("id, numero_titolo, stato, premio_lordo, premio_netto, cig_rif, data_scadenza, durata_da, periodicita, descrizione_polizza, produttore_nome, targa_telaio, prodotto_nome, compagnie(nome), rami(descrizione)")
          .in("cliente_anagrafica_id", ids)
          .order("created_at", { ascending: false }),
        supabase
          .from("polizza_cga")
          .select("id, numero_polizza, stato, data_decorrenza, data_scadenza, premio_lordo_totale, premio_imponibile_totale, frazionamento, prodotti_cga(nome_prodotto, compagnia, ramo)")
          .in("cliente_id", ids)
          .eq("stato", "approvato")
          .order("created_at", { ascending: false }),
      ]);

      const fromTitoli = (titoliRes.data ?? []).map((t: any) => ({
        ...t,
        _source: "titoli" as const,
        _detailPath: `/cliente/polizze/${t.id}`,
      }));

      const fromCga = (cgaRes.data ?? []).map((p: any) => ({
        id: p.id,
        _source: "cga" as const,
        _detailPath: `/cliente/assistente?polizza=${p.id}`,
        numero_titolo: p.numero_polizza ?? "—",
        stato: "attivo",
        premio_lordo: p.premio_lordo_totale,
        premio_netto: p.premio_imponibile_totale,
        cig_rif: null,
        data_scadenza: p.data_scadenza,
        durata_da: p.data_decorrenza,
        periodicita: p.frazionamento,
        descrizione_polizza: p.prodotti_cga?.ramo ?? null,
        produttore_nome: null,
        targa_telaio: null,
        prodotto_nome: p.prodotti_cga?.nome_prodotto ?? p.prodotti_cga?.ramo ?? null,
        compagnie: p.prodotti_cga?.compagnia ? { nome: p.prodotti_cga.compagnia } : null,
        rami: p.prodotti_cga?.ramo ? { descrizione: p.prodotti_cga.ramo } : null,
      }));

      setTitoli([...fromCga, ...fromTitoli]);
      setLoading(false);
    };
    load();
  }, [user]);

  const ramiOptions = useMemo(() => {
    const set = new Map<string, string>();
    titoli.forEach(t => { const r = t.rami?.descrizione; if (r) set.set(r, r); });
    return [{ value: "", label: "Tutti i rami" }, ...Array.from(set.values()).sort().map(r => ({ value: r, label: r }))];
  }, [titoli]);

  const compagnieOptions = useMemo(() => {
    const set = new Map<string, string>();
    titoli.forEach(t => { const c = t.compagnie?.nome; if (c) set.set(c, c); });
    return [{ value: "", label: "Tutte le compagnie" }, ...Array.from(set.values()).sort().map(c => ({ value: c, label: c }))];
  }, [titoli]);

  const statiOptions = [
    { value: "", label: "Tutti gli stati" },
    { value: "attivo", label: "Attivo" },
    { value: "sospeso", label: "Sospeso" },
    { value: "scaduto", label: "Scaduto" },
    { value: "incassato", label: "Incassato" },
  ];

  const filtered = useMemo(() => {
    return titoli.filter(t => {
      if (stato && t.stato !== stato) return false;
      if (ramo && t.rami?.descrizione !== ramo) return false;
      if (compagnia && t.compagnie?.nome !== compagnia) return false;
      if (scadDa && (!t.data_scadenza || new Date(t.data_scadenza) < scadDa)) return false;
      if (scadA && (!t.data_scadenza || new Date(t.data_scadenza) > scadA)) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${t.numero_titolo ?? ""} ${t.targa_telaio ?? ""} ${t.prodotto_nome ?? ""} ${t.descrizione_polizza ?? ""} ${t.cig_rif ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [titoli, stato, ramo, compagnia, scadDa, scadA, search]);

  const resetFiltri = () => {
    setStato(""); setRamo(""); setCompagnia(""); setSearch(""); setScadDa(null); setScadA(null);
  };

  const filtriAttivi = stato || ramo || compagnia || search || scadDa || scadA;

  const buildExportRows = () =>
    filtered.map(t => ({
      Stato: t.stato ?? "",
      Compagnia: t.compagnie?.nome ?? "",
      Produttore: t.produttore_nome ?? "",
      Prodotto: t.rami?.descrizione ?? t.prodotto_nome ?? t.descrizione_polizza ?? "",
      "N° Polizza": t.numero_titolo ?? "",
      Targa: t.targa_telaio ?? "",
      CIG: t.cig_rif ?? "",
      "Data Scadenza": t.data_scadenza ? format(new Date(t.data_scadenza), "dd/MM/yyyy") : "",
      Periodicita: t.periodicita ?? "",
      "Premio Imponibile": t.premio_netto ?? 0,
      "Premio Lordo": t.premio_lordo ?? 0,
    }));

  const fileBase = `polizze_${format(new Date(), "yyyyMMdd")}`;

  const exportCSV = () => {
    const rows = buildExportRows();
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(";"),
      ...rows.map(r => headers.map(h => escape(r[h])).join(";"))
    ].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${fileBase}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportXLSX = () => {
    const rows = buildExportRows();
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Polizze");
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
  };

  if (loading)
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
      </div>
    );

  const today = new Date();
  const totale = filtered.reduce((sum, t) => sum + (t.premio_lordo ?? 0), 0);
  const totaleImponibile = filtered.reduce((sum, t) => sum + (t.premio_netto ?? 0), 0);

  return (
    <div data-tour="cl-pol-page" className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-teal-700 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground uppercase tracking-wide">
              Elenco Posizioni Assicurative
            </h1>
            <p className="text-sm text-muted-foreground">{filtered.length} di {titoli.length} polizze</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!filtered.length} className="gap-1.5">
            <FileText className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportXLSX} disabled={!filtered.length} className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      {/* Filtri */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <SearchableSelect options={statiOptions} value={stato} onValueChange={setStato} placeholder="Stato" />
            <SearchableSelect options={ramiOptions} value={ramo} onValueChange={setRamo} placeholder="Ramo" />
            <SearchableSelect options={compagnieOptions} value={compagnia} onValueChange={setCompagnia} placeholder="Compagnia" />
            <Input placeholder="Cerca polizza / targa / prodotto / CIG" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="flex gap-2">
              <DatePicker value={scadDa} onChange={setScadDa} placeholder="Scad. da" />
              <DatePicker value={scadA} onChange={setScadA} placeholder="Scad. a" />
            </div>
            {filtriAttivi && (
              <Button variant="ghost" size="sm" onClick={resetFiltri} className="gap-1.5 self-center">
                <X className="h-4 w-4" /> Reset filtri
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nessuna polizza trovata.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-teal-700 hover:bg-teal-700">
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider">Stato</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider">Mandato / Agenzia</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider">Prodotto</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider">N° Polizza / Targa</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider">CIG</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider">Data Scadenza</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider text-center">Fraz.</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider text-right">Premio Imponibile</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider text-right">Premio Annuo Lordo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t, idx) => {
                  const giorni = t.data_scadenza ? differenceInDays(new Date(t.data_scadenza), today) : null;
                  const compagnia = t.compagnie?.nome ?? "—";
                  const prodotto = t.rami?.descrizione ?? t.prodotto_nome ?? t.descrizione_polizza ?? "—";
                  const polizzaTarga = [t.numero_titolo, t.targa_telaio].filter(Boolean).join(" / ") || "N/D";

                  return (
                    <TableRow key={t.id} className={`cursor-pointer transition-colors hover:bg-teal-50 ${idx % 2 === 0 ? "bg-white" : "bg-muted/30"}`}>
                      <TableCell className="py-2.5"><Link to={t._detailPath} className="block">
                        <Badge className={`text-[10px] ${statoBadge[t.stato] ?? "bg-muted text-muted-foreground"}`}>{t.stato}</Badge>
                      </Link></TableCell>
                      <TableCell className="py-2.5"><Link to={t._detailPath} className="block">
                        <p className="font-semibold text-sm text-foreground">{compagnia}</p>
                        {t.produttore_nome && <p className="text-xs text-muted-foreground">{t.produttore_nome}</p>}
                      </Link></TableCell>
                      <TableCell className="py-2.5"><Link to={t._detailPath} className="block">
                        <p className="text-sm font-medium text-teal-800">{prodotto}</p>
                      </Link></TableCell>
                      <TableCell className="py-2.5"><Link to={t._detailPath} className="block">
                        <p className="text-sm font-mono text-foreground">{polizzaTarga}</p>
                      </Link></TableCell>
                      <TableCell className="py-2.5"><Link to={t._detailPath} className="block">
                        <p className="text-xs font-mono text-muted-foreground">{t.cig_rif ?? "—"}</p>
                      </Link></TableCell>
                      <TableCell className="py-2.5"><Link to={t._detailPath} className="block">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{t.data_scadenza ? format(new Date(t.data_scadenza), "dd/MM/yyyy", { locale: it }) : "—"}</span>
                        </div>
                        {giorni !== null && giorni >= 0 && giorni <= 90 && (
                          <Badge className={`mt-0.5 text-[10px] ${giorni <= 30 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>{giorni} gg</Badge>
                        )}
                      </Link></TableCell>
                      <TableCell className="py-2.5 text-center"><Link to={t._detailPath} className="block">
                        <span className="text-sm">{t.periodicita ?? "—"}</span>
                      </Link></TableCell>
                      <TableCell className="py-2.5 text-right"><Link to={t._detailPath} className="block">
                        <span className="text-sm text-foreground">{t.premio_netto ? fmt(t.premio_netto) : "—"}</span>
                      </Link></TableCell>
                      <TableCell className="py-2.5 text-right"><Link to={t._detailPath} className="block">
                        <span className="text-sm font-bold text-foreground">{t.premio_lordo ? fmt(t.premio_lordo) : "—"}</span>
                      </Link></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-teal-50 border-t-2 border-teal-700">
                  <TableCell colSpan={7} className="font-bold text-sm text-teal-900 uppercase">Totale</TableCell>
                  <TableCell className="text-right font-bold text-sm text-teal-900">{fmt(totaleImponibile)}</TableCell>
                  <TableCell className="text-right font-bold text-base text-teal-900">{fmt(totale)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientePolizze;
