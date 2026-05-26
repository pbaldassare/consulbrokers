import { useEffect, useState } from "react";

interface Props {
  data: Uint8Array | null;
}

const PdfPreview = ({ data }: Props) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!data) {
      setUrl(null);
      return;
    }
    const blob = new Blob([data as BlobPart], { type: "application/pdf" });
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [data]);

  return (
    <div className="flex-1 bg-muted/40">
      {url ? (
        <iframe src={url} title="Anteprima PDF" className="w-full h-full border-0" />
      ) : (
        <p className="text-center text-sm text-muted-foreground p-4">Caricamento anteprima…</p>
      )}
    </div>
  );
};

export default PdfPreview;
