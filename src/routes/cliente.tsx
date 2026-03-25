import { Route } from "react-router-dom";
import ClienteGuard from "@/components/ClienteGuard";
import ClienteLayout from "@/components/ClienteLayout";
import ClienteDashboard from "@/pages/cliente/ClienteDashboard";
import ClientePolizze from "@/pages/cliente/ClientePolizze";
import ClientePolizzaDetail from "@/pages/cliente/ClientePolizzaDetail";
import ClienteDocumenti from "@/pages/cliente/ClienteDocumenti";
import ClienteScadenze from "@/pages/cliente/ClienteScadenze";
import ClienteComunicazioni from "@/pages/cliente/ClienteComunicazioni";
import ClienteNotifiche from "@/pages/cliente/ClienteNotifiche";
import ClientePagamenti from "@/pages/cliente/ClientePagamenti";
import ClienteUploadDoc from "@/pages/cliente/ClienteUploadDoc";

export const clienteRoutes = (
  <Route element={<ClienteGuard><ClienteLayout /></ClienteGuard>}>
    <Route path="/cliente" element={<ClienteDashboard />} />
    <Route path="/cliente/polizze" element={<ClientePolizze />} />
    <Route path="/cliente/polizze/:id" element={<ClientePolizzaDetail />} />
    <Route path="/cliente/documenti" element={<ClienteDocumenti />} />
    <Route path="/cliente/scadenze" element={<ClienteScadenze />} />
    <Route path="/cliente/comunicazioni" element={<ClienteComunicazioni />} />
    <Route path="/cliente/notifiche" element={<ClienteNotifiche />} />
    <Route path="/cliente/pagamenti" element={<ClientePagamenti />} />
    <Route path="/cliente/upload" element={<ClienteUploadDoc />} />
  </Route>
);
