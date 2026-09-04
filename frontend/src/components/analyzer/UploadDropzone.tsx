import { useRef, useState } from "react";
import { CloudUpload, FileImage, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface UploadDropzoneProps {
  onFiles: (files: File[]) => void;
  compact?: boolean;
}

export function UploadDropzone({ onFiles, compact }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onFiles(Array.from(event.dataTransfer.files));
      }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-dashed text-center transition-all duration-200",
        compact ? "p-5" : "p-7 sm:p-8",
        dragging
          ? "border-primary bg-primary/10 scale-[1.01] shadow-glow"
          : "border-border/80 bg-card/50 hover:border-primary/50 hover:bg-card/80",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />

      <div className="flex flex-col items-center">
        {/* Modern Icon Badge */}
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-xs">
          <FileText className="h-6 w-6" />
        </div>

        <h3 className="text-base font-semibold text-foreground sm:text-lg">
          Add your question papers
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF • DOCX • Images • Handwritten Notes
        </p>

        <div className="mt-4">
          <Button
            onClick={() => inputRef.current?.click()}
            className="gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-blue-600 to-cyan-500 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:shadow-lg hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <CloudUpload className="h-4 w-4" />
            Upload Papers
          </Button>
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground/80">
          or drag & drop your files here (up to 50MB)
        </p>
      </div>
    </div>
  );
}
