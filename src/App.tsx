import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import MainLayout from "./components/MainLayout";
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
            <Route element={<MainLayout />}>
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
              <Route path="/privacy" element={<PrivacyConsensi />} />
              <Route path="/impostazioni" element={<PlaceholderPage title="Impostazioni" description="Configurazione del sistema" icon={Settings} />} />
              <Route path="/compagnie" element={<CompagnieList />} />
              <Route path="/categorie" element={<CategorieList />} />
              <Route path="/prodotti" element={<ProdottiList />} />
              <Route path="/matrice-provvigioni" element={<MatriceProvvigioni />} />
              <Route path="/template-ruoli" element={<GestioneTemplateRuoli />} />
              <Route path="/crea-utente" element={<CreaNuovoUtente />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
