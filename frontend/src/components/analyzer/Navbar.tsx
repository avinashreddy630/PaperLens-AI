import { BarChart3, Menu, Moon, Sun, Sparkles, Search, Zap, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/80 bg-background/90 px-3.5 py-2 backdrop-blur-md sm:px-5">
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
            PaperLens AI
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <Zap className="h-2.5 w-2.5 fill-primary text-primary" />
            Hybrid RAG
          </span>
          <p className="hidden truncate text-[11px] text-muted-foreground lg:block pl-1">
            · Question Paper Analyzer
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Export Study Guide button */}
        {hasMessages && onExportGuide && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportGuide}
            title="Download formatted Exam Revision Notes (.md)"
            className="h-7.5 gap-1.5 rounded-lg border-border bg-card/80 px-2.5 text-xs font-normal text-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Export Revision Sheet</span>
          </Button>
        )}

        {/* Quick Search Pad Trigger */}
        <button
          onClick={onOpenSearchPad}
          title="Search Papers & Citations (Ctrl+K)"
          className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border/80 hover:text-foreground cursor-pointer"
        >
          <Search className="h-3 w-3 text-muted-foreground" />
          <span>Search docs</span>
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ⌘K
          </kbd>
        </button>

        {/* Source count pill */}
        <button
          onClick={onOpenSearchPad}
          title="View loaded sources"
          className="inline-flex"
        >
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-normal text-foreground hover:bg-muted transition-colors cursor-pointer">
            <Sparkles className="h-3 w-3 text-primary" />
            <span>{docCount}</span>
            <span className="hidden sm:inline">source{docCount === 1 ? "" : "s"}</span>
          </span>
        </button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          aria-label="Toggle color theme"
          className="h-7.5 w-7.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </Button>

        {/* Analytics Drawer Toggle */}
        <Button
          variant={panelOpen ? "secondary" : "ghost"}
          size="icon"
          onClick={onTogglePanel}
          aria-label="Toggle analytics panel"
          className="h-7.5 w-7.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <BarChart3 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}
