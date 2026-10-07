import { Route, Navigate, useLocation } from "react-router-dom";
import ProspectDetail from "@/pages/ProspectDetail";
import ClientiList from "@/pages/ClientiList";
import ClienteDetail from "@/pages/ClienteDetail";
import DeduplicaClientiPage from "@/pages/DeduplicaClientiPage";
import AnagraficheCompagniePage from "@/pages/AnagraficheCompagniePage";
import AnagraficheInternePage from "@/pages/AnagraficheInternePage";
import TrattativeList from "@/pages/TrattativeList";
import BandiPubbliciPage from "@/pages/BandiPubbliciPage";
import ContiBancariPage from "@/pages/anagrafiche/ContiBancariPage";


const ARCHIVI_ALIAS: Record<string, string> = {
  "/prospect": "/clienti",
  "/anagrafiche": "/anagrafiche-amministrative",
  "/anagrafiche-interne": "/anagrafiche-amministrative",
};

function ArchiviLegacyRedirect() {
  const { pathname, search, hash } = useLocation();
  const path = pathname.replace(/^\/archivi/, "") || "/";
  return <Navigate to={(ARCHIVI_ALIAS[path] ?? path) + search + hash} replace />;
}

export const archiviRoutes = (
  <>
    <Route path="/prospect/:id" element={<ProspectDetail />} />
    <Route path="/clienti" element={<ClientiList />} />
    <Route path="/clienti/deduplica" element={<DeduplicaClientiPage />} />
    <Route path="/clienti/:id" element={<ClienteDetail />} />
    <Route path="/anagrafiche-agenzie" element={<AnagraficheCompagniePage />} />
    <Route path="/anagrafiche-amministrative" element={<AnagraficheInternePage />} />
    <Route path="/conti-bancari" element={<ContiBancariPage />} />
    {/* Vecchi indirizzi /archivi/... (email, notifiche, preferiti): reindirizzati */}
    <Route path="/archivi/*" element={<ArchiviLegacyRedirect />} />
    <Route path="/trattative" element={<TrattativeList />} />
    <Route path="/trattative/calendario" element={<Navigate to="/trattative" replace />} />
    <Route path="/trattative/storico" element={<Navigate to="/trattative?view=archiviate" replace />} />
    <Route path="/bandi-pubblici/partecipati" element={<BandiPubbliciPage />} />
    <Route path="/bandi-pubblici" element={<BandiPubbliciPage />} />
  </>
);
