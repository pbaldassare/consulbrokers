import { Route } from "react-router-dom";
import PlaceholderPage from "@/components/PlaceholderPage";
import ContabilitaUfficio from "@/pages/ContabilitaUfficio";
import CruscottoGiornaliero from "@/pages/contabilita/CruscottoGiornaliero";


import ECClientiContabPage from "@/pages/contabilita/ECClientiContabPage";
import ECCompagniaContabPage from "@/pages/contabilita/ECCompagniaContabPage";
import ECAgenziaPdfPage from "@/pages/contabilita/ECAgenziaPdfPage";
import AgenzieInPagamentoPage from "@/pages/contabilita/AgenzieInPagamentoPage";
import ECClientePdfPage from "@/pages/contabilita/ECClientePdfPage";
import ECAgenzieStoricoPage from "@/pages/contabilita/ECAgenzieStoricoPage";
import ECClientiStoricoPage from "@/pages/contabilita/ECClientiStoricoPage";
import ECProduttoriContabPage from "@/pages/contabilita/ECProduttoriContabPage";
import ECProduttoriStoricoPage from "@/pages/contabilita/ECProduttoriStoricoPage";
import StoricoRimessePage from "@/pages/contabilita/StoricoRimessePage";

import RimessaList from "@/pages/RimessaList";
import RimessaDetail from "@/pages/RimessaDetail";
import ReportIVA from "@/pages/ReportIVA";
import { Printer, ListChecks, FileOutput } from "lucide-react";

export const contabilitaRoutes = (
  <>
    {/* CONTABILITÀ UFFICIO */}
    <Route path="/contabilita" element={<ContabilitaUfficio />} />
    <Route path="/contabilita/cruscotto" element={<CruscottoGiornaliero />} />
    
    <Route path="/contabilita/ec-clienti" element={<ECClientiContabPage />} />
    <Route path="/contabilita/ec-compagnia" element={<ECCompagniaContabPage />} />
    <Route path="/contabilita/ec-agenzia" element={<ECCompagniaContabPage />} />
    <Route path="/contabilita/ec-agenzia/pdf" element={<ECAgenziaPdfPage />} />
    <Route path="/contabilita/ec-cliente/pdf" element={<ECClientePdfPage />} />
    <Route path="/contabilita/ec-agenzia/storico" element={<ECAgenzieStoricoPage />} />
    <Route path="/contabilita/ec-cliente/storico" element={<ECClientiStoricoPage />} />
    <Route path="/contabilita/ec-produttori" element={<ECProduttoriContabPage />} />
    <Route path="/contabilita/ec-produttore/storico" element={<ECProduttoriStoricoPage />} />
    <Route path="/contabilita/storico-rimesse" element={<StoricoRimessePage />} />
    <Route path="/contabilita/stampa-sospesi" element={<PlaceholderPage title="Stampa Sospesi" description="Stampa movimenti sospesi" icon={FileOutput} />} />

    {/* RIMESSE & EXTRA CONTABILI */}
    <Route path="/rimessa-premi" element={<RimessaList />} />
    <Route path="/rimessa-premi/:id" element={<RimessaDetail />} />
    <Route path="/report-iva" element={<ReportIVA />} />
  </>
);
