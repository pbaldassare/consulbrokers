import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import AuthGuard from "./components/AuthGuard";
import MainLayout from "./components/MainLayout";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Dashboard from "./pages/Dashboard";
import MioProfilo from "./pages/MioProfilo";
import AiAssistantPage from "./pages/AiAssistantPage";
import NotFound from "./pages/NotFound";

import AppVersionGuard from "./components/AppVersionGuard";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { archiviRoutes } from "./routes/archivi";
import { portafoglioRoutes } from "./routes/portafoglio";
import { sinistriRoutes } from "./routes/sinistri";
import { contabilitaRoutes } from "./routes/contabilita";
import { sistemaRoutes } from "./routes/sistema";
import { clienteRoutes } from "./routes/cliente";
import { prospectRoutes } from "./routes/prospect";

const queryClient = new QueryClient();

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <AppVersionGuard />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route element={<AuthGuard><MainLayout /></AuthGuard>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/mio-profilo" element={<MioProfilo />} />
                <Route path="/ai-assistant" element={<AiAssistantPage />} />
                {archiviRoutes}
                {portafoglioRoutes}
                {sinistriRoutes}
                {contabilitaRoutes}
                {sistemaRoutes}
              </Route>
              {clienteRoutes}
              {prospectRoutes}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
