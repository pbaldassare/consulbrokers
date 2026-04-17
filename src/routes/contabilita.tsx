import { Route } from "react-router-dom";
import PlaceholderPage from "@/components/PlaceholderPage";
import ContabilitaUfficio from "@/pages/ContabilitaUfficio";
import CruscottoGiornaliero from "@/pages/contabilita/CruscottoGiornaliero";
import DistintaGiornaliera from "@/pages/contabilita/DistintaGiornaliera";
import QuadraturePremi from "@/pages/contabilita/QuadraturePremi";

import ECClientiContabPage from "@/pages/contabilita/ECClientiContabPage";
import ECCompagniaContabPage from "@/pages/contabilita/ECCompagniaContabPage";
import ECProduttoriContabPage from "@/pages/contabilita/ECProduttoriContabPage";
import StoricoRimessePage from "@/pages/contabilita/StoricoRimessePage";

import PrimanotaGeneralePage from "@/pages/contGenerale/PrimanotaGeneralePage";
import ScadenziarioPage from "@/pages/contGenerale/ScadenziarioPage";
import ElabPeriodichePage from "@/pages/contGenerale/ElabPeriodichePage";
import ClientiContabGeneralePage from "@/pages/contGenerale/ClientiContabPage";
import DichiarativiCUPage from "@/pages/contGenerale/DichiarativiCUPage";
import ElabAnnualiPage from "@/pages/contGenerale/ElabAnnualiPage";
import FornitoriPage from "@/pages/FornitoriPage";
import BancaImport from "@/pages/BancaImport";
import RimessaList from "@/pages/RimessaList";
import RimessaDetail from "@/pages/RimessaDetail";
import ReportIVA from "@/pages/ReportIVA";
import PianoDeiContiPage from "@/pages/contGenerale/PianoDeiContiPage";
import { Bell, Printer, ListChecks, FileOutput, Users, Settings, ArrowRightLeft, Import } from "lucide-react";

export const contabilitaRoutes = (
  <>
    {/* CONTABILITÀ UFFICIO */}
    <Route path="/contabilita" element={<ContabilitaUfficio />} />
    <Route path="/contabilita/cruscotto" element={<CruscottoGiornaliero />} />
    <Route path="/contabilita/distinta-giornaliera" element={<DistintaGiornaliera />} />
    {/* <Route path="/contabilita/quadratura-premi" element={<QuadraturePremi />} /> */}
    <Route path="/contabilita/ec-clienti" element={<ECClientiContabPage />} />
    <Route path="/contabilita/ec-compagnia" element={<ECCompagniaContabPage />} />
    <Route path="/contabilita/ec-produttori" element={<ECProduttoriContabPage />} />
    <Route path="/contabilita/storico-rimesse" element={<StoricoRimessePage />} />
    <Route path="/contabilita/stampa-primanota" element={<PlaceholderPage title="Stampa Primanota" description="Stampa movimenti di primanota" icon={Printer} />} />
    <Route path="/contabilita/check-primanota" element={<PlaceholderPage title="Check Primanota" description="Verifica e quadratura primanota" icon={ListChecks} />} />
    <Route path="/contabilita/stampa-sospesi" element={<PlaceholderPage title="Stampa Sospesi" description="Stampa movimenti sospesi" icon={FileOutput} />} />

    {/* CONT. GENERALE — nascosto, pagine mantenute nel repo */}

    {/* FATTURAPA — nascosto, pagine mantenute nel repo */}

    {/* RIMESSE & EXTRA CONTABILI */}
    <Route path="/rimessa-premi" element={<RimessaList />} />
    <Route path="/rimessa-premi/:id" element={<RimessaDetail />} />
    <Route path="/report-iva" element={<ReportIVA />} />
  </>
);
