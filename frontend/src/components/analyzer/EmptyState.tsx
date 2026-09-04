import { Sparkles, FileText, Flame, BrainCircuit, BookOpen, ArrowRight, Zap, Calculator, HelpCircle } from "lucide-react";
import { UploadDropzone } from "./UploadDropzone";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onFiles: (files: File[]) => void;
  onSelectPrompt?: (prompt: string) => void;
}

export const FEATURE_CARDS = [
  {
    icon: "📄",
    title: "Analyze Papers",
    desc: "Find patterns across your question papers",
    prompt:
      "Analyze all my uploaded question papers and summarize the overall structure, common question formats, and topic distributions.",
    badge: "Structural Analysis",
    borderHover: "hover:border-indigo-500/40",
  },
  {
    icon: "🔥",
    title: "Find Repeated Questions",
    desc: "Discover questions asked across exam sessions",
    prompt:
      "Which topics and questions repeat most frequently across all uploaded papers? List the top recurring questions with years.",
    badge: "Exam Trends",
    borderHover: "hover:border-amber-500/40",
  },
  {
    icon: "🧠",
    title: "Generate Practice Questions",
    desc: "Test your preparation with exam-style questions",
    prompt:
      "Generate 5 high-yield exam practice questions with hints and marking schemes based on the uploaded materials.",
    badge: "Self-Test",
    borderHover: "hover:border-cyan-500/40",
  },
  {
    icon: "📝",
    title: "Create Revision Sheet",
    desc: "Summarize key formulas, definitions & cheat sheets",
    prompt:
      "Summarize all key formulas, definitions, and core concepts into a fast exam revision cheat sheet.",
    badge: "Quick Revision",
    borderHover: "hover:border-emerald-500/40",
  },
];

export const QUICK_ACTIONS = [
  {
    label: "Find repeated questions",
    icon: Flame,
    prompt: "Which topics and questions repeat most frequently across all uploaded papers?",
  },
  {
    label: "Analyze topics",
    icon: FileText,
    prompt: "Give me a breakdown of all chapters and topics covered in the uploaded papers with importance ratings.",
  },
  {
    label: "Generate practice questions",
    icon: BrainCircuit,
    prompt: "Generate 3 high-yield practice questions with detailed solutions.",
  },
  {
    label: "Create flashcards",
    icon: BookOpen,
    prompt: "Create 5 concise question-answer study flashcards for fast revision.",
  },
  {
    label: "Step-by-step solution",
    icon: Calculator,
    prompt: "Provide a detailed step-by-step mathematical derivation and code implementation for the hardest topic in my syllabus.",
  },
  {
    label: "Create revision sheet",
    icon: Zap,
    prompt: "Create a complete 1-page formula and concept cheat sheet for exam revision.",
  },
];

export function EmptyState({ onFiles, onSelectPrompt }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-8 text-center sm:py-12">
      {/* ── 1. Welcome Hero ── */}
      <div className="mb-6 flex flex-col items-center">
        <div className="relative mb-3.5 grid h-12 w-12 place-items-center rounded-2xl border border-primary/30 bg-primary/10 shadow-sm shadow-indigo-500/20">
          <span className="text-xl text-cyan-300 animate-pulse-subtle">✦</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
          Welcome to <span className="bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">PaperLens</span>
        </h1>
        <p className="mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Turn your question papers into a smarter revision plan.
        </p>
      </div>

      {/* ── 2. Interactive Feature Cards (2x2 Grid) ── */}
      <div className="mb-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 text-left">
        {FEATURE_CARDS.map((card) => (
          <button
            key={card.title}
            onClick={() => onSelectPrompt?.(card.prompt)}
            className={`group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card/60 p-4 transition-all hover:bg-card hover:shadow-md ${card.borderHover} cursor-pointer text-left`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl">{card.icon}</span>
                <span className="rounded-md border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {card.badge}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                {card.title}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {card.desc}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-primary/80 group-hover:text-primary transition-colors">
              <span>Try prompt</span>
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        ))}
      </div>

      {/* ── 3. Upload Dropzone Card ── */}
      <div className="w-full mb-6">
        <UploadDropzone onFiles={onFiles} />
      </div>

      {/* ── 4. Quick Action Chips ── */}
      <div className="w-full text-center">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Quick Starters
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => onSelectPrompt?.(action.prompt)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs text-foreground/90 transition-all hover:border-primary/40 hover:bg-card hover:text-primary cursor-pointer shadow-2xs"
              >
                <Icon className="h-3 w-3 text-primary/80" />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
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
      <FileText className="h-4 w-4" />
      Upload Question Papers
    </Button>
  );
}
