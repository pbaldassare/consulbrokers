import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import RoleGuard from "./components/RoleGuard";
import AuthGuard from "./components/AuthGuard";
import MainLayout from "./components/MainLayout";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Dashboard from "./pages/Dashboard";
import PlaceholderPage from "./components/PlaceholderPage";
import GestioneTemplateRuoli from "./pages/GestioneTemplateRuoli";
import CreaNuovoUtente from "./pages/CreaNuovoUtente";
import ProspectList from "./pages/ProspectList";
import ProspectDetail from "./pages/ProspectDetail";
import TrattativeList from "./pages/TrattativeList";
import CompagnieList from "./pages/CompagnieList";
import ClientiList from "./pages/ClientiList";
import CategorieList from "./pages/CategorieList";
import ProdottiList from "./pages/ProdottiList";
import MatriceProvvigioni from "./pages/MatriceProvvigioni";
import TitoliList from "./pages/TitoliList";
import TitoloDetail from "./pages/TitoloDetail";
import RimessaList from "./pages/RimessaList";
import RimessaDetail from "./pages/RimessaDetail";
import ContabilitaUfficio from "./pages/ContabilitaUfficio";
import AreaCFO from "./pages/AreaCFO";
import SinistriList from "./pages/SinistriList";
import DiffProvvigioniPage from "./pages/DiffProvvigioniPage";
import SospensionePolizzaPage from "./pages/SospensionePolizzaPage";
import SinistroDetail from "./pages/SinistroDetail";
import PrivacyConsensi from "./pages/PrivacyConsensi";
import BancaImport from "./pages/BancaImport";
import AnomalieKO from "./pages/AnomalieKO";
import AnomalieList from "./pages/AnomalieList";
import NotifichePage from "./pages/NotifichePage";
import NoteRestituzioneList from "./pages/NoteRestituzioneList";
import NotaRestituzioneDetail from "./pages/NotaRestituzioneDetail";
import SpedizioniList from "./pages/SpedizioniList";
import ReportIVA from "./pages/ReportIVA";
import PortafoglioList from "./pages/PortafoglioList";
import PortafoglioDetail from "./pages/PortafoglioDetail";
import FlussiCompagnieList from "./pages/FlussiCompagnieList";
import FlussoCompagniaDetail from "./pages/FlussoCompagniaDetail";
import PagamentiProvvigioniList from "./pages/PagamentiProvvigioniList";
import PagamentoProvvigioneDetail from "./pages/PagamentoProvvigioneDetail";
import ReportPage from "./pages/ReportPage";
import ImpostazioniPage from "./pages/ImpostazioniPage";
import BackupExport from "./pages/BackupExport";
import ManutenzionePage from "./pages/ManutenzionePage";
import GestioneUtenti from "./pages/GestioneUtenti";
import AnagraficheProfessionaliPage from "./pages/AnagraficheProfessionaliPage";
import GestionePolizzePage from "./pages/GestionePolizzePage";
import AppendiciPolizzaPage from "./pages/AppendiciPolizzaPage";
import ImmissionePolizzaPage from "./pages/ImmissionePolizzaPage";
import DuplicazionePolizzaPage from "./pages/DuplicazionePolizzaPage";
import ConfermaEmittendePage from "./pages/ConfermaEmittendePage";
import RinnoviPolizzaPage from "./pages/RinnoviPolizzaPage";
import StornoPolizzaPage from "./pages/StornoPolizzaPage";
import EstrazioniStampePage from "./pages/EstrazioniStampePage";
import NotFound from "./pages/NotFound";
import {
  Users,
  FileText,
  AlertTriangle,
  Calculator,
  BarChart3,
  Percent,
  Send,
  Mail,
  Shield,
  Settings,
  Printer,
  BookOpen,
  ClipboardList,
  FileCheck,
  FileUp,
  FilePlus,
  Clock,
  CalendarCheck,
  Bell,
  CheckSquare,
  Building2,
  ListChecks,
  FileOutput,
  FileStack,
  Import,
  ArrowRightLeft,
  Landmark,
  Search,
} from "lucide-react";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<AuthGuard><MainLayout /></AuthGuard>}>
              {/* HOME */}
              <Route path="/" element={<Dashboard />} />

              {/* ARCHIVI */}
              <Route path="/prospect" element={<ProspectList />} />
              <Route path="/prospect/:id" element={<ProspectDetail />} />
              <Route path="/archivi/clienti" element={<ClientiList />} />
              <Route path="/archivi/anagrafiche" element={<AnagraficheProfessionaliPage />} />
              <Route path="/compagnie" element={<RoleGuard allowedRoles={["admin"]}><CompagnieList /></RoleGuard>} />
              <Route path="/categorie" element={<RoleGuard allowedRoles={["admin"]}><CategorieList /></RoleGuard>} />
              <Route path="/prodotti" element={<RoleGuard allowedRoles={["admin"]}><ProdottiList /></RoleGuard>} />

              {/* PORTAFOGLIO */}
              <Route path="/titoli" element={<TitoliList />} />
              <Route path="/titoli/:id" element={<TitoloDetail />} />
              <Route path="/portafoglio/gestione-polizze" element={<GestionePolizzePage />} />
              <Route path="/portafoglio/immissione" element={<ImmissionePolizzaPage />} />
              <Route path="/portafoglio/appendici" element={<AppendiciPolizzaPage />} />
              <Route path="/portafoglio/duplicazione" element={<DuplicazionePolizzaPage />} />
              <Route path="/portafoglio/conferma-emittende" element={<ConfermaEmittendePage />} />
              <Route path="/portafoglio/rinnovi" element={<RinnoviPolizzaPage />} />
              <Route path="/portafoglio/storno" element={<StornoPolizzaPage />} />
              <Route path="/portafoglio/diff-provvigionali" element={<DiffProvvigioniPage />} />
              <Route path="/portafoglio/sospensione" element={<PlaceholderPage title="Sospensione" description="Sospensione polizze" icon={Clock} />} />
              <Route path="/portafoglio/riattivazione" element={<PlaceholderPage title="Riattivazione" description="Riattivazione polizze sospese" icon={CheckSquare} />} />
              <Route path="/portafoglio/doc-precontrattuale" element={<PlaceholderPage title="Doc. Precontrattuale" description="Documentazione precontrattuale" icon={ClipboardList} />} />
              <Route path="/portafoglio/estrazioni-stampe" element={<EstrazioniStampePage />} />
              <Route path="/portafoglio/estrazioni/per-cliente" element={<PlaceholderPage title="Portafoglio per Cliente" description="Estrazione portafoglio raggruppato per cliente" icon={Users} />} />
              <Route path="/portafoglio/estrazioni/per-compagnia" element={<PlaceholderPage title="Portafoglio per Compagnia" description="Estrazione portafoglio per compagnia" icon={Building2} />} />
              <Route path="/portafoglio/estrazioni/premi-provvigioni" element={<PlaceholderPage title="Premi e Provvigioni" description="Riepilogo premi e provvigioni" icon={Percent} />} />
              <Route path="/portafoglio/estrazioni/premi-scoperti-garantiti" element={<PlaceholderPage title="Premi Scoperti e Garantiti" description="Report premi scoperti e garantiti" icon={Shield} />} />
              <Route path="/portafoglio/estrazioni/ec-clienti" element={<PlaceholderPage title="E/C Clienti" description="Estratto conto clienti" icon={FileText} />} />
              <Route path="/portafoglio/collettive" element={<PlaceholderPage title="Collettive / Libri Matricola" description="Gestione polizze collettive e libri matricola" icon={BookOpen} />} />
              <Route path="/portafoglio/regolazioni" element={<PlaceholderPage title="Regolazioni" description="Regolazioni premio polizze" icon={ClipboardList} />} />
              <Route path="/portafoglio/documentale" element={<PlaceholderPage title="Documentale" description="Archivio documentale polizze" icon={FileText} />} />
              <Route path="/trattative" element={<TrattativeList />} />
              <Route path="/portafoglio/rientro-documenti" element={<PlaceholderPage title="Rientro Documenti" description="Gestione rientro documenti dalle compagnie" icon={FileCheck} />} />
              <Route path="/portafoglio/import-titoli" element={<PlaceholderPage title="Import Titoli (Excel)" description="Importazione massiva titoli da file Excel" icon={FileUp} />} />

              {/* SINISTRI */}
              <Route path="/sinistri" element={<SinistriList />} />
              <Route path="/sinistri/:id" element={<SinistroDetail />} />
              <Route path="/sinistri/apertura" element={<PlaceholderPage title="Apertura Sinistro" description="Apertura nuovo sinistro" icon={FilePlus} />} />
              <Route path="/sinistri/prescrizioni" element={<PlaceholderPage title="Prescrizioni" description="Gestione prescrizioni sinistri" icon={Clock} />} />
              <Route path="/sinistri/scadenze" element={<PlaceholderPage title="Scadenze Sinistri" description="Scadenziario sinistri" icon={CalendarCheck} />} />
              <Route path="/sinistri/report-sir" element={<PlaceholderPage title="Report Sanitario SIR" description="Report sanitario sinistri" icon={FileText} />} />

              {/* CONTABILITÀ */}
              <Route path="/contabilita" element={<ContabilitaUfficio />} />
              <Route path="/contabilita/avvisi-incasso" element={<PlaceholderPage title="Avvisi Incasso" description="Gestione avvisi di incasso" icon={Bell} />} />
              <Route path="/contabilita/chiusura-giornaliera" element={<PlaceholderPage title="Chiusura Giornaliera" description="Chiusura giornaliera di cassa" icon={CheckSquare} />} />
              <Route path="/contabilita/ec-clienti" element={<PlaceholderPage title="E/C Clienti" description="Estratto conto clienti" icon={Users} />} />
              <Route path="/contabilita/ec-compagnia" element={<PlaceholderPage title="E/C Compagnia" description="Estratto conto compagnie" icon={Building2} />} />
              <Route path="/contabilita/ec-produttori" element={<PlaceholderPage title="E/C Produttori" description="Estratto conto produttori" icon={Percent} />} />
              <Route path="/contabilita/stampa-primanota" element={<PlaceholderPage title="Stampa Primanota" description="Stampa movimenti di primanota" icon={Printer} />} />
              <Route path="/contabilita/check-primanota" element={<PlaceholderPage title="Check Primanota" description="Verifica e quadratura primanota" icon={ListChecks} />} />
              <Route path="/contabilita/stampa-sospesi" element={<PlaceholderPage title="Stampa Sospesi" description="Stampa movimenti sospesi" icon={FileOutput} />} />

              {/* CONT. GENERALE */}
              <Route path="/cont-generale/anagrafiche" element={<PlaceholderPage title="Anagrafiche" description="Anagrafiche contabilità generale" icon={Users} />} />
              <Route path="/cont-generale/primanota" element={<PlaceholderPage title="Primanota" description="Primanota contabilità generale" icon={FileText} />} />
              <Route path="/cont-generale/elab-periodiche" element={<PlaceholderPage title="Elaborazioni Periodiche" description="Elaborazioni periodiche contabili" icon={CalendarCheck} />} />
              <Route path="/cont-generale/fornitori" element={<PlaceholderPage title="Fornitori" description="Gestione fornitori" icon={Building2} />} />
              <Route path="/cont-generale/clienti" element={<PlaceholderPage title="Clienti" description="Gestione clienti contabilità" icon={Users} />} />
              <Route path="/cont-generale/elab-annuali" element={<PlaceholderPage title="Elaborazioni Annuali" description="Elaborazioni annuali e chiusure" icon={ClipboardList} />} />
              <Route path="/cont-generale/dichiarativi" element={<PlaceholderPage title="Dichiarativi" description="Gestione dichiarativi fiscali" icon={FileStack} />} />

              {/* FATTURAPA */}
              <Route path="/fatturapa/anagrafiche" element={<PlaceholderPage title="Anagrafiche FatturaPA" description="Anagrafiche per fatturazione elettronica" icon={Users} />} />
              <Route path="/fatturapa/gestione" element={<PlaceholderPage title="Gestione FatturaPA" description="Gestione fatture elettroniche" icon={Settings} />} />
              <Route path="/fatturapa/intermediazione" element={<PlaceholderPage title="Intermediazione" description="Gestione intermediazione fatture" icon={ArrowRightLeft} />} />
              <Route path="/fatturapa/import-fatture" element={<PlaceholderPage title="Import Fatture Acquisto" description="Importazione fatture di acquisto" icon={Import} />} />

              {/* EXTRA STANDALONE */}
              <Route path="/cfo" element={<AreaCFO />} />
              <Route path="/provvigioni" element={<PlaceholderPage title="Provvigioni" description="Gestione provvigioni agenti" icon={Percent} />} />
              <Route path="/rimessa-premi" element={<RimessaList />} />
              <Route path="/rimessa-premi/:id" element={<RimessaDetail />} />
              <Route path="/banca-import" element={<BancaImport />} />
              <Route path="/anomalie-ko" element={<AnomalieKO />} />
              <Route path="/note-restituzione" element={<NoteRestituzioneList />} />
              <Route path="/note-restituzione/:id" element={<NotaRestituzioneDetail />} />
              <Route path="/spedizioni" element={<SpedizioniList />} />
              <Route path="/notifiche" element={<NotifichePage />} />
              <Route path="/privacy" element={<PrivacyConsensi />} />
              <Route path="/report-iva" element={<ReportIVA />} />
              <Route path="/portafoglio" element={<PortafoglioList />} />
              <Route path="/portafoglio/:id" element={<PortafoglioDetail />} />
              <Route path="/flussi-compagnie" element={<FlussiCompagnieList />} />
              <Route path="/flussi-compagnie/:id" element={<FlussoCompagniaDetail />} />
              <Route path="/pagamenti-provvigioni" element={<PagamentiProvvigioniList />} />
              <Route path="/pagamenti-provvigioni/:id" element={<PagamentoProvvigioneDetail />} />
              <Route path="/report" element={<ReportPage />} />
              <Route path="/comunicazioni" element={<PlaceholderPage title="Comunicazioni" description="Centro comunicazioni e notifiche" icon={Mail} />} />

              {/* SISTEMA (admin) */}
              <Route path="/impostazioni" element={<RoleGuard allowedRoles={["admin", "ufficio"]}><ImpostazioniPage /></RoleGuard>} />
              <Route path="/matrice-provvigioni" element={<RoleGuard allowedRoles={["admin"]}><MatriceProvvigioni /></RoleGuard>} />
              <Route path="/template-ruoli" element={<RoleGuard allowedRoles={["admin"]}><GestioneTemplateRuoli /></RoleGuard>} />
              <Route path="/crea-utente" element={<RoleGuard allowedRoles={["admin"]}><CreaNuovoUtente /></RoleGuard>} />
              <Route path="/gestione-utenti" element={<RoleGuard allowedRoles={["admin"]}><GestioneUtenti /></RoleGuard>} />
              <Route path="/backup-export" element={<RoleGuard allowedRoles={["admin"]}><BackupExport /></RoleGuard>} />
              <Route path="/manutenzione" element={<RoleGuard allowedRoles={["admin"]}><ManutenzionePage /></RoleGuard>} />
              <Route path="/anomalie-sistema" element={<RoleGuard allowedRoles={["admin", "cfo", "ufficio"]}><AnomalieList /></RoleGuard>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
