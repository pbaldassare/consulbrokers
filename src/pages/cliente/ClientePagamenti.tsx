import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard } from "lucide-react";

const ClientePagamenti = () => {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-primary" /> Pagamenti
      </h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pagamenti online</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Il sistema di pagamento online sarà disponibile a breve.
            Per il momento puoi verificare le tue scadenze nella sezione dedicata
            e contattare l'agenzia per le modalità di pagamento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientePagamenti;
