import { Route } from "react-router-dom";
import RoleGuard from "@/components/RoleGuard";
import ProspectList from "@/pages/ProspectList";
import ProspectDetail from "@/pages/ProspectDetail";
import ClientiList from "@/pages/ClientiList";
import ClienteDetail from "@/pages/ClienteDetail";
import AnagraficheProfessionaliPage from "@/pages/AnagraficheProfessionaliPage";
import CompagnieList from "@/pages/CompagnieList";
import CategorieList from "@/pages/CategorieList";
import ProdottiList from "@/pages/ProdottiList";
import TrattativeList from "@/pages/TrattativeList";

export const archiviRoutes = (
  <>
    <Route path="/prospect" element={<ProspectList />} />
    <Route path="/prospect/:id" element={<ProspectDetail />} />
    <Route path="/archivi/clienti" element={<ClientiList />} />
    <Route path="/archivi/clienti/:id" element={<ClienteDetail />} />
    <Route path="/archivi/anagrafiche" element={<AnagraficheProfessionaliPage />} />
    <Route path="/compagnie" element={<RoleGuard allowedRoles={["admin"]}><CompagnieList /></RoleGuard>} />
    <Route path="/categorie" element={<RoleGuard allowedRoles={["admin"]}><CategorieList /></RoleGuard>} />
    <Route path="/prodotti" element={<RoleGuard allowedRoles={["admin"]}><ProdottiList /></RoleGuard>} />
    <Route path="/trattative" element={<TrattativeList />} />
  </>
);
