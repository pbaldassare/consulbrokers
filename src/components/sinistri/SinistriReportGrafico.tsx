import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, FileSpreadsheet, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/SearchableSelect";
import { fmtEuro0 } from "@/lib/formatCurrency";
import {
  aggregateFrequenzaMensile,
  aggregatePerStato,
  aggregatePerTipo,
  aggregatePerZona,
  buildSinistriReportKpi,
  topZonaChart,
  type SinistroReportRow,
} from "@/lib/sinistriReportGrafico";

const PIE_COLORS = ["#0d9488", "#ea580c", "#2563eb", "#059669", "#7c3aed", "#db2777", "#ca8a04", "#64748b"];

type Props = {
  rows: SinistroReportRow[];
  loading?: boolean;
  exporting?: boolean;
  onExport: () => void;
  eventoDa: string;
  eventoA: string;
  onEventoDa: (v: string) => void;
  onEventoA: (v: string) => void;
  compagniaId: string;
  compagnie: { id: string; nome: string }[];
  onCompagnia: (id: string) => void;
  responsabileId: string;
  responsabili: { id: string; nome: string | null; cognome: string | null }[];
  onResponsabile: (id: string) => void;
};

export function SinistriReportGrafico({
  rows,
  loading,
  exporting,
  onExport,
  eventoDa,
  eventoA,
  onEventoDa,
  onEventoA,
  compagniaId,
  compagnie,
  onCompagnia,
  responsabileId,
  responsabili,
  onResponsabile,
}: Props) {
  const kpi = useMemo(() => buildSinistriReportKpi(rows), [rows]);
  const zonaAll = useMemo(() => aggregatePerZona(rows), [rows]);
  const zonaChart = useMemo(() => topZonaChart(zonaAll, 12), [zonaAll]);
  const frequenza = useMemo(() => aggregateFrequenzaMensile(rows), [rows]);
  const perTipo = useMemo(() => aggregatePerTipo(rows), [rows]);
  const perStato = useMemo(() => aggregatePerStato(rows), [rows]);
  const zonaChartH = Math.max(280, zonaChart.length * 28);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Accadimento dal</p>
          <Input type="date" value={eventoDa} onChange={(e) => onEventoDa(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Accadimento al</p>
          <Input type="date" value={eventoA} onChange={(e) => onEventoA(e.target.value)} className="w-40" />
        </div>
        <SearchableSelect
          options={compagnie.map((c) => ({ value: c.id, label: c.nome }))}
          value={compagniaId === "tutti" ? "" : compagniaId}
          onValueChange={(id) => onCompagnia(id || "tutti")}
          placeholder="Tutte le compagnie"
          searchPlaceholder="Cerca compagnia…"
          clearable
          clearLabel="Tutte le compagnie"
          className="w-56"
        />
        <SearchableSelect
          options={responsabili.map((r) => ({
            value: r.id,
            label: `${r.cognome || ""} ${r.nome || ""}`.trim(),
          }))}
          value={responsabileId === "tutti" ? "" : responsabileId}
          onValueChange={(id) => onResponsabile(id || "tutti")}
          placeholder="Responsabile interno"
          clearable
          clearLabel="Tutti"
          className="w-52"
        />
        <Button variant="outline" onClick={onExport} disabled={exporting || !rows.length} className="ml-auto">
          <FileSpreadsheet className="h-4 w-4 mr-1 text-green-700" />
          {exporting ? "Generazione…" : "Genera Excel"}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Sinistri", value: String(kpi.totale) },
          { label: "Aperti", value: String(kpi.aperti) },
          { label: "Chiusi", value: String(kpi.chiusi) },
          { label: "Riserva", value: fmtEuro0(kpi.riserva) },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-2xl font-semibold tracking-tight">{loading ? "…" : k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Caricamento report…</p>
      ) : !rows.length ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Nessun sinistro nel periodo. Allarga le date o togli i filtri.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-teal-700" /> Sinistri per zona
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={zonaChartH}>
                  <BarChart data={zonaChart} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="aperti" name="Aperti" stackId="a" fill="#ea580c" />
                    <Bar dataKey="chiusi" name="Chiusi" stackId="a" fill="#059669" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {kpi.conZona} di {kpi.totale} con zona/luogo. Luogo e città se valorizzati.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-teal-700" /> Frequenza mensile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(280, frequenza.length > 18 ? 320 : 280)}>
                  <LineChart data={frequenza} margin={{ top: 8, right: 12, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={56} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="sinistri" name="Sinistri" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="aperti" name="Aperti" stroke="#ea580c" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Per tipo (aperti / chiusi)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={perTipo} margin={{ top: 10, right: 10, left: 0, bottom: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-22} textAnchor="end" height={64} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="aperti" name="Aperti" stackId="a" fill="#ea580c" />
                    <Bar dataKey="chiusi" name="Chiusi" stackId="a" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Per stato</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={perStato} dataKey="value" nameKey="name" cx="42%" cy="50%" innerRadius={52} outerRadius={86} paddingAngle={2}>
                      {perStato.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      wrapperStyle={{ fontSize: 11, maxWidth: 180 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Dettaglio per zona</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zona</TableHead>
                    <TableHead className="text-right">Sinistri</TableHead>
                    <TableHead className="text-right">Aperti</TableHead>
                    <TableHead className="text-right">Chiusi</TableHead>
                    <TableHead className="text-right">Riserva</TableHead>
                    <TableHead className="text-right">Liquidato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zonaAll.map((z) => (
                    <TableRow key={z.name}>
                      <TableCell>{z.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{z.sinistri}</TableCell>
                      <TableCell className="text-right tabular-nums">{z.aperti}</TableCell>
                      <TableCell className="text-right tabular-nums">{z.chiusi}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtEuro0(z.riserva)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtEuro0(z.liquidato)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default SinistriReportGrafico;
