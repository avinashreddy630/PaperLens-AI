import { BarChart3, Menu, Moon, Sun, Sparkles, Search, Zap, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NavbarProps {
  onToggleSidebar: () => void;
  onTogglePanel: () => void;
  panelOpen: boolean;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  docCount: number;
  onOpenSearchPad?: () => void;
  onExportGuide?: () => void;
  hasMessages?: boolean;
}

export function Navbar({
  onToggleSidebar,
  onTogglePanel,
  panelOpen,
  theme,
  onToggleTheme,
  docCount,
  onOpenSearchPad,
  onExportGuide,
  hasMessages = false,
}: NavbarProps) {
  return (
    <header className="flex h-13 items-center justify-between border-b border-border/70 bg-background/80 px-3.5 backdrop-blur-xl sm:px-5">
      {/* Left: Brand info & sidebar toggle */}
      <div className="flex min-w-0 items-center gap-2.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Menu className="h-4 w-4" />
        </Button>

        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold tracking-tight text-foreground">
            PaperLens <span className="text-primary font-bold">AI</span>
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary shadow-xs">
            <Zap className="h-2.5 w-2.5 fill-primary text-primary" />
            Hybrid RAG
          </span>
          <span className="hidden truncate text-[11px] text-muted-foreground lg:block">
            • Question Paper Analyzer
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Export Revision Sheet */}
        {hasMessages && onExportGuide && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportGuide}
            title="Download formatted Exam Revision Notes (.md)"
            className="h-7.5 gap-1.5 rounded-lg border-border/80 bg-card/80 px-2.5 text-xs font-normal text-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Export Revision Sheet</span>
          </Button>
        )}

        {/* Quick Search Pad Trigger */}
        <button
          onClick={onOpenSearchPad}
          title="Search Papers & Citations (Ctrl+K)"
          className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-all hover:border-border hover:bg-muted/70 hover:text-foreground cursor-pointer"
        >
          <Search className="h-3 w-3 text-muted-foreground" />
          <span>Search docs</span>
          <kbd className="rounded bg-muted/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border/50">
            ⌘K
          </kbd>
        </button>

        {/* Source count pill */}
        <button
          onClick={onOpenSearchPad}
          title="View loaded sources in Search Pad"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-normal text-foreground hover:border-border hover:bg-muted/70 transition-all cursor-pointer"
        >
          <Sparkles className="h-3 w-3 text-primary" />
          <span>{docCount}</span>
          <span className="hidden sm:inline">source{docCount === 1 ? "" : "s"}</span>
        </button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          aria-label="Toggle color theme"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </Button>

        {/* Analytics Drawer Toggle */}
        <Button
          variant={panelOpen ? "secondary" : "ghost"}
          size="icon"
          onClick={onTogglePanel}
          aria-label="Toggle analytics panel"
          className={cn(
            "h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
            panelOpen && "bg-primary/10 text-primary hover:bg-primary/15",
          )}
          title="Toggle Document Analytics & Exam Trends"
        >
          <BarChart3 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}
