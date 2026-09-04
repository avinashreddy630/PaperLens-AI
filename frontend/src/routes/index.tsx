import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyzerSidebar, type SidebarChat } from "@/components/analyzer/AnalyzerSidebar";
import { UserSettingsModal } from "@/components/analyzer/UserSettingsModal";
import { SearchPadModal } from "@/components/analyzer/SearchPadModal";
import { Navbar } from "@/components/analyzer/Navbar";
import { ChatMessage, TypingIndicator } from "@/components/analyzer/ChatMessage";
import { ChatComposer } from "@/components/analyzer/ChatComposer";
import { AnalyzerPanel } from "@/components/analyzer/AnalyzerPanel";
import { UploadCard, ImagePreviewCard } from "@/components/analyzer/UploadCard";
import { UploadDropzone } from "@/components/analyzer/UploadDropzone";
import {
  kindFromName,
  sampleAnswer,
  sampleCitations,
  typeLabel,
  type ChatMessageData,
  type UploadedDoc,
} from "@/lib/analyzer";
import { useAuth } from "@/lib/auth";
import { chatApi, documentsApi, sessionsApi, type SessionResponse } from "@/lib/api";
import { BrainCircuit, FileText, Sparkles, Search, Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Question Paper Analyzer | PaperLens AI" },
      {
        name: "description",
        content:
          "Upload previous question papers, notes and textbooks, then ask questions and get AI answers grounded only in your documents.",
      },
      { property: "og:title", content: "AI Question Paper Analyzer | PaperLens AI" },
      {
        property: "og:description",
        content:
          "A premium AI workspace for analyzing question papers, notes and textbooks with cited, document-grounded answers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyzerPage,
});

// Structured prompt cards shown on the empty state
const SUGGESTED_PROMPTS = [
  {
    category: "Exam Analysis",
    title: "Find Repeating Questions",
    prompt: "Which topics and questions repeat most frequently across all uploaded papers?",
    icon: "🎯",
    badgeColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  },
  {
    category: "High-Yield Topics",
    title: "Most Important Questions",
    prompt: "What are the most critical and high-weightage questions to prepare for the exam?",
    icon: "⭐",
    badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    category: "Step-by-Step Solver",
    title: "Explain Algorithm / Formula",
    prompt:
      "Explain binary search and provide an optimized C++/Python implementation with step-by-step trace.",
    icon: "⚡",
    badgeColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
  {
    category: "Quick Revision",
    title: "Generate Study Cheat Sheet",
    prompt:
      "Summarize all key formulas, definitions, and core concepts into a fast revision guide.",
    icon: "📑",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
];

function getStoredSessions(): SessionResponse[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("paperlens_sessions_v2");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out any legacy demo mock sessions
        return parsed.filter(
          (s: SessionResponse) =>
            s.user_id !== "demo" &&
            !["c1", "c2", "c3", "c4"].includes(s.id),
        );
      }
    }
  } catch {
    // Ignore parse error
  }
  return [];
}

function persistSessions(list: SessionResponse[]) {
  try {
    localStorage.setItem("paperlens_sessions_v2", JSON.stringify(list));
  } catch {
    // Ignore storage quota error
  }
}

