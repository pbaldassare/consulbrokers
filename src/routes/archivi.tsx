import { Route } from "react-router-dom";
import ProspectList from "@/pages/ProspectList";
import ProspectDetail from "@/pages/ProspectDetail";
import ClientiList from "@/pages/ClientiList";
import ClienteDetail from "@/pages/ClienteDetail";
import AnagraficheProfessionaliPage from "@/pages/AnagraficheProfessionaliPage";
import TrattativeList from "@/pages/TrattativeList";
import BandiPubbliciPage from "@/pages/BandiPubbliciPage";

export const archiviRoutes = (
  <>
    <Route path="/prospect" element={<ProspectList />} />
    <Route path="/prospect/:id" element={<ProspectDetail />} />
    <Route path="/archivi/clienti" element={<ClientiList />} />
    <Route path="/archivi/clienti/:id" element={<ClienteDetail />} />
    <Route path="/archivi/anagrafiche" element={<AnagraficheProfessionaliPage />} />
    <Route path="/trattative" element={<TrattativeList />} />
    <Route path="/bandi-pubblici" element={<BandiPubbliciPage />} />
  </>
);
