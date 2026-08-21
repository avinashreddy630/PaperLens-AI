import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BrainCircuit,
  ChevronLeft,
  FileText,
  ImageIcon,
  MessageSquarePlus,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  History,
  X,
  Plus,
  Layers,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Check,
  Star,
  MoreHorizontal,
  Folder,
  Archive,
  ArchiveRestore,
  SlidersHorizontal,
  FolderPlus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { type UploadedDoc } from "@/lib/analyzer";
import { useAuth } from "@/lib/auth";

export const PRESET_FOLDERS = [
  { id: "exam-prep", label: "Exam Preparation", icon: "📚" },
  { id: "ml", label: "Machine Learning", icon: "🤖" },
  { id: "programming", label: "Programming", icon: "💻" },
  { id: "research", label: "Research Papers", icon: "📄" },
  { id: "important", label: "Important", icon: "⭐" },
];

export type SortOption =
  | "updated_desc"
  | "created_desc"
  | "created_asc"
  | "title_asc"
  | "favorites"
  | "pinned";

export interface SidebarChat {
  id: string;
  title: string;
  subtitle?: string;
  pinned?: boolean;
  favorite?: boolean;
  archived?: boolean;
  folder?: string | null;
  messageCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  docs: UploadedDoc[];
  chats?: SidebarChat[];
  activeChat: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onUpload: () => void;
  onOpenSettings?: () => void;
  search: string;
  onSearch: (value: string) => void;
  onRenameChat?: (id: string, newTitle: string) => void;
  onTogglePinChat?: (id: string, pinned: boolean) => void;
  onToggleFavoriteChat?: (id: string, favorite: boolean) => void;
  onToggleArchiveChat?: (id: string, archived: boolean) => void;
  onAssignFolder?: (id: string, folder: string | null) => void;
  onDeleteChat?: (id: string) => void;
}

