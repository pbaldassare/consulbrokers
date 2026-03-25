import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

const ClienteComunicazioni = () => {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" /> Comunicazioni
      </h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chat con l'agenzia</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Il servizio di messaggistica diretta con la tua agenzia sarà disponibile a breve.
            Per comunicazioni urgenti, contatta direttamente il tuo referente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClienteComunicazioni;
