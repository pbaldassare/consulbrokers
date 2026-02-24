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
              <Route path="/prospect" element={<PlaceholderPage title="Prospect & Trattative" description="Gestione prospect e trattative commerciali" icon={Users} />} />
              <Route path="/titoli" element={<PlaceholderPage title="Titoli" description="Gestione dei titoli assicurativi" icon={FileText} />} />
              <Route path="/sinistri" element={<PlaceholderPage title="Sinistri" description="Gestione pratiche sinistri" icon={AlertTriangle} />} />
              <Route path="/contabilita" element={<PlaceholderPage title="Contabilità Ufficio" description="Gestione contabile dell'ufficio" icon={Calculator} />} />
              <Route path="/cfo" element={<PlaceholderPage title="Area CFO" description="Dashboard direzionale e reportistica" icon={BarChart3} />} />
              <Route path="/provvigioni" element={<PlaceholderPage title="Provvigioni" description="Gestione provvigioni agenti" icon={Percent} />} />
              <Route path="/rimessa-premi" element={<PlaceholderPage title="Rimessa Premi" description="Gestione rimessa premi alle compagnie" icon={Send} />} />
              <Route path="/comunicazioni" element={<PlaceholderPage title="Comunicazioni" description="Centro comunicazioni e notifiche" icon={Mail} />} />
              <Route path="/privacy" element={<PlaceholderPage title="Privacy & Consensi" description="Gestione privacy e consensi clienti" icon={Shield} />} />
              <Route path="/impostazioni" element={<PlaceholderPage title="Impostazioni" description="Configurazione del sistema" icon={Settings} />} />
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
