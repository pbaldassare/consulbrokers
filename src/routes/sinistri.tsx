import { Route } from "react-router-dom";
import PlaceholderPage from "@/components/PlaceholderPage";
import SinistriList from "@/pages/SinistriList";
import SinistroDetail from "@/pages/SinistroDetail";
import { FilePlus, Clock, CalendarCheck, FileText } from "lucide-react";

export const sinistriRoutes = (
  <>
    <Route path="/sinistri" element={<SinistriList />} />
    <Route path="/sinistri/:id" element={<SinistroDetail />} />
    <Route path="/sinistri/apertura" element={<PlaceholderPage title="Apertura Sinistro" description="Apertura nuovo sinistro" icon={FilePlus} />} />
    <Route path="/sinistri/prescrizioni" element={<PlaceholderPage title="Prescrizioni" description="Gestione prescrizioni sinistri" icon={Clock} />} />
    <Route path="/sinistri/scadenze" element={<PlaceholderPage title="Scadenze Sinistri" description="Scadenziario sinistri" icon={CalendarCheck} />} />
    <Route path="/sinistri/report-sir" element={<PlaceholderPage title="Report Sanitario SIR" description="Report sanitario sinistri" icon={FileText} />} />
  </>
);
