import { FileImage, FileText, FileType2, Trash2, Clock, Layers, Sparkles, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime, type UploadedDoc } from "@/lib/analyzer";

const iconFor = {
  pdf: FileText,
  docx: FileType2,
  txt: FileType2,
  image: FileImage,
};

export function UploadCard({
  doc,
  onDelete,
  onAnalyze,
  onAsk,
}: {
  doc: UploadedDoc;
  onDelete: () => void;
  onAnalyze?: (docName: string) => void;
  onAsk?: (docName: string) => void;
}) {
  const Icon = iconFor[doc.kind];

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-border/70 bg-card/70 p-3.5 transition-all duration-200 hover:border-primary/40 hover:bg-card hover:shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground" title={doc.name}>
            {doc.name}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground uppercase">
              {doc.kind}
            </span>
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {doc.pages} {doc.pages === 1 ? "page" : "pages"}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
              <Clock className="h-2.5 w-2.5" />
              {formatTime(doc.uploadedAt)}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          aria-label={`Delete ${doc.name}`}
          className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Action Buttons */}
      <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-border/50">
        <button
          onClick={() =>
            onAnalyze
              ? onAnalyze(doc.name)
              : onAsk?.(`Analyze the key questions and topic coverage in ${doc.name}`)
          }
          className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-all cursor-pointer"
        >
          <Sparkles className="h-2.5 w-2.5 text-primary" />
          <span>Analyze</span>
        </button>

        <button
          onClick={() => onAsk?.(`What are the main questions and formulas discussed in ${doc.name}?`)}
          className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-all cursor-pointer"
        >
          <BrainCircuit className="h-2.5 w-2.5 text-primary" />
          <span>Ask AI</span>
        </button>
      </div>
    </div>
  );
}

export function ImagePreviewCard({
  doc,
  onDelete,
  onAsk,
}: {
  doc: UploadedDoc;
  onDelete: () => void;
  onAsk?: (docName: string) => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 transition-all duration-200 hover:border-primary/40 hover:bg-card">
      <div className="relative grid h-28 place-items-center bg-muted/40 overflow-hidden">
        {doc.previewUrl ? (
          <img
            src={doc.previewUrl}
            alt={doc.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <FileImage className="h-8 w-8 text-muted-foreground" />
        )}

        <Button
          variant="secondary"
          size="icon"
          onClick={onDelete}
          aria-label={`Delete ${doc.name}`}
          className="absolute top-2 right-2 h-6.5 w-6.5 rounded-lg bg-background/80 backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive cursor-pointer"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="p-2.5">
        <p className="truncate text-xs font-semibold text-foreground">{doc.name}</p>
        <p className="truncate text-[10px] text-muted-foreground mt-0.5">
          OCR Scanned · {formatTime(doc.uploadedAt)}
        </p>

        <div className="mt-2 flex items-center gap-1 pt-1.5 border-t border-border/50">
          <button
            onClick={() => onAsk?.(`Extract and solve all exam questions in the image ${doc.name}`)}
            className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-border/70 bg-muted/40 py-1 text-[11px] font-medium text-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-all cursor-pointer"
          >
            <BrainCircuit className="h-2.5 w-2.5 text-primary" />
            <span>Ask AI</span>
          </button>
        </div>
      </div>
    </div>
  );
}
