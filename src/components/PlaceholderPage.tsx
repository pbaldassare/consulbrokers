import { LucideIcon } from "lucide-react";
import { useLocation } from "react-router-dom";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

const PlaceholderPage = ({ title, description, icon: Icon }: PlaceholderPageProps) => {
  const location = useLocation();

  // Build breadcrumb from path
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const breadcrumb = pathSegments.map((s) =>
    s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ")
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Dashboard</span>
        {breadcrumb.map((seg, i) => (
          <span key={i} className="flex items-center gap-2">
            <span>›</span>
            <span>{seg}</span>
          </span>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* Placeholder content */}
      <div className="bg-card rounded-lg border border-border p-8 text-center">
        <Icon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Sezione in costruzione</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Questa sezione sarà disponibile a breve. Stiamo lavorando per offrirti
          la migliore esperienza di gestione.
        </p>
      </div>
    </div>
  );
};

export default PlaceholderPage;
