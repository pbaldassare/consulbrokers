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
import NotFound from "./pages/NotFound";

import { archiviRoutes } from "./routes/archivi";
import { portafoglioRoutes } from "./routes/portafoglio";
import { sinistriRoutes } from "./routes/sinistri";
import { contabilitaRoutes } from "./routes/contabilita";
import { sistemaRoutes } from "./routes/sistema";
import { clienteRoutes } from "./routes/cliente";
import { prospectRoutes } from "./routes/prospect";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<AuthGuard><MainLayout /></AuthGuard>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/mio-profilo" element={<MioProfilo />} />
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
);

export default App;
