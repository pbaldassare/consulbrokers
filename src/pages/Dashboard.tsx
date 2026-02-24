import {
  Users,
  Building2,
  FileText,
  BarChart3,
  TrendingUp,
  Target,
  ClipboardList,
  Activity,
  PieChart,
  ArrowUpRight,
} from "lucide-react";

const Dashboard = () => {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Benvenuto, Mario Rossi • mario.rossi@assicura.it
            </p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Clienti Attivi" value="0" sub="Nel tuo portafoglio" icon={Users} variant="blue" />
        <SummaryCard label="Polizze Attive" value="0" sub="In gestione" icon={FileText} variant="green" />
        <SummaryCard label="Sinistri Aperti" value="0" sub="Assegnati a te" icon={ClipboardList} variant="orange" />
        <SummaryCard label="Scadenze Prossime" value="0" sub="Nei prossimi 30gg" icon={Activity} variant="yellow" />
      </div>

      {/* KPI section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Dashboard KPI</h2>
          <span className="text-sm text-muted-foreground">Panoramica delle performance</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Raccolta Premi"
            value="€ 0"
            sub="Totale anno corrente"
            variant="green"
            icon={TrendingUp}
          />
          <KpiCard
            label="Nuovi Clienti"
            value="0"
            sub="Questo mese"
            variant="blue"
            icon={Users}
          />
          <KpiCard
            label="Tasso Rinnovo"
            value="0%"
            sub="Polizze rinnovate"
            variant="teal"
            icon={Target}
          />
          <KpiCard
            label="Sinistri"
            value="0"
            sub="0 aperti · 0 chiusi"
            variant="yellow"
            icon={ClipboardList}
          />
        </div>
      </div>

      {/* Charts placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Distribuzione Polizze per Ramo</h3>
          </div>
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            Nessun dato disponibile
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Andamento Raccolta Premi</h3>
          </div>
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            Nessun dato disponibile
          </div>
        </div>
      </div>

      {/* Recent activities */}
      <div className="bg-card rounded-lg border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Attività Recenti</h3>
          </div>
          <button className="text-sm text-primary font-medium flex items-center gap-1 hover:underline">
            Vedi tutto <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-muted-foreground text-sm py-8 text-center">
          Nessuna attività recente
        </div>
      </div>
    </div>
  );
};

type Variant = "green" | "blue" | "yellow" | "orange" | "teal";

const variantMap: Record<Variant, { bg: string; border: string; icon: string }> = {
  green: { bg: "bg-kpi-green-bg", border: "border-kpi-green-border", icon: "text-kpi-green-text" },
  blue: { bg: "bg-kpi-blue-bg", border: "border-kpi-blue-border", icon: "text-kpi-blue-text" },
  yellow: { bg: "bg-kpi-yellow-bg", border: "border-kpi-yellow-border", icon: "text-kpi-yellow-text" },
  orange: { bg: "bg-kpi-orange-bg", border: "border-kpi-orange-border", icon: "text-kpi-orange-text" },
  teal: { bg: "bg-kpi-teal-bg", border: "border-kpi-teal-border", icon: "text-kpi-teal-text" },
};

interface SummaryCardProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  variant: Variant;
}

const SummaryCard = ({ label, value, sub, icon: Icon, variant }: SummaryCardProps) => (
  <div className="bg-card rounded-lg border border-border p-5 flex items-start justify-between">
    <div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
    <div className={`w-9 h-9 rounded-lg ${variantMap[variant].bg} flex items-center justify-center`}>
      <Icon className={`w-[18px] h-[18px] ${variantMap[variant].icon}`} />
    </div>
  </div>
);

interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  variant: Variant;
  icon: React.ElementType;
}

const KpiCard = ({ label, value, sub, variant, icon: Icon }: KpiCardProps) => (
  <div className={`rounded-lg border p-5 ${variantMap[variant].bg} ${variantMap[variant].border}`}>
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`w-4 h-4 ${variantMap[variant].icon}`} />
      <span className={`text-sm font-medium ${variantMap[variant].icon}`}>{label}</span>
    </div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
  </div>
);

export default Dashboard;
