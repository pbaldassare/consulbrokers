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
              <Route path="/" element={<Dashboard />} />
              <Route path="/prospect" element={<ProspectList />} />
              <Route path="/prospect/:id" element={<ProspectDetail />} />
              <Route path="/trattative" element={<TrattativeList />} />
              <Route path="/titoli" element={<TitoliList />} />
              <Route path="/titoli/:id" element={<TitoloDetail />} />
              <Route path="/sinistri" element={<SinistriList />} />
              <Route path="/sinistri/:id" element={<SinistroDetail />} />
              <Route path="/contabilita" element={<ContabilitaUfficio />} />
              <Route path="/cfo" element={<AreaCFO />} />
              <Route path="/provvigioni" element={<PlaceholderPage title="Provvigioni" description="Gestione provvigioni agenti" icon={Percent} />} />
              <Route path="/rimessa-premi" element={<RimessaList />} />
              <Route path="/rimessa-premi/:id" element={<RimessaDetail />} />
              <Route path="/comunicazioni" element={<PlaceholderPage title="Comunicazioni" description="Centro comunicazioni e notifiche" icon={Mail} />} />
              <Route path="/banca-import" element={<BancaImport />} />
              <Route path="/anomalie-ko" element={<AnomalieKO />} />
              <Route path="/note-restituzione" element={<NoteRestituzioneList />} />
              <Route path="/note-restituzione/:id" element={<NotaRestituzioneDetail />} />
              <Route path="/spedizioni" element={<SpedizioniList />} />
              <Route path="/notifiche" element={<NotifichePage />} />
              <Route path="/privacy" element={<PrivacyConsensi />} />
              <Route path="/impostazioni" element={<RoleGuard allowedRoles={["admin", "ufficio"]}><ImpostazioniPage /></RoleGuard>} />
              <Route path="/compagnie" element={<RoleGuard allowedRoles={["admin"]}><CompagnieList /></RoleGuard>} />
              <Route path="/categorie" element={<RoleGuard allowedRoles={["admin"]}><CategorieList /></RoleGuard>} />
              <Route path="/prodotti" element={<RoleGuard allowedRoles={["admin"]}><ProdottiList /></RoleGuard>} />
              <Route path="/matrice-provvigioni" element={<RoleGuard allowedRoles={["admin"]}><MatriceProvvigioni /></RoleGuard>} />
              <Route path="/template-ruoli" element={<RoleGuard allowedRoles={["admin"]}><GestioneTemplateRuoli /></RoleGuard>} />
              <Route path="/report-iva" element={<ReportIVA />} />
              <Route path="/portafoglio" element={<PortafoglioList />} />
              <Route path="/portafoglio/:id" element={<PortafoglioDetail />} />
              <Route path="/flussi-compagnie" element={<FlussiCompagnieList />} />
              <Route path="/flussi-compagnie/:id" element={<FlussoCompagniaDetail />} />
              <Route path="/pagamenti-provvigioni" element={<PagamentiProvvigioniList />} />
              <Route path="/pagamenti-provvigioni/:id" element={<PagamentoProvvigioneDetail />} />
              <Route path="/report" element={<ReportPage />} />
              <Route path="/crea-utente" element={<RoleGuard allowedRoles={["admin"]}><CreaNuovoUtente /></RoleGuard>} />
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
