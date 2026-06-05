import { Route } from "react-router-dom";
import PlaceholderPage from "@/components/PlaceholderPage";
import SinistriList from "@/pages/SinistriList";
import SinistroDetail from "@/pages/SinistroDetail";
import SinistroAperturaWizardPage from "@/pages/SinistroAperturaWizardPage";
import SinistroPrescrizioniPage from "@/pages/SinistroPrescrizioniPage";
import SinistroScadenzePage from "@/pages/SinistroScadenzePage";
import SinistroReportSirPage from "@/pages/SinistroReportSirPage";
import { FilePlus, Clock, CalendarCheck, FileText } from "lucide-react";

export const sinistriRoutes = (
  <>
    <Route path="/sinistri" element={<SinistriList />} />
    <Route path="/sinistri/:id" element={<SinistroDetail />} />
    <Route path="/sinistri/apertura" element={<SinistroAperturaWizardPage />} />
    <Route path="/sinistri/prescrizioni" element={<SinistroPrescrizioniPage />} />
    <Route path="/sinistri/scadenze" element={<SinistroScadenzePage />} />
    <Route path="/sinistri/report-sir" element={<SinistroReportSirPage />} />
  </>
);
