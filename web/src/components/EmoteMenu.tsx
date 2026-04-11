import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  X,
  Shuffle,
  ListPlus,
  LayoutGrid,
  Star,
  History,
  Trophy,
} from "lucide-react";
import { PlaylistPanel } from "./PlaylistPanel";
import { PartnerFinder } from "./PartnerFinder";
import { useLocale } from "../utils/locale";
import { useNui } from "../utils/useNui";
import { SearchBar } from "./SearchBar";
import { EmoteCard } from "./EmoteCard";
import { QuickBindBar } from "./QuickBindBar";
import { StatusBar } from "./StatusBar";
import { SharedEmotePopup } from "./SharedEmotePopup";
import { useVirtualGrid } from "../utils/useVirtualGrid";
import type {
  Emote,
  MenuConfig,
  SharedRequest,
  JobPermissions,
  CustomList,
} from "../utils/types";
import { mbtDebug } from "../utils/debug";

interface EmoteMenuProps {
  catalog: Emote[];
  config: MenuConfig;
  favorites: Record<string, boolean>;
  favOrder: string[];
  playCounts: Record<string, number>;
  recent: Emote[];
  keybinds: Record<string, Emote>;
  sharedRequest: SharedRequest | null;
  onPlay: (emote: Emote) => void;
  onCancel: () => void;
  onToggleFavorite: (emote: Emote) => void;
  onReorderFavorites: (newOrder: string[]) => void;
  playlist: Emote[];
  playlistPlaying: boolean;
  playlistIndex: number;
  onAddToPlaylist: (emote: Emote) => void;
  onRemoveFromPlaylist: (index: number) => void;
  onReorderPlaylist: (from: number, to: number) => void;
  onPlayPlaylist: (loop: boolean) => void;
  onStopPlaylist: () => void;
  onClearPlaylist: () => void;
  playerJob: string | null;
  jobPermissions: JobPermissions;
  customLists: CustomList[];
  onSaveCustomLists: (lists: CustomList[]) => void;
  wheelSlots: Record<string, Emote>;
  wheelMaxSlots: number;
  onSetWheelSlot: (slot: number, emote: Emote | null) => void;
  onKeybindsUpdate: (keybinds: Record<string, Emote>) => void;
  onImportFavorites: (data: Record<string, boolean>) => void;
  activeWalk: string | null;
  activeExpression: string | null;
  onResetWalkstyle: () => void;
  onResetExpression: () => void;
  onToast: (
    text: string,
    type?: "info" | "success" | "warning" | "error",
    duration?: number,
  ) => void;
  onClose: () => void;
  onPlayClose: () => void;
  savedMenuState: {
    search: string;
    tab: string;
    category: string | null;
    filter: string;
    sort: string;
    scrollTop: number;
  } | null;
  onSaveMenuState: (
    state: {
      search: string;
      tab: string;
      category: string | null;
      filter: string;
      sort: string;
      scrollTop: number;
    } | null,
  ) => void;
}

type Tab = "all" | "favorites" | "recent" | "top" | "list";
type Filter = "all" | "props" | "shared";
type SortOrder = "az" | "za" | "cat";

