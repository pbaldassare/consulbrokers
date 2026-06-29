import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Home, ChevronLeft } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { getPreviousListRoute } from "@/hooks/useNavigationHistory";
import { useRecentEntities } from "@/hooks/useRecentEntities";
import {
  detectEntityFromContext,
  resolveEntityLabel,
  type EntityInfo,
} from "@/lib/entityResolver";

const ROUTE_LABELS: Record<string, string> = {
  "": "Home",
  "prospect": "Prospect",
  "trattative": "Trattative",
  "archivi": "Archivi",
  "clienti": "Clienti",
  "anagrafiche": "Anagrafiche Professionali",
  "agenzie": "Agenzie / Agenzie",
  "categorie": "Categorie",
  "prodotti": "Prodotti",
  "portafoglio": "Portafoglio",
  "gestione-polizze": "Gestione Polizze",
  "immissione": "Immissione",
  "appendici": "Appendici",
  "duplicazione": "Duplicazione",
  "conferma-emittende": "Conferma Emittende",
  "rinnovi": "Rinnovi",
  "storno": "Storno",
  "diff-provvigionali": "Diff. Provvigionali",
  "sospensione": "Sospensione",
  "riattivazione": "Riattivazione",
  "doc-precontrattuale": "Doc. Precontrattuale",
  "estrazioni-stampe": "Estrazioni e Stampe",
  "estrazioni": "Estrazioni",
  "per-cliente": "Per Cliente",
  "per-agenzia": "Per Agenzia",
  "premi-provvigioni": "Premi e Provvigioni",
  "premi-scoperti-garantiti": "Premi Scoperti e Garantiti",
  "ec-clienti": "E/C Clienti",
  "regolazioni": "Regolazioni",
  "documentale": "Documentale",
  "rientro-documenti": "Rientro Documenti",
  "import-titoli": "Import Titoli",
  "titoli": "Titoli",
  "sinistri": "Sinistri",
  "apertura": "Apertura",
  "prescrizioni": "Prescrizioni",
  "scadenze": "Scadenze",
  "report-sir": "Report SIR",
  "contabilita": "Contabilità operativa",
  "carico": "Avvisi di incasso",
  "chiusura-giornaliera": "Chiusura Giornaliera",
  "ec-agenzia": "E/C Agenzie",
  "ec-produttori": "E/C Produttori",
  "stampa-primanota": "Stampa Primanota",
  "check-primanota": "Check Primanota",
  "stampa-sospesi": "Riepilogo Acconti",
  "anticipi-clienti": "Riepilogo Acconti",
  "anomalie-ko": "Anomalie KO",
  "note-restituzione": "Note Restituzione",
  "spedizioni": "Spedizioni",
  "notifiche": "Notifiche",
  "privacy": "Privacy e Consensi",
  "report-iva": "Report IVA",
  "flussi-agenzie": "Flussi Agenzie",
  "pagamenti-provvigioni": "Pagamenti Provvigioni",
  "report": "Report",
  "comunicazioni": "Comunicazioni",
  "impostazioni": "Impostazioni",
  "crea-utente": "Crea Utente",
  "gestione-utenti": "Gestione Utenti",
  "backup-export": "Backup & Export",
  "manutenzione": "Manutenzione",
  "tabelle-base": "Tabelle di Base",
  "anomalie-sistema": "Anomalie Sistema",
  "login": "Login",
  "reset-password": "Reset Password",
};

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

interface EntityPreviewProps {
  uuid: string;
  parentSegment: string | undefined;
  fullPath: string;
}

const EntityPreview = ({ uuid, parentSegment, fullPath }: EntityPreviewProps) => {
  const { recent, pinned } = useRecentEntities();
  const [info, setInfo] = useState<EntityInfo | null>(() => {
    const hit = [...pinned, ...recent].find((r) => r.id === uuid);
    return hit ? { label: hit.label, sub: hit.sub } : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (info) return;
    const m = detectEntityFromContext(parentSegment, uuid, fullPath);
    if (!m) return;
    let cancelled = false;
    setLoading(true);
    resolveEntityLabel(m)
      .then((r) => {
        if (!cancelled && r) setInfo(r);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [info, uuid, parentSegment, fullPath]);

  if (loading && !info) {
    return <div className="text-xs text-muted-foreground">Caricamento…</div>;
  }
  if (!info) {
    return <div className="text-xs text-muted-foreground">Nessun dettaglio disponibile.</div>;
  }
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium leading-tight">{info.label}</div>
      {info.sub && <div className="text-xs text-muted-foreground">{info.sub}</div>}
      <div className="pt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
        ID {uuid.slice(0, 8)}…
      </div>
    </div>
  );
};

const PageBreadcrumb = () => {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname === "/") return null;

  const segments = location.pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, i) => ({
    raw: seg,
    isUuid: isUuid(seg),
    label: isUuid(seg)
      ? "Dettaglio"
      : ROUTE_LABELS[seg] || seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    path: "/" + segments.slice(0, i + 1).join("/"),
    parent: i > 0 ? segments[i - 1] : undefined,
    isLast: i === segments.length - 1,
  }));

  const prev = getPreviousListRoute(location.pathname + location.search);

  return (
    <div className="flex items-center gap-3 mb-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/")}
        className="h-8 px-2 text-muted-foreground hover:text-foreground"
      >
        <Home className="w-4 h-4 mr-1" />
        Home
      </Button>

      <div className="h-4 w-px bg-border" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => (prev ? navigate(prev.path) : navigate(-1))}
        className="h-8 px-2 text-muted-foreground hover:text-foreground"
        title={prev ? `Torna a ${prev.label}` : "Indietro"}
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        {prev ? `Torna a ${prev.label}` : "Indietro"}
      </Button>

      <div className="h-4 w-px bg-border" />

      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, i) => (
            <span key={crumb.path} className="contents">
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.isUuid ? (
                  <HoverCard openDelay={150} closeDelay={80}>
                    <HoverCardTrigger asChild>
                      {crumb.isLast ? (
                        <BreadcrumbPage className="cursor-default">{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          className="cursor-pointer"
                          onClick={() => navigate(crumb.path)}
                        >
                          {crumb.label}
                        </BreadcrumbLink>
                      )}
                    </HoverCardTrigger>
                    <HoverCardContent align="start" className="w-72">
                      <EntityPreview
                        uuid={crumb.raw}
                        parentSegment={crumb.parent}
                        fullPath={crumb.path}
                      />
                    </HoverCardContent>
                  </HoverCard>
                ) : crumb.isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink className="cursor-pointer" onClick={() => navigate(crumb.path)}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};

export default PageBreadcrumb;
