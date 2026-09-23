import { Route } from "react-router-dom";
import RcaClientelaPage from "@/pages/rca/RcaClientelaPage";

export const rcaRoutes = (
  <>
    <Route path="/rca" element={<RcaClientelaPage />} />
    <Route path="/rca/clientela" element={<RcaClientelaPage />} />
  </>
);