function AnalyzerPage() {
  const { user, isGuest, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [sessions, setSessions] = useState<SessionResponse[]>(getStoredSessions);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchPadOpen, setSearchPadOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track blob URLs for cleanup to prevent memory leaks
  const blobUrlsRef = useRef<Set<string>>(new Set());

  // Redirect to login if not authenticated and not guest (after auth loads)
  useEffect(() => {
    if (!authLoading && !isAuthenticated && !isGuest) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, isGuest, navigate]);

  // Load real documents from backend on mount (authenticated users only)
  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadDocs() {
      setDocsLoading(true);
      try {
        const result = await documentsApi.list();
        const serverDocs: UploadedDoc[] = result.data.map((doc) => ({
          id: doc.id,
          name: doc.name,
          kind: kindFromName(doc.name),
          typeLabel: typeLabel(kindFromName(doc.name)),
          uploadedAt: new Date(doc.uploaded_at),
          pages: doc.pages,
          previewUrl: undefined,
        }));
        setDocs(serverDocs);
      } catch (err) {
        console.warn("Could not load documents:", err);
      } finally {
        setDocsLoading(false);
      }
    }

    loadDocs();
  }, [isAuthenticated]);

  // Fetch real chat sessions from backend
  const loadSessions = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await sessionsApi.list();
      if (res.data) {
        setSessions(res.data);
        persistSessions(res.data);
      }
    } catch (err) {
      console.warn("Could not load chat sessions:", err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [messages, loading]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    const currentBlobUrls = blobUrlsRef.current;
    return () => {
      currentBlobUrls.forEach((url) => URL.revokeObjectURL(url));
      currentBlobUrls.clear();
    };
  }, []);

  const imageDocs = useMemo(() => docs.filter((doc) => doc.kind === "image"), [docs]);
  const fileDocs = useMemo(() => docs.filter((doc) => doc.kind !== "image"), [docs]);

  // Convert SessionResponse to SidebarChat (preserving all attributes)
  const sidebarChats = useMemo<SidebarChat[]>(() => {
    return sessions.map((s) => ({
      id: s.id,
      title: s.title || "New Chat",
      subtitle: `${s.message_count || 0} message${s.message_count === 1 ? "" : "s"}`,
      pinned: Boolean(s.pinned),
      favorite: Boolean(s.favorite),
      archived: Boolean(s.archived),
      folder: s.folder ?? null,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));
  }, [sessions]);

  // Handle renaming a chat session
  const handleRenameChat = useCallback(
    async (sessionId: string, newTitle: string) => {
      if (!newTitle.trim()) return;
      const cleanTitle = newTitle.trim();
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId
            ? { ...s, title: cleanTitle, updated_at: new Date().toISOString() }
            : s,
        );
        persistSessions(updated);
        return updated;
      });
      if (isAuthenticated) {
        try {
          await sessionsApi.update(sessionId, { title: cleanTitle });
          toast.success("Chat renamed");
        } catch (err) {
          toast.error("Failed to rename chat on server");
          loadSessions();
        }
      } else {
        toast.success("Chat renamed");
      }
    },
    [isAuthenticated, loadSessions],
  );

  // Handle pinning / unpinning a chat session
  const handleTogglePinChat = useCallback(
    async (sessionId: string, pinned: boolean) => {
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId ? { ...s, pinned, updated_at: new Date().toISOString() } : s,
        );
        persistSessions(updated);
        return updated;
      });
      if (isAuthenticated) {
        try {
          await sessionsApi.update(sessionId, { pinned });
          toast.success(pinned ? "Chat pinned to top" : "Chat unpinned");
        } catch (err) {
          toast.error("Failed to update pin status");
          loadSessions();
        }
      } else {
        toast.success(pinned ? "Chat pinned to top" : "Chat unpinned");
      }
    },
    [isAuthenticated, loadSessions],
  );

  // Handle favorite / unfavorite a chat session
  const handleToggleFavoriteChat = useCallback(
    async (sessionId: string, favorite: boolean) => {
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId ? { ...s, favorite, updated_at: new Date().toISOString() } : s,
        );
        persistSessions(updated);
        return updated;
      });
      if (isAuthenticated) {
        try {
          await sessionsApi.update(sessionId, { favorite });
          toast.success(favorite ? "Added to Favorites" : "Removed from Favorites");
        } catch (err) {
          toast.error("Failed to update favorite status");
          loadSessions();
        }
      } else {
        toast.success(favorite ? "Added to Favorites" : "Removed from Favorites");
      }
    },
    [isAuthenticated, loadSessions],
  );

  // Handle archiving / unarchiving a chat session
  const handleToggleArchiveChat = useCallback(
    async (sessionId: string, archived: boolean) => {
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId ? { ...s, archived, updated_at: new Date().toISOString() } : s,
        );
        persistSessions(updated);
        return updated;
      });
      if (activeChat === sessionId && archived) {
        setMessages([]);
        setActiveChat(null);
      }
      if (isAuthenticated) {
        try {
          await sessionsApi.update(sessionId, { archived });
          toast.success(archived ? "Chat archived" : "Chat unarchived");
        } catch (err) {
          toast.error("Failed to update archive status");
          loadSessions();
        }
      } else {
        toast.success(archived ? "Chat archived" : "Chat unarchived");
      }
    },
    [activeChat, isAuthenticated, loadSessions],
  );

  // Handle assigning / removing a folder
  const handleAssignFolder = useCallback(
    async (sessionId: string, folder: string | null) => {
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId ? { ...s, folder, updated_at: new Date().toISOString() } : s,
        );
        persistSessions(updated);
        return updated;
      });
      if (isAuthenticated) {
        try {
          await sessionsApi.update(sessionId, { folder });
          toast.success(folder ? `Assigned to ${folder}` : "Removed from folder");
        } catch (err) {
          toast.error("Failed to update folder");
          loadSessions();
        }
      } else {
        toast.success(folder ? `Assigned to ${folder}` : "Removed from folder");
      }
    },
    [isAuthenticated, loadSessions],
  );

  // Handle deleting a chat session
  const handleDeleteChat = useCallback(
    async (sessionId: string) => {
      setSessions((prev) => {
        const updated = prev.filter((s) => s.id !== sessionId);
        persistSessions(updated);
        return updated;
      });
      if (activeChat === sessionId) {
        setMessages([]);
        setActiveChat(null);
      }
      if (isAuthenticated) {
        try {
          await sessionsApi.delete(sessionId);
          toast.success("Chat deleted");
        } catch (err) {
          toast.error("Failed to delete chat");
          loadSessions();
        }
      } else {
        toast.success("Chat deleted");
      }
    },
    [activeChat, isAuthenticated, loadSessions],
  );

  // Handle selecting a chat session in the sidebar or settings modal
  async function handleSelectChat(sessionId: string) {
    setActiveChat(sessionId);
    if (isAuthenticated) {
      try {
        const historyRes = await chatApi.history(sessionId);
        const historyMsgs: ChatMessageData[] = historyRes.data.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: new Date(m.created_at),
          confidence: m.confidence,
          // Preserve full citation including id and relevance
          citations: m.citations,
        }));
        setMessages(historyMsgs);
      } catch (err) {
        toast.error("Failed to load chat history");
      }
    }
  }

  const removeDoc = useCallback(
    async (docId: string) => {
      let previousDocs: UploadedDoc[] = [];
      let removedDoc: UploadedDoc | undefined;

      setDocs((current) => {
        previousDocs = current;
        removedDoc = current.find((d) => d.id === docId);
        return current.filter((d) => d.id !== docId);
      });

      if (isAuthenticated) {
        try {
          await documentsApi.delete(docId);
          if (removedDoc?.previewUrl && blobUrlsRef.current.has(removedDoc.previewUrl)) {
            URL.revokeObjectURL(removedDoc.previewUrl);
            blobUrlsRef.current.delete(removedDoc.previewUrl);
          }
          toast.success("Document removed from workspace");
        } catch (err: unknown) {
          // Revert optimistic removal on server failure
          setDocs(previousDocs);
          toast.error(err instanceof Error ? err.message : "Failed to delete document from server");
        }
      } else {
        if (removedDoc?.previewUrl && blobUrlsRef.current.has(removedDoc.previewUrl)) {
          URL.revokeObjectURL(removedDoc.previewUrl);
          blobUrlsRef.current.delete(removedDoc.previewUrl);
        }
        toast.info("Document removed");
      }
    },
    [isAuthenticated],
  );

  async function addFiles(files: File[]) {
    if (files.length === 0) return;

    // Optimistic UI update
    const added = files.map<UploadedDoc>((file) => {
      const kind = kindFromName(file.name);
      let previewUrl: string | undefined;
      if (kind === "image") {
        previewUrl = URL.createObjectURL(file);
        blobUrlsRef.current.add(previewUrl);
      }
      return {
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        kind,
        typeLabel: typeLabel(kind),
        uploadedAt: new Date(),
        pages: kind === "image" ? 1 : Math.max(1, Math.round(file.size / 42000) || 6),
        previewUrl,
      };
    });
    setDocs((current) => [...added, ...current]);

    // Real upload if authenticated
    if (isAuthenticated) {
      try {
        await documentsApi.upload(files);
        toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded and indexed!`);

        try {
          const result = await documentsApi.list();
          setDocs((current) => {
            const previewMap = new Map<string, string>();
            current.forEach((d) => {
              if (d.previewUrl) previewMap.set(d.name, d.previewUrl);
            });
            return result.data.map((doc) => ({
              id: doc.id,
              name: doc.name,
              kind: kindFromName(doc.name),
              typeLabel: typeLabel(kindFromName(doc.name)),
              uploadedAt: new Date(doc.uploaded_at),
              pages: doc.pages,
              previewUrl: previewMap.get(doc.name),
            }));
          });
        } catch {
          // Non-fatal
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
        setDocs((current) => {
          const filtered = current.filter((d) => !added.some((a) => a.id === d.id));
          added.forEach((a) => {
            if (a.previewUrl && blobUrlsRef.current.has(a.previewUrl)) {
              URL.revokeObjectURL(a.previewUrl);
              blobUrlsRef.current.delete(a.previewUrl);
            }
          });
          return filtered;
        });
      }
    } else {
      toast.success(
        `${added.length} file${added.length > 1 ? "s" : ""} added (guest mode — not saved)`,
      );
    }
  }

  // FIX: regenerate sends the last user message, not the empty input
  function handleRegenerate() {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;
    setInput(lastUserMsg.content);
    // Remove last assistant response to re-ask
    setMessages((current) => {
      const lastAssistantIdx = [...current]
        .map((m, i) => ({ m, i }))
        .reverse()
        .find(({ m }) => m.role === "assistant");
      if (lastAssistantIdx) return current.slice(0, lastAssistantIdx.i);
      return current;
    });
    // Small timeout to let state update, then send
    setTimeout(() => {
      sendMessage(lastUserMsg.content);
    }, 50);
  }

  // Export formatted Revision / Study Sheet
  const handleExportStudyGuide = useCallback(() => {
    if (messages.length === 0) return;
    let docContent = `# PaperLens AI — Exam Revision & Study Guide\n`;
    docContent += `Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}\n\n---\n\n`;

    messages.forEach((m, idx) => {
      if (m.role === "user") {
        docContent += `## ❓ Question ${Math.floor(idx / 2) + 1}\n${m.content}\n\n`;
      } else {
        docContent += `### 💡 Answer\n${m.content}\n\n`;
        if (m.citations && m.citations.length > 0) {
          docContent += `**Verified Sources & Citations:**\n`;
          m.citations.forEach((c) => {
            docContent += `- **${c.source}** (Page ${c.page}) — Relevance: ${Math.round(c.relevance * 100)}%\n`;
          });
          docContent += `\n`;
        }
        docContent += `---\n\n`;
      }
    });

    const blob = new Blob([docContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PaperLens_Study_Guide_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exam Study Guide downloaded successfully!");
  }, [messages]);

  // Core send function — accepts optional explicit text (used by regenerate & suggestion chips)
  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const cleanText = text.trim();
    const isFirstQuestion = messages.length === 0;

    setMessages((current) => [
      ...current,
      { id: `u-${Date.now()}`, role: "user", content: cleanText, createdAt: new Date() },
    ]);
    setInput("");
    setLoading(true);

    if (isAuthenticated) {
      try {
        const sessionId = activeChat ?? undefined;
        const res = await chatApi.send(cleanText, sessionId);
        const d = res.data;

        if (d.session_id && !activeChat) {
          setActiveChat(d.session_id);
          // Auto-generate clean session title from first question
          const autoTitle = cleanText.length > 38 ? cleanText.slice(0, 38).trim() + "…" : cleanText;
          void sessionsApi.update(d.session_id, { title: autoTitle }).catch(() => {});
        }

        setMessages((current) => [
          ...current,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: d.answer,
            createdAt: new Date(),
            confidence: d.confidence ?? undefined,
            status: d.status,
            // Preserve all citation fields including id and relevance
            citations: d.citations.map((c) => ({
              id: c.id,
              source: c.source,
              page: c.page,
              snippet: c.snippet,
              relevance: c.relevance,
            })),
          },
        ]);

        // Refresh sessions list after sending so new sessions appear in sidebar
        loadSessions();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to get answer");
      } finally {
        setLoading(false);
      }
    } else {
      // Guest / demo mode — use sample answer
      window.setTimeout(() => {
        setMessages((current) => [
          ...current,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: sampleAnswer,
            createdAt: new Date(),
            confidence: 0.89,
            citations: sampleCitations,
          },
        ]);
        setLoading(false);
      }, 1600);
    }
  }

  function send() {
    sendMessage(input.trim());
  }

  function handleStop() {
    setLoading(false);
    toast("Response stopped.");
  }

  const hasMessages = messages.length > 0;

  // Loading state while auth is being checked
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  // Prevent rendering analyzer dashboard if unauthenticated
  if (!isAuthenticated && !isGuest) {
    return null;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ── Left sidebar ── */}
      <AnalyzerSidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        docs={docs}
        chats={sidebarChats}
        activeChat={activeChat}
        onSelectChat={handleSelectChat}
        onNewChat={() => {
          setMessages([]);
          setActiveChat(null);
          toast.success("Started a new chat");
        }}
        onUpload={() => setUploadOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        search={search}
        onSearch={setSearch}
        onRenameChat={handleRenameChat}
        onTogglePinChat={handleTogglePinChat}
        onToggleFavoriteChat={handleToggleFavoriteChat}
        onToggleArchiveChat={handleToggleArchiveChat}
        onAssignFolder={handleAssignFolder}
        onDeleteChat={handleDeleteChat}
      />

      {/* ── Main content column ── */}
      <div className="ambient-glow flex min-w-0 flex-1 flex-col">
        {/* Top navbar */}
        <Navbar
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onTogglePanel={() => setPanelOpen((v) => !v)}
          panelOpen={panelOpen}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          docCount={docs.length}
          onOpenSearchPad={() => setSearchPadOpen(true)}
          onExportGuide={handleExportStudyGuide}
          hasMessages={hasMessages}
        />

        {/* ── Scrollable chat area ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {/* ── Empty / Welcome state — Minimalist AI Workspace (ChatGPT Style) ── */}
          {!hasMessages && !loading && (
            <div className="flex h-full flex-col items-center justify-center px-4 py-8 text-center">
              {/* Brand Logo */}
              <div className="mb-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-xs">
                  <BrainCircuit className="h-6 w-6" />
                </div>
              </div>

              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl text-foreground">
                What would you like to solve or analyze?
              </h1>
              <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm leading-relaxed text-muted-foreground">
                Upload question papers, textbooks, and notes. Ask questions to get cited answers,
                repeated exam topics, and step-by-step problem solutions.
              </p>

              {/* Categorized prompt cards */}
              <div className="mt-6 grid w-full max-w-2xl gap-2.5 sm:grid-cols-2 text-left">
                {SUGGESTED_PROMPTS.map((item) => (
                  <button
                    key={item.title}
                    onClick={() => {
                      setInput(item.prompt);
                      setTimeout(() => sendMessage(item.prompt), 50);
                    }}
                    className="group flex flex-col justify-between rounded-xl border border-border bg-card/80 p-3.5 hover:border-primary/40 hover:bg-card transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-base">{item.icon}</span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium border ${item.badgeColor}`}
                        >
                          {item.category}
                        </span>
                      </div>
                      <h3 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.prompt}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Document count badge */}
              {docs.length > 0 && (
                <button
                  onClick={() => setSearchPadOpen(true)}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:border-border/80 hover:text-foreground transition-colors cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <span>
                    {docs.length} document{docs.length !== 1 ? "s" : ""} indexed
                  </span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="text-primary font-medium">Search Pad ⌘K</span>
                </button>
              )}
            </div>
          )}

          {/* ── Chat messages ── */}
          {(hasMessages || loading) && (
            <div className="mx-auto w-full max-w-3xl space-y-6 px-1 py-6 sm:px-2">
              {messages.map((message, idx) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onRegenerate={handleRegenerate}
                  onSelectPrompt={(prompt) => sendMessage(prompt)}
                  isLatest={idx === messages.length - 1}
                />
              ))}
              {loading && <TypingIndicator />}
            </div>
          )}

          {/* ── Documents panel (shown when docs exist and no messages yet) ── */}
          {!hasMessages && !loading && docs.length > 0 && (
            <div className="mx-auto w-full max-w-3xl px-4 pb-6">
              <Tabs defaultValue="documents">
                <TabsList className="w-full">
                  <TabsTrigger value="documents" className="flex-1">
                    Documents ({fileDocs.length})
                  </TabsTrigger>
                  <TabsTrigger value="images" className="flex-1">
                    Images ({imageDocs.length})
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1">
                    Add files
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="documents" className="mt-3 grid gap-2 sm:grid-cols-2">
                  {fileDocs.map((doc) => (
                    <UploadCard key={doc.id} doc={doc} onDelete={() => removeDoc(doc.id)} />
                  ))}
                  {fileDocs.length === 0 && (
                    <p className="text-xs text-muted-foreground">No documents yet.</p>
                  )}
                </TabsContent>
                <TabsContent value="images" className="mt-3 grid gap-2 sm:grid-cols-3">
                  {imageDocs.map((doc) => (
                    <ImagePreviewCard key={doc.id} doc={doc} onDelete={() => removeDoc(doc.id)} />
                  ))}
                  {imageDocs.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Upload a photo of a handwritten or printed paper.
                    </p>
                  )}
                </TabsContent>
                <TabsContent value="upload" className="mt-3">
                  <UploadDropzone onFiles={addFiles} compact />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Loading spinner for docs */}
          {docsLoading && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Loading your documents…
            </div>
          )}
        </div>

        {/* ── Chat composer — always visible at bottom ── */}
        <ChatComposer
          value={input}
          onChange={setInput}
          onSend={send}
          onStop={handleStop}
          onFiles={addFiles}
          loading={loading}
        />
      </div>

      {/* ── Right analyzer panel ── */}
      <AnalyzerPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        paperCount={docs.length}
      />

      {/* ── Upload dialog ── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload documents</DialogTitle>
          </DialogHeader>
          <UploadDropzone
            onFiles={(files) => {
              addFiles(files);
              setUploadOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* ── Search Pad & Document Workspace Modal ── */}
      <SearchPadModal
        open={searchPadOpen}
        onOpenChange={setSearchPadOpen}
        docs={docs}
        onUploadFiles={addFiles}
        onDeleteDoc={removeDoc}
        onAskAboutDoc={(docName) => {
          setInput(`Tell me the main topics and important questions from ${docName}`);
        }}
      />

      {/* ── User Settings Modal ── */}
      <UserSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        sessions={sessions}
        onSelectSession={handleSelectChat}
        onRefreshSessions={loadSessions}
      />
    </div>
  );
}