export function AnalyzerSidebar({
  open,
  onToggle,
  docs,
  chats = [],
  activeChat,
  onSelectChat,
  onNewChat,
  onUpload,
  onOpenSettings,
  search,
  onSearch,
  onRenameChat,
  onTogglePinChat,
  onToggleFavoriteChat,
  onToggleArchiveChat,
  onAssignFolder,
  onDeleteChat,
}: SidebarProps) {
  const { user, isGuest, isAuthenticated } = useAuth();
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [chatToDelete, setChatToDelete] = useState<SidebarChat | null>(null);
  const [archivedModalOpen, setArchivedModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("updated_desc");
  const [activeFolderFilter, setActiveFolderFilter] = useState<string | null>(null);

  const handleStartRename = (chat: SidebarChat, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
  };

  const handleSaveRename = (chatId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = editingTitle.trim();
    if (clean && onRenameChat) {
      onRenameChat(chatId, clean);
    }
    setEditingChatId(null);
    setEditingTitle("");
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(null);
    setEditingTitle("");
  };

  // Separate active (unarchived) chats and archived chats
  const activeChats = useMemo(() => {
    return chats.filter((c) => !c.archived);
  }, [chats]);

  const archivedChats = useMemo(() => {
    return chats.filter((c) => c.archived);
  }, [chats]);

  // Dynamic chat search and sorting filter
  const filteredChats = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = activeChats.filter((chat) => {
      // Search filter
      const matchesSearch =
        !term ||
        chat.title.toLowerCase().includes(term) ||
        (chat.subtitle && chat.subtitle.toLowerCase().includes(term)) ||
        (chat.folder && chat.folder.toLowerCase().includes(term));

      // Folder filter
      const matchesFolder = !activeFolderFilter || chat.folder === activeFolderFilter;

      return matchesSearch && matchesFolder;
    });

    // Apply sorting
    list = [...list].sort((a, b) => {
      if (sortBy === "favorites") {
        return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
      }
      if (sortBy === "pinned") {
        return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      }
      if (sortBy === "title_asc") {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === "created_desc") {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      }
      if (sortBy === "created_asc") {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tA - tB;
      }
      // Default: updated_desc with pinned at top
      if (a.pinned !== b.pinned) {
        return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      }
      const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tB - tA;
    });

    return list;
  }, [activeChats, search, sortBy, activeFolderFilter]);

  // Separate pinned and unpinned lists (for standard section grouping)
  const pinnedChats = useMemo(() => {
    return filteredChats.filter((c) => c.pinned);
  }, [filteredChats]);

  const recentChats = useMemo(() => {
    return filteredChats.filter((c) => !c.pinned);
  }, [filteredChats]);

  // Dynamic document search filter
  const filteredDocs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return docs;
    return docs.filter(
      (doc) =>
        doc.name.toLowerCase().includes(term) ||
        doc.typeLabel.toLowerCase().includes(term) ||
        doc.kind.toLowerCase().includes(term),
    );
  }, [docs, search]);

  // Dynamic user profile info
  const userName = isAuthenticated && user
    ? user.full_name.trim() || user.email.split("@")[0]
    : isGuest
    ? "Guest Explorer"
    : "Guest User";

  const userSubtitle = isAuthenticated && user
    ? user.role === "admin"
      ? "Administrator"
      : user.email
    : "Guest mode";

  const initials = useMemo(() => {
    if (isAuthenticated && user) {
      if (user.full_name?.trim()) {
        const parts = user.full_name.trim().split(/\s+/);
        if (parts.length >= 2 && parts[0] && parts[1]) {
          return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
        }
        return (parts[0] || "").slice(0, 2).toUpperCase();
      }
      return (user.email || "U").charAt(0).toUpperCase();
    }
    return "GU";
  }, [user, isAuthenticated]);

  return (
    <>
      <aside
        className={cn(
          "z-30 flex h-full shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar backdrop-blur-xl transition-[width] duration-200 ease-out",
          open ? "w-[270px]" : "w-0 md:w-[68px]",
        )}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-sidebar-border">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 group">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-xs">
              <BrainCircuit className="h-4 w-4" />
            </div>
            {open && (
              <div className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
                  PaperLens AI
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  Document Intelligence
                </span>
              </div>
            )}
          </Link>
          {open && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              onClick={onToggle}
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!open && (
          <div className="hidden justify-center px-2 pt-2 md:flex">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              aria-label="Expand sidebar"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* New Chat Button — Sleek and Minimalist */}
        <div className="px-3 pt-3">
          <Button
            onClick={onNewChat}
            className={cn(
              "w-full gap-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-medium py-2 shadow-xs transition-colors cursor-pointer",
              !open && "px-0 h-8.5 w-8.5 mx-auto",
            )}
          >
            <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-primary" />
            {open && <span>New Chat</span>}
          </Button>
        </div>

        {/* Search Input & Sort Trigger */}
        {open && (
          <div className="mt-2.5 px-3 space-y-1.5">
            <div className="relative flex items-center gap-1">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => onSearch(event.target.value)}
                  placeholder="Search chats & papers..."
                  className="h-7.5 rounded-lg border-sidebar-border bg-background/80 pl-7 pr-7 text-xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/50 text-foreground"
                />
                {search && (
                  <button
                    onClick={() => onSearch("")}
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Sort & Filter Popover Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-7.5 w-7.5 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer",
                      (sortBy !== "updated_desc" || activeFolderFilter) &&
                        "text-primary bg-primary/10",
                    )}
                    title="Sort & filter chats"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 rounded-xl border border-border bg-popover p-1 shadow-lg text-xs"
                >
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Sort Order
                  </div>
                  <DropdownMenuItem
                    onClick={() => setSortBy("updated_desc")}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer text-foreground hover:bg-muted",
                      sortBy === "updated_desc" && "font-medium text-primary",
                    )}
                  >
                    <span>Recently Updated</span>
                    {sortBy === "updated_desc" && <Check className="h-3 w-3 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("created_desc")}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer text-foreground hover:bg-muted",
                      sortBy === "created_desc" && "font-medium text-primary",
                    )}
                  >
                    <span>Newest First</span>
                    {sortBy === "created_desc" && <Check className="h-3 w-3 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("created_asc")}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer text-foreground hover:bg-muted",
                      sortBy === "created_asc" && "font-medium text-primary",
                    )}
                  >
                    <span>Oldest First</span>
                    {sortBy === "created_asc" && <Check className="h-3 w-3 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("title_asc")}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer text-foreground hover:bg-muted",
                      sortBy === "title_asc" && "font-medium text-primary",
                    )}
                  >
                    <span>A–Z Alphabetical</span>
                    {sortBy === "title_asc" && <Check className="h-3 w-3 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("favorites")}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer text-foreground hover:bg-muted",
                      sortBy === "favorites" && "font-medium text-primary",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      <span>Favorites First</span>
                    </span>
                    {sortBy === "favorites" && <Check className="h-3 w-3 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("pinned")}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer text-foreground hover:bg-muted",
                      sortBy === "pinned" && "font-medium text-primary",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <Pin className="h-3 w-3 text-amber-500 fill-amber-500" />
                      <span>Pinned First</span>
                    </span>
                    {sortBy === "pinned" && <Check className="h-3 w-3 text-primary" />}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="my-1 bg-border" />
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Filter by Folder
                  </div>
                  {PRESET_FOLDERS.map((f) => (
                    <DropdownMenuItem
                      key={f.id}
                      onClick={() =>
                        setActiveFolderFilter((curr) => (curr === f.label ? null : f.label))
                      }
                      className={cn(
                        "flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer text-foreground hover:bg-muted",
                        activeFolderFilter === f.label && "font-medium text-primary bg-primary/10",
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span>{f.icon}</span>
                        <span>{f.label}</span>
                      </span>
                      {activeFolderFilter === f.label && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  {activeFolderFilter && (
                    <>
                      <DropdownMenuSeparator className="my-1 bg-border" />
                      <DropdownMenuItem
                        onClick={() => setActiveFolderFilter(null)}
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                        <span>Clear Folder Filter</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Active Folder Filter Pill */}
            {activeFolderFilter && (
              <div className="flex items-center justify-between rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] text-primary">
                <span className="truncate">Filtered: {activeFolderFilter}</span>
                <button
                  onClick={() => setActiveFolderFilter(null)}
                  className="text-primary hover:opacity-75 cursor-pointer"
                  title="Remove filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Scrollable Chat List */}
        <ScrollArea className="mt-2 flex-1 px-3">
          <div className="space-y-4 pb-4">
            {/* 1. PINNED SECTION (Only shows if at least 1 pinned chat exists) */}
            {open && pinnedChats.length > 0 && (
              <div>
                <SectionLabel
                  open={open}
                  icon={Pin}
                  label={`Pinned (${pinnedChats.length})`}
                  iconColor="text-amber-500"
                />
                <div className="space-y-0.5">
                  {pinnedChats.map((chat) => (
                    <ChatItemRow
                      key={chat.id}
                      chat={chat}
                      open={open}
                      isActive={activeChat === chat.id}
                      isEditing={editingChatId === chat.id}
                      editingTitle={editingTitle}
                      setEditingTitle={setEditingTitle}
                      onSelectChat={onSelectChat}
                      onStartRename={handleStartRename}
                      onSaveRename={handleSaveRename}
                      onCancelRename={handleCancelRename}
                      onTogglePinChat={onTogglePinChat}
                      onToggleFavoriteChat={onToggleFavoriteChat}
                      onToggleArchiveChat={onToggleArchiveChat}
                      onAssignFolder={onAssignFolder}
                      onConfirmDelete={setChatToDelete}
                    />
                  ))}
                </div>
                <Separator className="my-2 bg-sidebar-border" />
              </div>
            )}

            {/* 2. RECENT CHATS SECTION */}
            <div>
              <SectionLabel open={open} icon={History} label="Recent Chats" />
              <div className="space-y-0.5">
                {recentChats.map((chat) => (
                  <ChatItemRow
                    key={chat.id}
                    chat={chat}
                    open={open}
                    isActive={activeChat === chat.id}
                    isEditing={editingChatId === chat.id}
                    editingTitle={editingTitle}
                    setEditingTitle={setEditingTitle}
                    onSelectChat={onSelectChat}
                    onStartRename={handleStartRename}
                    onSaveRename={handleSaveRename}
                    onCancelRename={handleCancelRename}
                    onTogglePinChat={onTogglePinChat}
                    onToggleFavoriteChat={onToggleFavoriteChat}
                    onToggleArchiveChat={onToggleArchiveChat}
                    onAssignFolder={onAssignFolder}
                    onConfirmDelete={setChatToDelete}
                  />
                ))}

                {/* Empty State */}
                {open && filteredChats.length === 0 && (
                  <div className="px-3 py-4 text-center">
                    <p className="text-xs text-muted-foreground font-medium">No chats found</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {search || activeFolderFilter
                        ? "Try adjusting your search or filters"
                        : "Start a conversation to create your first chat"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 3. ARCHIVED CHATS BUTTON (Only if archived chats exist) */}
            {open && archivedChats.length > 0 && (
              <div className="pt-1">
                <button
                  onClick={() => setArchivedModalOpen(true)}
                  className="flex w-full items-center justify-between rounded-lg border border-sidebar-border bg-card/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <Archive className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Archived Chats</span>
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-mono">
                    {archivedChats.length}
                  </span>
                </button>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ── Bottom Section: Papers Upload & Management (Pinned above account) ── */}
        <div className="border-t border-sidebar-border p-2.5 space-y-2">
          {open ? (
            filteredDocs.length === 0 ? (
              <button
                onClick={onUpload}
                className="flex w-full items-center justify-between rounded-lg border border-dashed border-border bg-muted/40 p-2 text-xs text-foreground hover:border-border/80 hover:bg-muted transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <div className="grid h-6 w-6 place-items-center rounded-md bg-card text-primary shadow-xs">
                    <Plus className="h-3.5 w-3.5" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium leading-tight text-foreground">
                      Add Papers & Exams
                    </p>
                    <p className="text-[10px] text-muted-foreground">PDF, Images, DOCX</p>
                  </div>
                </div>
              </button>
            ) : (
              <div className="rounded-lg border border-sidebar-border bg-muted/30 p-2">
                <div className="flex items-center justify-between px-1 mb-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Layers className="h-3 w-3 text-primary" />
                    <span>Papers ({filteredDocs.length})</span>
                  </div>
                  <button
                    onClick={onUpload}
                    className="flex items-center gap-1 rounded-md bg-card border border-border px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                    title="Upload more papers"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    Add
                  </button>
                </div>
                <div className="max-h-20 overflow-y-auto space-y-0.5">
                  {filteredDocs.slice(0, 3).map((doc) => (
                    <div
                      key={doc.id}
                      title={doc.name}
                      className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] text-foreground/90 hover:bg-muted/50 truncate"
                    >
                      {doc.kind === "image" ? (
                        <ImageIcon className="h-3 w-3 shrink-0 text-emerald-500" />
                      ) : (
                        <FileText className="h-3 w-3 shrink-0 text-primary" />
                      )}
                      <span className="truncate flex-1">{doc.name}</span>
                    </div>
                  ))}
                  {filteredDocs.length > 3 && (
                    <p className="text-[9px] text-muted-foreground px-1 italic">
                      +{filteredDocs.length - 3} more papers
                    </p>
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={onUpload}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                title={`Upload Papers (${docs.length})`}
              >
                <Layers className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Footer Profile & Settings */}
          {user?.role === "admin" && (
            <Link
              to="/admin"
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-muted transition-colors",
                !open && "justify-center",
              )}
              title="Admin Dashboard"
            >
              <Shield className="h-3.5 w-3.5 shrink-0 text-primary" />
              {open && <span>Admin Dashboard</span>}
            </Link>
          )}

          <button
            onClick={onOpenSettings}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-muted/60 cursor-pointer group",
              !open && "justify-center",
            )}
          >
            <div className="relative shrink-0">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={userName}
                  className="h-7 w-7 rounded-full border border-border object-cover"
                />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-foreground border border-border text-xs font-medium">
                  {initials}
                </span>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-sidebar" />
            </div>

            {open && (
              <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                  {userName}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {userSubtitle}
                </span>
              </div>
            )}

            {open && (
              <Settings className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            )}
          </button>
        </div>
      </aside>

      {/* ─── Delete Confirmation Dialog (Polished Minimalist Modal) ─── */}
      <AlertDialog
        open={Boolean(chatToDelete)}
        onOpenChange={(isOpen) => !isOpen && setChatToDelete(null)}
      >
        <AlertDialogContent className="rounded-2xl border border-border bg-card p-6 shadow-xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground">
              Delete this chat?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1.5">
              Your conversation and associated chat history will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex gap-2 sm:justify-end">
            <AlertDialogCancel
              onClick={() => setChatToDelete(null)}
              className="rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-medium cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (chatToDelete && onDeleteChat) {
                  onDeleteChat(chatToDelete.id);
                }
                setChatToDelete(null);
              }}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium cursor-pointer shadow-xs"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Archived Chats Modal ─── */}
      <Dialog open={archivedModalOpen} onOpenChange={setArchivedModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Archive className="h-4 w-4 text-indigo-400" />
              <span>Archived Chats ({archivedChats.length})</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Archived chats are hidden from your main sidebar but preserved for study revision.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {archivedChats.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground italic">
                No archived chats.
              </p>
            ) : (
              archivedChats.map((chat) => (
                <div
                  key={chat.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-2.5 transition-colors hover:bg-muted/70"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="truncate text-xs font-medium text-foreground">{chat.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {chat.subtitle || "Archived conversation"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onToggleArchiveChat?.(chat.id, false)}
                      className="h-7 gap-1 rounded-lg border-border px-2 text-xs text-foreground hover:bg-muted cursor-pointer"
                      title="Unarchive and return to Recent Chats"
                    >
                      <ArchiveRestore className="h-3.5 w-3.5 text-primary" />
                      <span>Unarchive</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setChatToDelete(chat)}
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                      title="Delete permanently"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Chat Item Component with 3-Dot Dropdown Menu (ChatGPT-Inspired) ───
function ChatItemRow({
  chat,
  open,
  isActive,
  isEditing,
  editingTitle,
  setEditingTitle,
  onSelectChat,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onTogglePinChat,
  onToggleFavoriteChat,
  onToggleArchiveChat,
  onAssignFolder,
  onConfirmDelete,
}: {
  chat: SidebarChat;
  open: boolean;
  isActive: boolean;
  isEditing: boolean;
  editingTitle: string;
  setEditingTitle: (v: string) => void;
  onSelectChat: (id: string) => void;
  onStartRename: (chat: SidebarChat, e: React.MouseEvent) => void;
  onSaveRename: (id: string, e?: React.FormEvent) => void;
  onCancelRename: (e: React.MouseEvent) => void;
  onTogglePinChat?: (id: string, pinned: boolean) => void;
  onToggleFavoriteChat?: (id: string, favorite: boolean) => void;
  onToggleArchiveChat?: (id: string, archived: boolean) => void;
  onAssignFolder?: (id: string, folder: string | null) => void;
  onConfirmDelete: (chat: SidebarChat) => void;
}) {
  // Inline rename mode
  if (isEditing && open) {
    return (
      <form
        onSubmit={(e) => onSaveRename(chat.id, e)}
        className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-card p-1 shadow-xs animate-message-in"
      >
        <Input
          autoFocus
          value={editingTitle}
          onChange={(e) => setEditingTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancelRename(e as any);
          }}
          className="h-6.5 min-w-0 flex-1 rounded-md border-0 bg-transparent px-1.5 text-xs text-foreground focus-visible:ring-0"
        />
        <button
          type="submit"
          className="grid h-5.5 w-5.5 place-items-center rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors cursor-pointer"
          title="Save name"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onCancelRename}
          className="grid h-5.5 w-5.5 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          title="Cancel"
        >
          <X className="h-3 w-3" />
        </button>
      </form>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors duration-150 cursor-pointer select-none",
        isActive
          ? "bg-card text-foreground font-medium border border-border shadow-xs"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        chat.pinned && !isActive && "border border-amber-500/20 bg-amber-500/5",
      )}
      onClick={() => onSelectChat(chat.id)}
      title={chat.title}
    >
      {/* Icon: Pin / Star / Normal */}
      {chat.pinned ? (
        <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500 fill-amber-500/40" />
      ) : chat.favorite ? (
        <Star className="h-3.5 w-3.5 shrink-0 text-amber-400 fill-amber-400" />
      ) : (
        <MessageSquarePlus
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-colors",
            isActive ? "text-primary" : "opacity-60 group-hover:opacity-100",
          )}
        />
      )}

      {/* Title & Metadata (When expanded) */}
      {open && (
        <div className="min-w-0 flex-1 pr-1">
          <div className="flex items-center gap-1.5">
            <span className="block truncate text-foreground font-medium">{chat.title}</span>
            {chat.favorite && !chat.pinned && (
              <span className="shrink-0 text-[10px] text-amber-400">★</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {chat.folder && (
              <span className="inline-flex items-center rounded-xs bg-primary/10 px-1 py-0.2 text-[9px] font-medium text-primary truncate max-w-[90px]">
                {chat.folder}
              </span>
            )}
            {chat.subtitle && (
              <span className="block truncate text-[10px] text-muted-foreground">
                {chat.subtitle}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3-Dot Dropdown Context Menu (Visible on Hover / Focus) */}
      {open && (
        <div className="shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Chat options"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 rounded-xl border border-border bg-popover p-1 shadow-lg text-xs font-normal"
            >
              {/* Pin / Unpin */}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePinChat?.(chat.id, !chat.pinned);
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer text-foreground hover:bg-muted"
              >
                {chat.pinned ? (
                  <>
                    <PinOff className="h-3.5 w-3.5 text-amber-500" />
                    <span>Unpin Chat</span>
                  </>
                ) : (
                  <>
                    <Pin className="h-3.5 w-3.5 text-amber-500" />
                    <span>Pin Chat</span>
                  </>
                )}
              </DropdownMenuItem>

              {/* Rename */}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onStartRename(chat, e);
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer text-foreground hover:bg-muted"
              >
                <Pencil className="h-3.5 w-3.5 text-primary" />
                <span>Rename</span>
              </DropdownMenuItem>

              {/* Favorites */}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavoriteChat?.(chat.id, !chat.favorite);
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer text-foreground hover:bg-muted"
              >
                <Star
                  className={cn(
                    "h-3.5 w-3.5 text-amber-400",
                    chat.favorite && "fill-amber-400",
                  )}
                />
                <span>{chat.favorite ? "Remove from Favorites" : "Add to Favorites"}</span>
              </DropdownMenuItem>

              {/* Folder Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer text-foreground hover:bg-muted">
                  <Folder className="h-3.5 w-3.5 text-blue-500" />
                  <span>Assign Folder</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48 rounded-xl border border-border bg-popover p-1 shadow-lg text-xs font-normal">
                  {PRESET_FOLDERS.map((f) => (
                    <DropdownMenuItem
                      key={f.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssignFolder?.(chat.id, chat.folder === f.label ? null : f.label);
                      }}
                      className="flex items-center justify-between rounded-lg px-2.5 py-1.5 cursor-pointer text-foreground hover:bg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <span>{f.icon}</span>
                        <span>{f.label}</span>
                      </span>
                      {chat.folder === f.label && <Check className="h-3.5 w-3.5 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                  {chat.folder && (
                    <>
                      <DropdownMenuSeparator className="my-1 bg-border" />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssignFolder?.(chat.id, null);
                        }}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Remove from Folder</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Archive */}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleArchiveChat?.(chat.id, !chat.archived);
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer text-foreground hover:bg-muted"
              >
                {chat.archived ? (
                  <>
                    <ArchiveRestore className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Unarchive Chat</span>
                  </>
                ) : (
                  <>
                    <Archive className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Archive Chat</span>
                  </>
                )}
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 bg-border" />

              {/* Delete */}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmDelete(chat);
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

function SectionLabel({
  open,
  icon: Icon,
  label,
  iconColor,
}: {
  open: boolean;
  icon: typeof FileText;
  label: string;
  iconColor?: string;
}) {
  if (!open) return <div className="my-2 h-px bg-sidebar-border" />;
  return (
    <div className="flex items-center gap-1.5 px-2.5 pb-1.5 text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase">
      <Icon className={cn("h-3 w-3", iconColor)} />
      {label}
    </div>
  );
}
