import { FileSearch, Sparkles, Upload, FileText, BookOpen, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "./UploadDropzone";

export function EmptyState({ onFiles }: { onFiles: (files: File[]) => void }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-8 text-center">
      <div className="relative">
        <span className="absolute inset-0 -z-10 rounded-full blur-3xl bg-indigo-500/25 animate-pulse-subtle" />
        <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-400 p-0.5 shadow-xl shadow-indigo-500/25">
          <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-slate-950/90 backdrop-blur-xl">
            <FileSearch className="h-9 w-9 text-cyan-300" />
          </div>
        </div>
      </div>

      <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Upload question papers or study notes
      </h2>
      <p className="mt-2 max-w-md text-xs sm:text-sm leading-relaxed text-muted-foreground">
        Every answer stays strictly grounded in your materials — with confidence scores, source
        citations, and exact page references.
      </p>

      <div className="mt-6 w-full">
        <UploadDropzone onFiles={onFiles} />
      </div>

      <div className="mt-5 grid w-full gap-2.5 sm:grid-cols-3">
        {[
          {
            label: "Past Exam Papers",
            desc: "PDF & DOCX",
            icon: FileText,
            color: "text-indigo-400",
          },
          {
            label: "Textbooks & Notes",
            desc: "Multi-chapter study material",
            icon: BookOpen,
            color: "text-cyan-400",
          },
          {
            label: "Handwritten Sheets",
            desc: "Instant Tesseract OCR",
            icon: Camera,
            color: "text-emerald-400",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2.5 rounded-2xl border border-border/40 bg-surface/60 p-3 text-left backdrop-blur-md transition-all hover:border-primary/40 hover:bg-surface-elevated/80"
          >
            <item.icon className={`h-4 w-4 shrink-0 ${item.color}`} />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground/90">{item.label}</p>
              <p className="truncate text-[10px] text-muted-foreground/70">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyStateCompact({ onUpload }: { onUpload: () => void }) {
  return (
    <Button
      onClick={onUpload}
      className="gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-blue-600 to-cyan-500 text-white font-medium shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
    >
      <Upload className="h-4 w-4" />
      Upload Question Papers
    </Button>
  );
}
