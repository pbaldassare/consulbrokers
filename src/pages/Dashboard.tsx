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
  AlertCircle,
  DollarSign,
  FileWarning,
  Receipt,
  Calendar,
  MessageSquare,
  FolderOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// ── Shared Components ──

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

const PlaceholderChart = ({ title, icon: Icon }: { title: string; icon: React.ElementType }) => (
  <div className="bg-card rounded-lg border border-border p-5">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <h3 className="font-semibold text-foreground">{title}</h3>
    </div>
    <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
      Nessun dato disponibile
    </div>
  </div>
);

const PlaceholderList = ({ title, icon: Icon }: { title: string; icon: React.ElementType }) => (
  <div className="bg-card rounded-lg border border-border p-5">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <button className="text-sm text-primary font-medium flex items-center gap-1 hover:underline">
        Vedi tutto <ArrowUpRight className="w-3.5 h-3.5" />
      </button>
    </div>
    <div className="text-muted-foreground text-sm py-8 text-center">
      Nessun dato disponibile
    </div>
  </div>
);

// ── Role Dashboards ──

const AdminDashboard = () => (
  <>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard label="Utenti Attivi" value="0" sub="Totale nel sistema" icon={Users} variant="blue" />
      <SummaryCard label="Polizze Attive" value="0" sub="In gestione" icon={FileText} variant="green" />
      <SummaryCard label="Sinistri Aperti" value="0" sub="Da gestire" icon={ClipboardList} variant="orange" />
      <SummaryCard label="Alert Sistema" value="0" sub="Da verificare" icon={AlertCircle} variant="yellow" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Raccolta Premi" value="€ 0" sub="Anno corrente" variant="green" icon={TrendingUp} />
      <KpiCard label="Nuovi Clienti" value="0" sub="Questo mese" variant="blue" icon={Users} />
      <KpiCard label="Tasso Rinnovo" value="0%" sub="Polizze rinnovate" variant="teal" icon={Target} />
      <KpiCard label="Uffici Attivi" value="0" sub="Operativi" variant="yellow" icon={Building2} />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PlaceholderChart title="Distribuzione Polizze per Ramo" icon={PieChart} />
      <PlaceholderChart title="Andamento Raccolta Premi" icon={BarChart3} />
    </div>
    <PlaceholderList title="Attività Recenti" icon={Activity} />
  </>
);

const UfficioDashboard = () => (
  <>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard label="Clienti Ufficio" value="0" sub="Nel tuo ufficio" icon={Users} variant="blue" />
      <SummaryCard label="Incassi Recenti" value="€ 0" sub="Ultimo mese" icon={DollarSign} variant="green" />
      <SummaryCard label="Sinistri Aperti" value="0" sub="Del tuo ufficio" icon={ClipboardList} variant="orange" />
      <SummaryCard label="Scadenze" value="0" sub="Prossimi 30gg" icon={Calendar} variant="yellow" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PlaceholderChart title="Incassi Mensili Ufficio" icon={BarChart3} />
      <PlaceholderChart title="Sinistri per Stato" icon={PieChart} />
    </div>
    <PlaceholderList title="Attività in Scadenza" icon={Activity} />
  </>
);

const ProduttoreDashboard = () => (
  <>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <SummaryCard label="Trattative Aperte" value="0" sub="In corso" icon={Target} variant="blue" />
      <SummaryCard label="Titoli Creati" value="0" sub="Anno corrente" icon={FileText} variant="green" />
      <SummaryCard label="Provvigioni Maturate" value="€ 0" sub="Da liquidare" icon={DollarSign} variant="teal" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PlaceholderChart title="Andamento Trattative" icon={BarChart3} />
      <PlaceholderChart title="Provvigioni Mensili" icon={TrendingUp} />
    </div>
    <PlaceholderList title="Ultime Trattative" icon={Activity} />
  </>
);

const ContabilitaDashboard = () => (
  <>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <SummaryCard label="Anomalie Incroci" value="0" sub="Da verificare" icon={AlertCircle} variant="orange" />
      <SummaryCard label="Fatture da Verificare" value="0" sub="In attesa" icon={FileWarning} variant="yellow" />
      <SummaryCard label="Incassi KO" value="0" sub="Da risolvere" icon={Receipt} variant="blue" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PlaceholderChart title="Anomalie per Tipo" icon={PieChart} />
      <PlaceholderChart title="Stato Fatture" icon={BarChart3} />
    </div>
    <PlaceholderList title="Ultime Anomalie" icon={Activity} />
  </>
);

const CfoDashboard = () => (
  <>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard label="Entrate Totali" value="€ 0" sub="Anno corrente" icon={TrendingUp} variant="green" />
      <SummaryCard label="Uscite Totali" value="€ 0" sub="Anno corrente" icon={DollarSign} variant="orange" />
      <SummaryCard label="Redditività" value="0%" sub="Margine netto" icon={BarChart3} variant="teal" />
      <SummaryCard label="Provvigioni da Pagare" value="€ 0" sub="In attesa" icon={Receipt} variant="yellow" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PlaceholderChart title="Entrate vs Uscite" icon={BarChart3} />
      <PlaceholderChart title="Redditività per Ufficio" icon={PieChart} />
    </div>
    <PlaceholderList title="Pagamenti Provvigioni Recenti" icon={Activity} />
  </>
);

const ClienteDashboard = () => (
  <>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <SummaryCard label="Documenti" value="0" sub="Disponibili" icon={FolderOpen} variant="blue" />
      <SummaryCard label="Pratiche" value="0" sub="In corso" icon={ClipboardList} variant="green" />
      <SummaryCard label="Comunicazioni" value="0" sub="Non lette" icon={MessageSquare} variant="yellow" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PlaceholderList title="Documenti Recenti" icon={FolderOpen} />
      <PlaceholderList title="Stato Pratiche" icon={ClipboardList} />
    </div>
    <PlaceholderList title="Comunicazioni" icon={MessageSquare} />
  </>
);

// ── Main Dashboard ──

const ROLE_LABELS: Record<string, string> = {
  admin: "Amministratore",
  ufficio: "Responsabile Ufficio",
  produttore: "Produttore",
  contabilita: "Contabilità",
  cfo: "CFO",
  cliente: "Cliente",
};

const Dashboard = () => {
  const { profile } = useAuth();
  const ruolo = profile?.ruolo || "admin";
  const displayName = profile
    ? `${profile.nome || ""} ${profile.cognome || ""}`.trim() || profile.email || "Utente"
    : "Utente";
  const roleLabel = ROLE_LABELS[ruolo] || ruolo;

  const renderDashboard = () => {
    switch (ruolo) {
      case "admin": return <AdminDashboard />;
      case "ufficio": return <UfficioDashboard />;
      case "produttore": return <ProduttoreDashboard />;
      case "contabilita": return <ContabilitaDashboard />;
      case "cfo": return <CfoDashboard />;
      case "cliente": return <ClienteDashboard />;
      default: return <AdminDashboard />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Benvenuto, {displayName} • {roleLabel}
            </p>
          </div>
        </div>
      </div>
      {renderDashboard()}
    </div>
  );
};

export default Dashboard;