export function EmoteMenu({
  catalog,
  config,
  favorites,
  favOrder,
  playCounts,
  recent,
  keybinds,
  sharedRequest,
  onPlay,
  onCancel,
  onToggleFavorite,
  onReorderFavorites,
  playlist,
  playlistPlaying,
  playlistIndex,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onReorderPlaylist,
  onPlayPlaylist,
  onStopPlaylist,
  onClearPlaylist,
  playerJob,
  jobPermissions,
  customLists,
  onSaveCustomLists,
  wheelSlots,
  wheelMaxSlots,
  onSetWheelSlot,
  onKeybindsUpdate,
  onImportFavorites,
  activeWalk,
  activeExpression,
  onResetWalkstyle,
  onResetExpression,
  onToast,
  onClose,
  onPlayClose,
  savedMenuState,
  onSaveMenuState,
}: EmoteMenuProps) {
  const [search, setSearch] = useState(savedMenuState?.search || "");
  const [activeTab, setActiveTab] = useState<Tab>(
    (savedMenuState?.tab as Tab) || "all",
  );
  const [activeCategory, setActiveCategory] = useState<string | null>(
    savedMenuState?.category || null,
  );
  const [activeFilter, setActiveFilter] = useState<Filter>(
    (savedMenuState?.filter as Filter) || "all",
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    (savedMenuState?.sort as SortOrder) || "az",
  );
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [showSharedPopup, setShowSharedPopup] = useState(true);
  const [closing, setClosing] = useState(false);
  const [importExportMode, setImportExportMode] = useState<
    "hidden" | "export" | "import"
  >("hidden");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [previewingEmote, setPreviewingEmote] = useState<string | null>(null);
  const [partnerFinderState, setPartnerFinderState] = useState<{
    emoteName: string;
    top: number;
  } | null>(null);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [showListCreator, setShowListCreator] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListColor, setNewListColor] = useState("#ff295b");
  const [flyingItems, setFlyingItems] = useState<
    Array<{
      id: string;
      x: number;
      y: number;
      tx: number;
      ty: number;
      label: string;
    }>
  >([]);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Draggable menu position (persisted in localStorage)
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(() => {
    try {
      const saved = localStorage.getItem("mbt_menu_position");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const t = useLocale();

  useEffect(() => {
    if (savedMenuState) {
      mbtDebug('Restoring saved menu state', savedMenuState);
      if (savedMenuState.scrollTop && gridRef.current) {
        requestAnimationFrame(() => {
          if (gridRef.current)
            gridRef.current.scrollTop = savedMenuState.scrollTop;
        });
      }
    }
  }, []);

  /** Duration of the close animation (ms) -- must match CSS mbt-menu-exit */
  const CLOSE_ANIM_MS = 200;

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    onSaveMenuState(null);
    mbtDebug('handleClose: ESC/X, cleared saved state');
    useNui("closeUI");
    setPreviewingEmote(null);
    closeTimerRef.current = setTimeout(() => {
      setClosing(false);
      onClose();
    }, CLOSE_ANIM_MS);
  }, [closing, onClose, onSaveMenuState]);

  // Drag menu by header
  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (config.layout === "cinematic") return;
      if ((e.target as HTMLElement).closest(".mbt-header__close")) return;
      e.preventDefault();
      isDragging.current = true;
      const menu = menuRef.current;
      if (!menu) return;
      const rect = menu.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      document.body.style.cursor = "grabbing";
    },
    [config.layout],
  );

  const handleHeaderDoubleClick = useCallback(() => {
    setMenuPosition(null);
    localStorage.removeItem("mbt_menu_position");
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const x = Math.max(
        0,
        Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 80),
      );
      const y = Math.max(
        0,
        Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 80),
      );
      setMenuPosition({ x, y });
    };
    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      setMenuPosition((prev) => {
        if (prev)
          localStorage.setItem("mbt_menu_position", JSON.stringify(prev));
        return prev;
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // ── Preview toggle ──
  const handlePreviewToggle = useCallback(
    async (emote: Emote) => {
      if (previewingEmote === emote.name) {
        await useNui("stopPreview", {});
        setPreviewingEmote(null);
      } else {
        await useNui("startPreview", {
          name: emote.name,
          category: emote.category,
          animDict: emote.animDict,
          animClip: emote.animClip,
          scenario: emote.scenario,
          animFlag: emote.animFlag,
          blendIn: emote.blendIn,
          blendOut: emote.blendOut,
          duration: emote.duration,
          prop: emote.prop,
          propBone: emote.propBone,
          propPlace: emote.propPlace,
          prop2: emote.prop2,
          prop2Bone: emote.prop2Bone,
          prop2Place: emote.prop2Place,
        });
        setPreviewingEmote(emote.name);
      }
    },
    [previewingEmote],
  );

  const { theme, categories, features } = config;
  const visibleCategories = categories.filter((c) => c.visible);
  const favCount = Object.keys(favorites).length;

  // ── Category counts ──
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    catalog.forEach((e) => {
      counts[e.category] = (counts[e.category] || 0) + 1;
    });
    return counts;
  }, [catalog]);

  // ── Theme CSS vars ──
  const themeVars = useMemo(
    () =>
      ({
        "--mbt-accent": `#${theme.Accent}`,
        "--mbt-accent-g": `linear-gradient(135deg, #${theme.Accent} 0%, rgba(${hexToRgb(theme.Accent)}, 0.75) 100%)`,
        "--mbt-accent-glow": `rgba(${hexToRgb(theme.Accent)}, 0.25)`,
        "--mbt-accent-soft": `rgba(${hexToRgb(theme.Accent)}, 0.08)`,
        "--mbt-bg": `#${theme.Background}`,
        "--mbt-bg-glass": `rgba(${hexToRgb(theme.Background)}, 0.88)`,
        "--mbt-card": `rgba(${hexToRgb(theme.Card)}, 0.7)`,
        "--mbt-text": `#${theme.Text}`,
        "--mbt-subtext": `#${theme.SubText}`,
        "--mbt-border": `rgba(${hexToRgb(theme.Border)}, 0.35)`,
      }) as React.CSSProperties,
    [theme],
  );

  // ── Sort ──
  const sortLabels: Record<SortOrder, string> = {
    az: "A→Z",
    za: "Z→A",
    cat: "Cat",
  };
  const nextSort: Record<SortOrder, SortOrder> = {
    az: "za",
    za: "cat",
    cat: "az",
  };

  // ── Filter + sort pipeline ──
  const filteredEmotes = useMemo(() => {
    let emotes: Emote[];

    if (activeTab === "favorites") {
      const orderMap = new Map(favOrder.map((name, i) => [name, i]));
      emotes = catalog
        .filter((e) => favorites[e.name])
        .sort(
          (a, b) =>
            (orderMap.get(a.name) ?? 9999) - (orderMap.get(b.name) ?? 9999),
        );
    } else if (activeTab === "recent") {
      emotes = recent;
    } else if (activeTab === "top") {
      emotes = catalog
        .filter((e) => (playCounts[e.name] || 0) > 0)
        .sort((a, b) => (playCounts[b.name] || 0) - (playCounts[a.name] || 0));
    } else if (activeTab === "list" && activeListId) {
      const list = customLists.find((l) => l.id === activeListId);
      if (list) {
        const nameSet = new Set(list.emotes);
        emotes = catalog.filter((e) => nameSet.has(e.name));
        const orderMap = new Map(list.emotes.map((name, i) => [name, i]));
        emotes.sort(
          (a, b) =>
            (orderMap.get(a.name) ?? 9999) - (orderMap.get(b.name) ?? 9999),
        );
      } else {
        emotes = [];
      }
    } else {
      emotes = catalog;
    }

    if (activeCategory) {
      emotes = emotes.filter((e) => e.category === activeCategory);
    }

    if (activeFilter === "props") {
      emotes = emotes.filter((e) => e.hasProp);
    } else if (activeFilter === "shared") {
      emotes = emotes.filter((e) => e.isShared);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      emotes = emotes.filter(
        (e) =>
          e.name.toLowerCase().includes(q) || e.label.toLowerCase().includes(q),
      );
    }

    if (activeTab !== "favorites" && activeTab !== "top") {
      if (sortOrder === "az") {
        emotes = [...emotes].sort((a, b) => a.label.localeCompare(b.label));
      } else if (sortOrder === "za") {
        emotes = [...emotes].sort((a, b) => b.label.localeCompare(a.label));
      } else if (sortOrder === "cat") {
        emotes = [...emotes].sort(
          (a, b) =>
            a.category.localeCompare(b.category) ||
            a.label.localeCompare(b.label),
        );
      }
    }

    return emotes;
  }, [
    catalog,
    favorites,
    favOrder,
    playCounts,
    recent,
    activeTab,
    activeCategory,
    activeFilter,
    search,
    sortOrder,
    customLists,
    activeListId,
  ]);

  const {
    containerRef: virtualRef,
    totalHeight,
    startIndex,
    endIndex,
    offsetY,
  } = useVirtualGrid({
    totalItems: filteredEmotes.length,
    rowHeight: 54,
    columns: 1,
    overscan: 4,
  });

  useEffect(() => {
    setFocusedIndex(-1);
  }, [search, activeTab, activeCategory, activeFilter, sortOrder]);

  useEffect(() => {
    if (focusedIndex >= 0 && gridRef.current) {
      const card = gridRef.current.querySelector(
        `[data-card-index="${focusedIndex}"]`,
      );
      card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focusedIndex]);

  // ── Keyboard navigation (+ ESC) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (importExportMode !== "hidden") return;
      if (e.key === "Escape") {
        handleClose();
        return;
      }
      if (filteredEmotes.length === 0) return;

      let newIndex = focusedIndex;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          newIndex =
            focusedIndex < 0
              ? 0
              : Math.min(focusedIndex + 1, filteredEmotes.length - 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          newIndex = focusedIndex < 0 ? 0 : Math.max(focusedIndex - 1, 0);
          break;
        case "ArrowDown":
          e.preventDefault();
          newIndex =
            focusedIndex < 0
              ? 0
              : Math.min(focusedIndex + 1, filteredEmotes.length - 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          newIndex = focusedIndex < 0 ? 0 : Math.max(focusedIndex - 1, 0);
          break;
        case "Enter":
          if (focusedIndex >= 0 && focusedIndex < filteredEmotes.length) {
            handleEmotePlay(filteredEmotes[focusedIndex]);
          }
          return;
        default:
          return;
      }

      setFocusedIndex(newIndex);
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [handleClose, filteredEmotes, focusedIndex, importExportMode, onPlay]);

  const handleTabChange = useCallback((tab: Tab) => {
    mbtDebug('Tab changed', { tab });
    setActiveTab(tab);
    setActiveCategory(null);
    setActiveFilter("all");
  }, []);

  // ── Import/Export ──
  const handleExportOpen = () => {
    setImportText(JSON.stringify(favorites, null, 2));
    setImportExportMode("export");
    setImportError("");
  };
  const handleImportOpen = () => {
    setImportText("");
    setImportExportMode("import");
    setImportError("");
  };
  const handleImportConfirm = () => {
    try {
      const data = JSON.parse(importText);
      if (typeof data !== "object" || Array.isArray(data) || data === null) {
        setImportError("Formato non valido: deve essere un oggetto JSON");
        return;
      }
      onImportFavorites(data);
      setImportExportMode("hidden");
    } catch {
      setImportError("JSON non valido — controlla la sintassi");
    }
  };

  // Intercept shared emotes to show PartnerFinder
  // Job permission check: returns true if emote is restricted and player doesn't have the required job
  const isEmoteLocked = useCallback(
    (emoteName: string): boolean => {
      const raw = jobPermissions[emoteName];
      if (!raw) return false; // no restriction
      // Lua tables arrive as objects {1:"police",2:"sheriff"}, normalize to array
      const allowedJobs = Array.isArray(raw) ? raw : Object.values(raw);
      if (allowedJobs.length === 0) return false;
      if (!playerJob) return true; // restricted but player has no job info
      return !allowedJobs.includes(playerJob);
    },
    [jobPermissions, playerJob],
  );

  // Save current menu state so it can be restored on next open (CloseOnPlay)
  const saveCurrentState = useCallback(() => {
    const state = {
      search,
      tab: activeTab,
      category: activeCategory,
      filter: activeFilter,
      sort: sortOrder,
      scrollTop: gridRef.current?.scrollTop || 0,
    };
    mbtDebug('Saving menu state (RememberState)', state);
    onSaveMenuState(state);
  }, [
    search,
    activeTab,
    activeCategory,
    activeFilter,
    sortOrder,
    onSaveMenuState,
  ]);

  const handleEmotePlay = useCallback(
    (emote: Emote, element?: HTMLElement) => {
      if (isEmoteLocked(emote.name)) {
        onToast("Emote restricted to specific jobs", "error", 2000);
        return;
      }
      if (emote.isShared && emote.category === "Shared" && element) {
        const rect = element.getBoundingClientRect();
        const menuRect = menuRef.current?.getBoundingClientRect();
        const top = menuRect ? rect.top - menuRect.top : rect.top;
        setPartnerFinderState({ emoteName: emote.name, top });
      } else {
        if (config.rememberState) saveCurrentState();
        mbtDebug('Emote play', { name: emote.name, category: emote.category, rememberState: !!config.rememberState });
        onPlay(emote);
      }
    },
    [onPlay, isEmoteLocked, onToast, saveCurrentState, config.rememberState],
  );

  const handlePartnerSend = useCallback(
    (emoteName: string) => {
      onPlay({
        name: emoteName,
        label: emoteName,
        category: "Shared",
      } as Emote);
    },
    [onPlay],
  );

  const handleRandomPlay = useCallback(() => {
    if (filteredEmotes.length === 0) return;
    const randomEmote =
      filteredEmotes[Math.floor(Math.random() * filteredEmotes.length)];
    handleEmotePlay(randomEmote);
  }, [filteredEmotes, handleEmotePlay]);

  // Drag reorder for favorites tab
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragSourceIndex = useRef<number | null>(null);

  const handleDragStartReorder = useCallback((idx: number) => {
    dragSourceIndex.current = idx;
  }, []);

  const handleDragOverReorder = useCallback(
    (e: React.DragEvent, idx: number) => {
      if (activeTab !== "favorites" || dragSourceIndex.current === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOverIndex !== idx) setDragOverIndex(idx);
    },
    [activeTab, dragOverIndex],
  );

  const handleDropReorder = useCallback(
    (idx: number) => {
      if (activeTab !== "favorites" || dragSourceIndex.current === null) return;
      const from = dragSourceIndex.current;
      if (from === idx) {
        setDragOverIndex(null);
        dragSourceIndex.current = null;
        return;
      }
      const newOrder = [...favOrder];
      const visibleNames = filteredEmotes.map((e) => e.name);
      const fromName = visibleNames[from];
      const toName = visibleNames[idx];
      const fromOrderIdx = newOrder.indexOf(fromName);
      const toOrderIdx = newOrder.indexOf(toName);
      if (fromOrderIdx >= 0 && toOrderIdx >= 0) {
        newOrder.splice(fromOrderIdx, 1);
        const insertAt = newOrder.indexOf(toName);
        newOrder.splice(
          insertAt >= 0 ? (from < idx ? insertAt + 1 : insertAt) : toOrderIdx,
          0,
          fromName,
        );
        onReorderFavorites(newOrder);
      }
      setDragOverIndex(null);
      dragSourceIndex.current = null;
    },
    [activeTab, favOrder, filteredEmotes, onReorderFavorites],
  );

  const handleDragStartItem = useCallback(
    (e: React.DragEvent, emote: Emote, idx: number) => {
      e.dataTransfer.setData("application/json", JSON.stringify(emote));
      if (activeTab === "favorites") {
        e.dataTransfer.effectAllowed = "move";
        dragSourceIndex.current = idx;
      } else {
        e.dataTransfer.effectAllowed = "copy";
      }
    },
    [activeTab],
  );

  const handleDragEndReorder = useCallback(() => {
    setDragOverIndex(null);
    dragSourceIndex.current = null;
  }, []);

  // Targeted Fly Binding
  const handleBindClick = useCallback(
    async (emote: Emote, slot: number, element: HTMLElement) => {
      // 1. Calculate Source position
      const rect = element.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;

      // 2. Calculate Target position (NUM slots in QuickBindBar)
      // We assume the QuickBindBar slots are at the bottom.
      // Finding them dynamically or using a known-ish position for now.
      const targetEl = document.querySelector(
        `.mbt-quickbind__slot[data-slot="${slot}"]`,
      ) as HTMLElement;
      let targetX = window.innerWidth / 2;
      let targetY = window.innerHeight - 60;

      if (targetEl) {
        const tRect = targetEl.getBoundingClientRect();
        targetX = tRect.left + tRect.width / 2;
        targetY = tRect.top + tRect.height / 2;
      }

      // 3. Trigger Particle
      const id = Date.now().toString();
      setFlyingItems((prev) => [
        ...prev,
        {
          id,
          x: startX,
          y: startY,
          tx: targetX,
          ty: targetY,
          label: emote.label,
        },
      ]);

      // 4. Perform Logic
      await useNui("setKeybind", { slot: String(slot + 1), emote });
      const updated = { ...keybinds, [String(slot + 1)]: emote };
      onKeybindsUpdate(updated);
      onToast(`Assigned ${emote.label} to NUM${slot + 1}`, "success");

      // 5. Cleanup particle after anim
      setTimeout(() => {
        setFlyingItems((prev) => prev.filter((item) => item.id !== id));
      }, 800);
    },
    [keybinds, onKeybindsUpdate, onToast],
  );

  // Custom list handlers
  const handleCreateList = useCallback(() => {
    if (!newListName.trim()) return;
    const list: CustomList = {
      id: Date.now().toString(36),
      name: newListName.trim(),
      color: newListColor,
      emotes: [],
    };
    onSaveCustomLists([...customLists, list]);
    setNewListName("");
    setShowListCreator(false);
    setActiveListId(list.id);
    setActiveTab("list");
    onToast(`List "${list.name}" created`, "success");
  }, [newListName, newListColor, customLists, onSaveCustomLists, onToast]);

  const handleDeleteList = useCallback(
    (listId: string) => {
      const list = customLists.find((l) => l.id === listId);
      onSaveCustomLists(customLists.filter((l) => l.id !== listId));
      if (activeListId === listId) {
        setActiveListId(null);
        setActiveTab("all");
      }
      if (list) onToast(`List "${list.name}" deleted`, "warning");
    },
    [customLists, activeListId, onSaveCustomLists, onToast],
  );

  const handleAddToList = useCallback(
    (listId: string, emoteName: string) => {
      const list = customLists.find((l) => l.id === listId);
      if (list && list.emotes.includes(emoteName)) {
        onToast(`Already in "${list.name}"`, "warning", 1500);
        return;
      }
      onSaveCustomLists(
        customLists.map((l) => {
          if (l.id !== listId) return l;
          return { ...l, emotes: [...l.emotes, emoteName] };
        }),
      );
      if (list) onToast(`Added to "${list.name}"`, "success", 1500);
    },
    [customLists, onSaveCustomLists, onToast],
  );

  const handleRemoveFromList = useCallback(
    (listId: string, emoteName: string) => {
      onSaveCustomLists(
        customLists.map((l) => {
          if (l.id !== listId) return l;
          return { ...l, emotes: l.emotes.filter((n) => n !== emoteName) };
        }),
      );
    },
    [customLists, onSaveCustomLists],
  );

  return (
    <div
      className={`mbt-overlay mbt-overlay--${config.position} layout-${config.layout || "default"}`}
      style={themeVars}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={`mbt-menu ${closing ? "mbt-menu-exit" : ""} ${menuPosition && config.layout !== "cinematic" ? "mbt-menu--dragged" : ""}`}
        ref={menuRef}
        style={
          menuPosition && config.layout !== "cinematic"
            ? { left: menuPosition.x, top: menuPosition.y }
            : undefined
        }
      >
        {/* ── Header ── */}
        <div
          className="mbt-header"
          onMouseDown={handleHeaderMouseDown}
          onDoubleClick={handleHeaderDoubleClick}
        >
          <div className="mbt-header__left">
            {config.watermark && <span className="mbt-logo">MBT</span>}
            <span className="mbt-header__title">
              {t.menu_title || "Emote Menu"}
            </span>
          </div>
          <button className="mbt-header__close" onClick={handleClose}>
            <X size={14} />
          </button>
        </div>

        {/* ── Search ── */}
        <SearchBar
          value={search}
          onChange={setSearch}
          resultCount={filteredEmotes.length}
          totalCount={catalog.length}
          onCancel={onCancel}
          onAddList={() => setShowListCreator(true)}
        />

        {/* ── Tabs ── */}
        <div className="mbt-tabs">
          <button
            className={`mbt-tab ${activeTab === "all" ? "mbt-tab--active" : ""}`}
            onClick={() => handleTabChange("all")}
          >
            <LayoutGrid size={13} />
            <span>{t.tab_all || "All"}</span>
            <span className="mbt-tab__count">{catalog.length}</span>
          </button>

          {features.Favorites && (
            <button
              className={`mbt-tab ${activeTab === "favorites" ? "mbt-tab--active" : ""}`}
              onClick={() => handleTabChange("favorites")}
            >
              <Star size={13} />
              <span>{t.tab_favorites || "Favorites"}</span>
              <span className="mbt-tab__count">{favCount}</span>
            </button>
          )}

          {features.RecentEmotes && (
            <button
              className={`mbt-tab ${activeTab === "recent" ? "mbt-tab--active" : ""}`}
              onClick={() => handleTabChange("recent")}
            >
              <History size={13} />
              <span>{t.tab_recent || "Recent"}</span>
              <span className="mbt-tab__count">{recent.length}</span>
            </button>
          )}

          <button
            className={`mbt-tab ${activeTab === "top" ? "mbt-tab--active" : ""}`}
            onClick={() => handleTabChange("top")}
          >
            <Trophy size={13} />
            <span>Top</span>
            <span className="mbt-tab__count">
              {Object.keys(playCounts).length}
            </span>
          </button>

          {/* Custom Lists integrated directly into the core grid */}
          {customLists.map((list) => (
            <button
              key={list.id}
              className={`mbt-tab ${activeTab === "list" && activeListId === list.id ? "mbt-tab--active" : ""}`}
              style={{ "--chip-color": list.color } as React.CSSProperties}
              onClick={() => {
                setActiveListId(list.id);
                setActiveTab("list");
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                handleDeleteList(list.id);
              }}
              title="Right-click to delete"
            >
              <span
                className="mbt-tab__dot"
                style={{
                  background: list.color,
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                }}
              />
              <span>{list.name}</span>
              <span className="mbt-tab__count">{list.emotes.length}</span>
            </button>
          ))}
        </div>

        {/* ── Category Pills ── */}
        {activeTab === "all" && (
          <div className="mbt-categories">
            <button
              className={`mbt-pill ${!activeCategory ? "mbt-pill--active" : ""}`}
              onClick={() => setActiveCategory(null)}
            >
              {t.tab_all || "All"}
            </button>
            {visibleCategories.map((cat) => (
              <button
                key={cat.type}
                className={`mbt-pill ${activeCategory === cat.type ? "mbt-pill--active" : ""}`}
                onClick={() => setActiveCategory(cat.type)}
              >
                {cat.label}
                {categoryCounts[cat.type] != null && (
                  <span className="mbt-pill__count">
                    {categoryCounts[cat.type]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Filter Chips + Sort + Import/Export ── */}
        <div className="mbt-filters">
          {(["all", "props", "shared"] as Filter[]).map((f) => (
            <button
              key={f}
              className={`mbt-chip ${activeFilter === f ? "mbt-chip--active" : ""}`}
              onClick={() => setActiveFilter(f)}
            >
              {f === "all"
                ? t.filter_all || "All"
                : f === "props"
                  ? t.filter_props || "Props"
                  : t.filter_shared || "Shared"}
            </button>
          ))}
          <div className="mbt-filters__actions">
            <button
              className="mbt-sort-btn"
              onClick={() => setSortOrder(nextSort[sortOrder])}
              title="Cambia ordinamento"
            >
              {sortLabels[sortOrder]}
            </button>
            <button
              className="mbt-random-btn"
              onClick={handleRandomPlay}
              title="Emote casuale"
              disabled={filteredEmotes.length === 0}
            >
              <Shuffle size={11} />
            </button>
            {features.Favorites && (
              <>
                <button
                  className="mbt-fav-io-btn"
                  onClick={handleExportOpen}
                  title="Esporta preferiti"
                >
                  ↑
                </button>
                <button
                  className="mbt-fav-io-btn"
                  onClick={handleImportOpen}
                  title="Importa preferiti"
                >
                  ↓
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Emote Grid ── */}
        {/* Active Walk/Expression Banner */}
        {activeCategory === "Walks" && (
          <div className="mbt-active-banner">
            <span className="mbt-active-banner__label">Walk attivo:</span>
            <span className="mbt-active-banner__value">
              {activeWalk || "Default"}
            </span>
            {activeWalk && (
              <button
                className="mbt-active-banner__reset"
                onClick={() => {
                  onResetWalkstyle();
                  onToast("Walk style reset", "info");
                }}
              >
                Reset
              </button>
            )}
          </div>
        )}
        {activeCategory === "Expressions" && (
          <div className="mbt-active-banner">
            <span className="mbt-active-banner__label">Expression attiva:</span>
            <span className="mbt-active-banner__value">
              {activeExpression || "Default"}
            </span>
            {activeExpression && (
              <button
                className="mbt-active-banner__reset"
                onClick={() => {
                  onResetExpression();
                  onToast("Expression reset", "info");
                }}
              >
                Reset
              </button>
            )}
          </div>
        )}

        {filteredEmotes.length === 0 ? (
          <div className="mbt-grid--empty">
            <span className="mbt-empty__text">
              {t.no_emotes_found || "No emotes found"}
            </span>
          </div>
        ) : (
          <div
            className="mbt-grid"
            ref={(el) => {
              (
                gridRef as React.MutableRefObject<HTMLDivElement | null>
              ).current = el;
              (
                virtualRef as React.MutableRefObject<HTMLDivElement | null>
              ).current = el;
            }}
          >
            {/* Spacer: total scrollable height */}
            <div
              style={{
                gridColumn: "1 / -1",
                height: totalHeight,
                pointerEvents: "none",
              }}
            />
            {/* Visible slice, positioned via transform */}
            <div
              className="mbt-grid__virtual"
              style={{ transform: `translateY(${offsetY - totalHeight}px)` }}
            >
              {filteredEmotes.slice(startIndex, endIndex).map((emote, i) => {
                const idx = startIndex + i;
                return (
                  <div
                    key={`${emote.category}-${emote.name}`}
                    className={`mbt-card-wrap ${dragOverIndex === idx ? "mbt-card-wrap--dragover" : ""}`}
                    draggable={activeTab === "favorites"}
                    onDragStart={(e) => handleDragStartItem(e, emote, idx)}
                    onDragOver={(e) => handleDragOverReorder(e, idx)}
                    onDrop={() => handleDropReorder(idx)}
                    onDragEnd={handleDragEndReorder}
                  >
                    <EmoteCard
                      emote={emote}
                      isFavorite={!!favorites[emote.name]}
                      isFocused={focusedIndex === idx}
                      cardIndex={idx}
                      hidePropBadge={
                        activeFilter === "props" ||
                        activeCategory === "PropEmotes"
                      }
                      hideSharedBadge={
                        activeFilter === "shared" || activeCategory === "Shared"
                      }
                      isPreviewActive={previewingEmote === emote.name}
                      isActiveStyle={
                        (emote.category === "Walks" &&
                          activeWalk === emote.name) ||
                        (emote.category === "Expressions" &&
                          activeExpression === emote.name)
                      }
                      playCount={
                        activeTab === "top" ? playCounts[emote.name] : undefined
                      }
                      locked={isEmoteLocked(emote.name)}
                      onPlay={(e) =>
                        handleEmotePlay(
                          e,
                          (gridRef as any).current?.querySelector(
                            `[data-card-index="${idx}"]`,
                          ),
                        )
                      }
                      onToggleFavorite={onToggleFavorite}
                      onPreviewToggle={
                        features.PreviewPed ? handlePreviewToggle : undefined
                      }
                      onAddToPlaylist={onAddToPlaylist}
                      onBindClick={handleBindClick}
                      wheelSlots={wheelSlots}
                      wheelMaxSlots={wheelMaxSlots}
                      onSetWheelSlot={onSetWheelSlot}
                      customLists={customLists}
                      onAddToList={handleAddToList}
                      onRemoveFromList={handleRemoveFromList}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Playlist Panel ── */}
        {playlist.length > 0 || playlistPlaying ? (
          <PlaylistPanel
            items={playlist}
            playing={playlistPlaying}
            currentIndex={playlistIndex}
            onRemove={onRemoveFromPlaylist}
            onReorder={onReorderPlaylist}
            onPlay={onPlayPlaylist}
            onStop={onStopPlaylist}
            onClear={onClearPlaylist}
          />
        ) : null}

        {/* ── Quick Bind Bar ── */}
        {config.features.QuickBind && (
          <QuickBindBar
            keybinds={keybinds}
            onPlay={onPlay}
            onUpdate={onKeybindsUpdate}
          />
        )}

        {/* ── Shared Emote Popup ── */}
        {sharedRequest && showSharedPopup && (
          <SharedEmotePopup
            request={sharedRequest}
            onDismiss={() => setShowSharedPopup(false)}
          />
        )}

        {/* 🧚 Flying Particles 🧚 */}
        {flyingItems.map((item) => (
          <div
            key={item.id}
            className="mbt-flying-emote"
            style={
              {
                "--start-x": `${item.x}px`,
                "--start-y": `${item.y}px`,
                "--end-x": `${item.tx}px`,
                "--end-y": `${item.ty}px`,
              } as React.CSSProperties
            }
          >
            {item.label}
          </div>
        ))}

        {/* List Creator Mini-Modal */}
        {showListCreator && (
          <div
            className="mbt-modal-overlay"
            onClick={() => setShowListCreator(false)}
          >
            <div
              className="mbt-modal mbt-modal--small"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mbt-modal__header">
                <span className="mbt-modal__title">New List</span>
              </div>
              <div className="mbt-list-creator">
                <input
                  className="mbt-list-creator__input"
                  type="text"
                  placeholder="List name..."
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
                  autoFocus
                />
                <div className="mbt-list-creator__colors">
                  {[
                    "#ff295b",
                    "#3b82f6",
                    "#22c55e",
                    "#f59e0b",
                    "#a855f7",
                    "#ec4899",
                    "#06b6d4",
                    "#f97316",
                  ].map((c) => (
                    <button
                      key={c}
                      className={`mbt-list-creator__color ${newListColor === c ? "mbt-list-creator__color--active" : ""}`}
                      style={{ background: c }}
                      onClick={() => setNewListColor(c)}
                    />
                  ))}
                </div>
                <button
                  className="mbt-modal__btn mbt-modal__btn--confirm"
                  onClick={handleCreateList}
                  disabled={!newListName.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 🤝 Partner Finder Side-Car 🤝 */}
        {partnerFinderState && (
          <PartnerFinder
            emoteName={partnerFinderState.emoteName}
            top={partnerFinderState.top}
            onSend={handlePartnerSend}
            onClose={() => setPartnerFinderState(null)}
          />
        )}

        {/* ── Status Bar ── */}

        {/* ── Import/Export Modal ── */}
        {importExportMode !== "hidden" && (
          <div className="mbt-modal-overlay">
            <div className="mbt-modal">
              <div className="mbt-modal__header">
                <span className="mbt-modal__title">
                  {importExportMode === "export"
                    ? "↑ Esporta Preferiti"
                    : "↓ Importa Preferiti"}
                </span>
                <button
                  className="mbt-header__close"
                  onClick={() => setImportExportMode("hidden")}
                >
                  <X size={14} />
                </button>
              </div>
              <p className="mbt-modal__desc">
                {importExportMode === "export"
                  ? "Copia il JSON qui sotto per salvare i tuoi preferiti."
                  : "Incolla un JSON di preferiti esportato in precedenza."}
              </p>
              <textarea
                className="mbt-modal__textarea"
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportError("");
                }}
                readOnly={importExportMode === "export"}
                placeholder={
                  importExportMode === "import" ? "Incolla qui il JSON..." : ""
                }
                spellCheck={false}
                onClick={(e) =>
                  importExportMode === "export" &&
                  (e.target as HTMLTextAreaElement).select()
                }
              />
              {importError && (
                <span className="mbt-modal__error">{importError}</span>
              )}
              <div className="mbt-modal__actions">
                <button
                  className="mbt-modal__btn mbt-modal__btn--cancel"
                  onClick={() => setImportExportMode("hidden")}
                >
                  Annulla
                </button>
                {importExportMode === "import" ? (
                  <button
                    className="mbt-modal__btn mbt-modal__btn--confirm"
                    onClick={handleImportConfirm}
                  >
                    Importa
                  </button>
                ) : (
                  <button
                    className="mbt-modal__btn mbt-modal__btn--confirm"
                    onClick={() => setImportExportMode("hidden")}
                  >
                    Fatto
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper ────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
