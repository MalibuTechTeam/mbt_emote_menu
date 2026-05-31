import { useState, useMemo, useCallback, useDeferredValue, useEffect, useRef } from "react";
import {
  X,
  Square,
  Plus,
  LayoutGrid,
  Star,
  History,
  Trophy,
  SearchX,
  Camera,
} from "lucide-react";
import { PlaylistPanel } from "./PlaylistPanel";
import { PartnerFinder } from "./PartnerFinder";
import { useLocale, tFormat } from "../utils/locale";
import { NearbySection } from "./NearbySection";
import { AnimatedNumber } from "./AnimatedNumber";
import { EmptyState } from "./EmptyState";
import { FavoriteDraggable } from "./FavoriteDraggable";
import { useNui } from "../utils/useNui";
import { LIST_ICONS, LIST_ICON_KEYS, DEFAULT_LIST_ICON, listIconFor } from "../utils/listIcons";
import { SearchBar } from "./SearchBar";
import { ResultBar } from "./ResultBar";
import { HeaderMenu } from "./HeaderMenu";
import { EmoteCard } from "./EmoteCard";
import { TrendingHero, type TrendingEmote } from "./TrendingHero";
import { QuickBindBar } from "./QuickBindBar";
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
  personas: { id: string; name: string; locked?: boolean }[];
  activePersonaId: string;
  onSwitchPersona: (id: string) => void;
  onCreatePersona: (name: string) => void;
  onRenamePersona: (id: string, name: string) => void;
  onDeletePersona: (id: string) => void;
  sharedRequest: SharedRequest | null;
  nearbyCount: number;
  trending: TrendingEmote | null;
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

/** Duration of the close animation (ms) -- must match CSS mbt-menu-exit */
const CLOSE_ANIM_MS = 200;

// Horizontal ordering for the tab directional slide via View Transitions API.
// Custom-list pseudo-tabs all sit to the right of "top" — selecting any
// list reads as "going further right". The direction is set on the root
// as `--vt-direction` so the CSS keyframes can pick it up.
const TAB_ORDER: Record<Tab, number> = {
  all: 0, favorites: 1, recent: 2, top: 3, list: 4,
};

export function EmoteMenu({
  catalog,
  config,
  favorites,
  favOrder,
  playCounts,
  recent,
  keybinds,
  personas,
  activePersonaId,
  onSwitchPersona,
  onCreatePersona,
  onRenamePersona,
  onDeletePersona,
  sharedRequest,
  nearbyCount,
  trending,
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
  // Exit-animation flags — surface stays mounted for ~160ms after the
  // close handler fires so the fade-out keyframe can run (Toast pattern).
  const [importExportClosing, setImportExportClosing] = useState(false);
  const [listCreatorClosing, setListCreatorClosing] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [previewingEmote, setPreviewingEmote] = useState<string | null>(null);
  const [partnerFinderState, setPartnerFinderState] = useState<{
    emoteName: string;
    top: number;
  } | null>(null);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [showListCreator, setShowListCreator] = useState(false);
  // Tracks the most recently created list so the chip can play a one-shot
  // pulse — Family pattern: outcome belongs inline on the artifact, not in
  // a toast that hides what just happened.
  const [recentlyCreatedListId, setRecentlyCreatedListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newListIcon, setNewListIcon] = useState<string>(DEFAULT_LIST_ICON);
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

  // Staggered card entrance. `--entering` sits on the grid for ~850ms
  // after a trigger, so cards cascade in on menu-open and on category /
  // filter change, but never re-animate as they mount during scroll.
  const [gridEntering, setGridEntering] = useState(true);
  const gridEnterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerGridEntrance = useCallback(() => {
    setGridEntering(true);
    if (gridEnterTimerRef.current) clearTimeout(gridEnterTimerRef.current);
    gridEnterTimerRef.current = setTimeout(() => setGridEntering(false), 850);
  }, []);
  useEffect(() => {
    triggerGridEntrance();
    return () => {
      if (gridEnterTimerRef.current) clearTimeout(gridEnterTimerRef.current);
    };
  }, [triggerGridEntrance]);

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
      if ((e.target as HTMLElement).closest(".mbt-header__actions")) return;
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
    // Passive: the drag handlers never call preventDefault, so flag them
    // so CEF can fast-path them off the main-thread scroll/gesture chain.
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseup", handleMouseUp, { passive: true });
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

  // ── Place in world ──
  // Hands off to rpemotes-reborn's placement flow (preview ped + WASD positioning).
  // The Lua callback closes our menu before triggering placement so rpemotes can
  // own NUI focus while the player positions the ped.
  const handlePlace = useCallback(async (emote: Emote) => {
    await useNui("placeEmote", { name: emote.name });
  }, []);

  const { categories, features } = config;
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

  // Theme CSS vars are applied on :root by App (see utils/theme.ts) so
  // the menu, wheel and ambient overlays all share one accent.

  // ── Filter + sort pipeline ──
  // Search is deferred: a keystroke updates the <input> instantly while the
  // ~1800-item filter recomputes at lower priority, so typing never janks.
  const deferredSearch = useDeferredValue(search);
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

    // Category, prop/shared filter and search collapsed into one pass —
    // one array allocation instead of three.
    const q = deferredSearch.trim().toLowerCase();
    if (activeCategory || activeFilter !== "all" || q) {
      emotes = emotes.filter((e) => {
        if (activeCategory && e.category !== activeCategory) return false;
        if (activeFilter === "props" && !e.hasProp) return false;
        if (activeFilter === "shared" && !e.isShared) return false;
        if (
          q &&
          !e.name.toLowerCase().includes(q) &&
          !e.label.toLowerCase().includes(q) &&
          !(e.keywords && e.keywords.includes(q))
        ) {
          return false;
        }
        return true;
      });
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
    deferredSearch,
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
    // Card outer height = 66px .mbt-card__row + 1px top/bottom border
    // = 68px, plus the 6px .mbt-grid__virtual inter-card gap = 74. Same
    // in both shells — the v7 card component is shared and layout-agnostic.
    rowHeight: 74,
    columns: 1,
    overscan: 4,
  });

  // Stable merged ref for the grid element — feeds both gridRef (scroll
  // restore / focus scroll) and the virtual scroller's containerRef. An
  // inline arrow here would detach/reattach the ref on every render.
  const setGridRef = useCallback(
    (el: HTMLDivElement | null) => {
      (gridRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      (virtualRef as React.MutableRefObject<HTMLDivElement | null>).current =
        el;
    },
    // gridRef is a stable useRef; virtualRef is a stable ref from
    // useVirtualGrid — neither identity changes across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

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
  // The handler needs `filteredEmotes`, `focusedIndex`, `importExportMode`,
  // `handleClose` and `handleEmotePlay` — all of which change on every search
  // keystroke. We keep them in a ref (refreshed each render, below) so the
  // window listener can subscribe ONCE instead of tearing down/re-adding on
  // every keypress.
  const kbdRef = useRef({
    filteredEmotes,
    focusedIndex,
    importExportMode,
    handleClose,
    handleEmotePlay: (_e: Emote) => {},
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const {
        filteredEmotes,
        focusedIndex,
        importExportMode,
        handleClose,
        handleEmotePlay,
      } = kbdRef.current;
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
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    mbtDebug('Tab changed', { tab });
    const direction = TAB_ORDER[tab] >= TAB_ORDER[activeTab] ? 1 : -1;
    document.documentElement.style.setProperty('--vt-direction', String(direction));

    const apply = () => {
      setActiveTab(tab);
      setActiveCategory(null);
      setActiveFilter("all");
    };

    // View Transitions API gives us a directional snapshot animation
    // without any motion library or DOM wrapper. The live grid (and its
    // refs/scroll listener) is untouched — the browser captures before /
    // after frames and animates those instead. Graceful fallback to an
    // instant apply on browsers without VT support.
    const startVT = (document as { startViewTransition?: (cb: () => void) => unknown }).startViewTransition;
    if (typeof startVT === 'function') {
      startVT.call(document, apply);
    } else {
      apply();
    }
  }, [activeTab]);

  // Grid filter morph — replays an opacity fade keyframe on the virtual
  // container whenever any of these change, without re-mounting the grid
  // (which would break scroll position and virtual-list ref). The reflow
  // trick (remove class → force layout read → add class) is the standard
  // way to restart a CSS animation without unmount.
  const virtualContainerRef = useRef<HTMLDivElement | null>(null);
  // Search / sort replay the quick opacity morph; category / filter get
  // the staggered card cascade instead (triggerGridEntrance), so they are
  // intentionally excluded here to avoid double-animating.
  const filterKey = `${search}-${sortOrder}`;
  useEffect(() => {
    const el = virtualContainerRef.current;
    if (!el) return;
    el.classList.remove("mbt-grid__virtual--filter-changed");
    void el.offsetWidth; // force reflow so the animation can restart
    el.classList.add("mbt-grid__virtual--filter-changed");
  }, [filterKey]);

  // ── Import/Export ──
  const handleExportOpen = () => {
    setImportText(JSON.stringify(favorites, null, 2));
    setImportExportClosing(false);
    setImportExportMode("export");
    setImportError("");
  };
  const handleImportOpen = () => {
    setImportText("");
    setImportExportClosing(false);
    setImportExportMode("import");
    setImportError("");
  };
  // Play the exit animation, then unmount. ~160ms matches mbt-modal-out
  // (mirrors Toast.tsx's ToastItem dismiss pattern).
  const closeImportExport = useCallback(() => {
    setImportExportClosing(true);
    setTimeout(() => {
      setImportExportMode("hidden");
      setImportExportClosing(false);
    }, 160);
  }, []);
  const handleImportConfirm = () => {
    try {
      const data = JSON.parse(importText);
      if (typeof data !== "object" || Array.isArray(data) || data === null) {
        setImportError("Formato non valido: deve essere un oggetto JSON");
        return;
      }
      onImportFavorites(data);
      closeImportExport();
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
    (emote: Emote, element?: HTMLElement | null) => {
      if (isEmoteLocked(emote.name)) {
        onToast(t.toast_emote_restricted || 'Emote restricted to specific jobs', "error", 2000);
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

  // Refresh the keydown handler's live values each render — the window
  // listener (subscribed once, above) reads exclusively from this ref.
  kbdRef.current = {
    filteredEmotes,
    focusedIndex,
    importExportMode,
    handleClose,
    handleEmotePlay,
  };

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

  // Favorites reorder via react-dnd (TouchBackend / pointer events). The
  // FavoriteDraggable wrapper calls back into handleReorderByIndex with the
  // source + target indices in the current filteredEmotes slice; we then
  // translate those to favOrder positions (the persisted ordering) and emit
  // a new array upward. CEF's HTML5 native drag is bypassed entirely — this
  // mirrors ox_inventory's working approach.
  const handleReorderByIndex = useCallback(
    (fromIdx: number, toIdx: number) => {
      if (activeTab !== "favorites") return;
      if (fromIdx === toIdx) return;
      const newOrder = [...favOrder];
      const visibleNames = filteredEmotes.map((e) => e.name);
      const fromName = visibleNames[fromIdx];
      const toName = visibleNames[toIdx];
      if (!fromName || !toName) return;
      const fromOrderIdx = newOrder.indexOf(fromName);
      const toOrderIdx = newOrder.indexOf(toName);
      if (fromOrderIdx < 0 || toOrderIdx < 0) return;
      newOrder.splice(fromOrderIdx, 1);
      const insertAt = newOrder.indexOf(toName);
      newOrder.splice(
        insertAt >= 0 ? (fromIdx < toIdx ? insertAt + 1 : insertAt) : toOrderIdx,
        0,
        fromName,
      );
      onReorderFavorites(newOrder);
    },
    [activeTab, favOrder, filteredEmotes, onReorderFavorites],
  );

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
      onToast(tFormat(t.toast_wheel_assigned || 'Assigned %s to NUM%s', emote.label, slot + 1), "success");

      // 5. Cleanup particle after anim
      setTimeout(() => {
        setFlyingItems((prev) => prev.filter((item) => item.id !== id));
      }, 800);
    },
    [keybinds, onKeybindsUpdate, onToast],
  );

  // Custom list handlers
  // Play the exit animation, then unmount. ~160ms matches mbt-modal-out.
  const closeListCreator = useCallback(() => {
    setListCreatorClosing(true);
    setTimeout(() => {
      setShowListCreator(false);
      setListCreatorClosing(false);
    }, 160);
  }, []);

  const handleCreateList = useCallback(() => {
    if (!newListName.trim()) return;
    const list: CustomList = {
      id: Date.now().toString(36),
      name: newListName.trim(),
      icon: newListIcon,
      emotes: [],
    };
    onSaveCustomLists([...customLists, list]);
    setNewListName("");
    setNewListIcon(DEFAULT_LIST_ICON);
    closeListCreator();
    setActiveListId(list.id);
    setActiveTab("list");
    // Inline outcome instead of a toast: the new chip pulses for a beat
    // (CSS keyframe via .mbt-tab--just-created), and we auto-switch to
    // its tab so the next thing the user sees is their list ready.
    setRecentlyCreatedListId(list.id);
    window.setTimeout(() => setRecentlyCreatedListId(null), 1500);
  }, [newListName, newListIcon, customLists, onSaveCustomLists, closeListCreator]);

  const handleDeleteList = useCallback(
    (listId: string) => {
      const list = customLists.find((l) => l.id === listId);
      onSaveCustomLists(customLists.filter((l) => l.id !== listId));
      if (activeListId === listId) {
        setActiveListId(null);
        setActiveTab("all");
      }
      if (list) onToast(tFormat(t.toast_list_deleted || 'List "%s" deleted', list.name), "warning");
    },
    [customLists, activeListId, onSaveCustomLists, onToast],
  );

  const handleAddToList = useCallback(
    (listId: string, emoteName: string) => {
      const list = customLists.find((l) => l.id === listId);
      if (list && list.emotes.includes(emoteName)) {
        onToast(tFormat(t.toast_list_already_in || 'Already in "%s"', list.name), "warning", 1500);
        return;
      }
      onSaveCustomLists(
        customLists.map((l) => {
          if (l.id !== listId) return l;
          return { ...l, emotes: [...l.emotes, emoteName] };
        }),
      );
      if (list) onToast(tFormat(t.toast_list_added || 'Added to "%s"', list.name), "success", 1500);
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
        {/* ── Grip handle ── (standard floating panel only — the
            cinematic shell is edge-docked and not draggable) */}
        {config.layout !== "cinematic" && <div className="mbt-grip" />}

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
          <div className="mbt-header__actions">
            <button
              className="mbt-header__new"
              onClick={() => {
                setListCreatorClosing(false);
                setShowListCreator(true);
              }}
              title={t.tooltip_new_list || "New custom list"}
            >
              <Plus size={14} />
            </button>
            <button
              className="mbt-header__stop"
              onClick={onCancel}
              title={t.tooltip_stop_animation || "Stop animation"}
            >
              <Square size={12} fill="currentColor" />
            </button>
            {features.PhotoMode && (
              <button
                className="mbt-header__photo"
                onClick={() => useNui("enterPhotoMode")}
                title={t.tooltip_photo_mode || "Photo Mode"}
              >
                <Camera size={14} />
              </button>
            )}
            {features.Favorites && (
              <HeaderMenu
                onExport={handleExportOpen}
                onImport={handleImportOpen}
              />
            )}
            <button className="mbt-header__close" onClick={handleClose}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Search ── */}
        <SearchBar
          value={search}
          onChange={setSearch}
          resultCount={filteredEmotes.length}
          totalCount={catalog.length}
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
              <AnimatedNumber value={recent.length} className="mbt-tab__count" />
            </button>
          )}

          <button
            className={`mbt-tab ${activeTab === "top" ? "mbt-tab--active" : ""}`}
            onClick={() => handleTabChange("top")}
          >
            <Trophy size={13} />
            <span>{t.tab_top || 'Top'}</span>
            <span className="mbt-tab__count">
              {Object.keys(playCounts).length}
            </span>
          </button>

          {/* Custom Lists integrated directly into the core grid */}
          {customLists.map((list) => {
            const ListIcon = listIconFor(list.icon);
            return (
              <button
                key={list.id}
                className={`mbt-tab ${activeTab === "list" && activeListId === list.id ? "mbt-tab--active" : ""} ${recentlyCreatedListId === list.id ? "mbt-tab--just-created" : ""}`}
                onClick={() => {
                  setActiveListId(list.id);
                  setActiveTab("list");
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleDeleteList(list.id);
                }}
                title={t.tooltip_list_delete || 'Right-click to delete'}
              >
                <ListIcon size={13} />
                <span>{list.name}</span>
                <span className="mbt-tab__count">{list.emotes.length}</span>
              </button>
            );
          })}
        </div>

        {/* ── Nearby section (only while browsing All tab) ── */}
        {activeTab === "all" && nearbyCount > 0 && (
          <NearbySection
            nearbyCount={nearbyCount}
            catalog={catalog}
            playCounts={playCounts}
            layout={config?.layout}
            onPlay={handleEmotePlay}
            onShowMore={() => setActiveCategory("Shared")}
          />
        )}

        {/* ── Category Pills ── */}
        {activeTab === "all" && (
          <div className="mbt-categories">
            <button
              className={`mbt-pill ${!activeCategory ? "mbt-pill--active" : ""}`}
              style={{ "--mbt-pill-cat": "154, 160, 166", "--i": 0 } as React.CSSProperties}
              onClick={() => { setActiveCategory(null); triggerGridEntrance(); }}
            >
              <span className="mbt-pill__label">{t.tab_all || "All"}</span>
              <span className="mbt-pill__count">{catalog.length}</span>
            </button>
            {visibleCategories.map((cat, index) => (
              <button
                key={cat.type}
                className={`mbt-pill ${activeCategory === cat.type ? "mbt-pill--active" : ""}`}
                style={{ "--mbt-pill-cat": pillCatVar(cat.type), "--i": index + 1 } as React.CSSProperties}
                onClick={() => { setActiveCategory(cat.type); triggerGridEntrance(); }}
              >
                <span className="mbt-pill__label">
                  {categoryShortLabel(cat.type, cat.label)}
                </span>
                {categoryCounts[cat.type] != null && (
                  <span className="mbt-pill__count">
                    {categoryCounts[cat.type]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Result Bar + Sort & Filter popover ── */}
        <ResultBar
          resultCount={filteredEmotes.length}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          activeFilter={activeFilter}
          onFilterChange={(f) => { setActiveFilter(f); triggerGridEntrance(); }}
          onRandom={handleRandomPlay}
          randomDisabled={filteredEmotes.length === 0}
        />

        {/* ── Emote Grid ── */}
        {/* Active Walk/Expression Banner */}
        {activeCategory === "Walks" && (
          <div className="mbt-active-banner">
            <span className="mbt-active-banner__label">{t.banner_walk_active || 'Active walk:'}</span>
            <span className="mbt-active-banner__value">
              {activeWalk || (t.banner_default || 'Default')}
            </span>
            {activeWalk && (
              <button
                className="mbt-active-banner__reset"
                onClick={() => {
                  onResetWalkstyle();
                  onToast(t.toast_walk_reset || 'Walk style reset', "info");
                }}
              >
                {t.btn_reset || 'Reset'}
              </button>
            )}
          </div>
        )}
        {activeCategory === "Expressions" && (
          <div className="mbt-active-banner">
            <span className="mbt-active-banner__label">{t.banner_expression_active || 'Active expression:'}</span>
            <span className="mbt-active-banner__value">
              {activeExpression || (t.banner_default || 'Default')}
            </span>
            {activeExpression && (
              <button
                className="mbt-active-banner__reset"
                onClick={() => {
                  onResetExpression();
                  onToast(t.toast_expression_reset || 'Expression reset', "info");
                }}
              >
                {t.btn_reset || 'Reset'}
              </button>
            )}
          </div>
        )}

        {/* ── Trending Hero ── (clean browse view only). Rendered as a
            normal element ABOVE the grid — never inside .mbt-grid__virtual,
            since useVirtualGrid assumes a uniform rowHeight and the hero is
            taller. */}
        {activeTab === "all" &&
          !activeCategory &&
          !search &&
          activeFilter === "all" &&
          trending && (
            <TrendingHero trending={trending} onPlay={handleEmotePlay} />
          )}

        {/* `mbt-grid-content` view-transition-name lets the directional
            tab slide (via View Transitions API in handleTabChange) capture
            this whole subtree as a single snapshot — empty state OR grid —
            so both transition out together. */}
        {filteredEmotes.length === 0 ? (
          <div className="mbt-grid--empty" style={{ viewTransitionName: "mbt-grid-content" } as React.CSSProperties}>
            <EmptyState
              icon={SearchX}
              title={t.no_emotes_found || "No emotes found"}
              hint={t.no_emotes_hint || "Try a different search or clear the filters"}
              arrowDirection="up"
              arrowLabel={t.no_emotes_arrow || "Search above"}
            />
          </div>
        ) : (
          <div
            className={`mbt-grid${gridEntering ? " mbt-grid--entering" : ""}`}
            style={{ viewTransitionName: "mbt-grid-content" } as React.CSSProperties}
            ref={setGridRef}
          >
            {/* Spacer: total scrollable height */}
            <div
              style={{
                gridColumn: "1 / -1",
                height: totalHeight,
                pointerEvents: "none",
              }}
            />
            {/* Visible slice, positioned via transform. The ref lets the
                filter-morph effect toggle a class for the in-place fade
                without re-mounting any virtual content. */}
            <div
              className="mbt-grid__virtual"
              ref={virtualContainerRef}
              style={{ transform: `translateY(${offsetY - totalHeight}px)` }}
            >
              {filteredEmotes.slice(startIndex, endIndex).map((emote, i) => {
                const idx = startIndex + i;
                return (
                  <FavoriteDraggable
                    key={`${emote.category}-${emote.name}`}
                    emote={emote}
                    idx={idx}
                    enabled={activeTab === "favorites"}
                    onReorder={handleReorderByIndex}
                    className="mbt-card-wrap"
                    style={{ "--i": i } as React.CSSProperties}
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
                      onPlay={handleEmotePlay}
                      onToggleFavorite={onToggleFavorite}
                      onPreviewToggle={
                        features.PreviewPed ? handlePreviewToggle : undefined
                      }
                      onAddToPlaylist={onAddToPlaylist}
                      placementEnabled={!!features.EmotePlacement}
                      onPlace={handlePlace}
                      onBindClick={handleBindClick}
                      wheelSlots={wheelSlots}
                      wheelMaxSlots={wheelMaxSlots}
                      onSetWheelSlot={onSetWheelSlot}
                      customLists={customLists}
                      onAddToList={handleAddToList}
                      onRemoveFromList={handleRemoveFromList}
                    />
                  </FavoriteDraggable>
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
            personas={config.features.Personas ? personas : undefined}
            activePersonaId={activePersonaId}
            onSwitchPersona={onSwitchPersona}
            onCreatePersona={onCreatePersona}
            onRenamePersona={onRenamePersona}
            onDeletePersona={onDeletePersona}
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
            className={`mbt-modal-overlay ${listCreatorClosing ? "mbt-modal-overlay--closing" : ""}`}
            onClick={closeListCreator}
          >
            <div
              className="mbt-modal mbt-modal--small"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mbt-modal__header">
                <span className="mbt-modal__title">{t.modal_new_list || 'New List'}</span>
                <button
                  className="mbt-modal__btn-close"
                  onClick={closeListCreator}
                  title={t.btn_cancel || 'Cancel'}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="mbt-list-creator">
                <input
                  className="mbt-list-creator__input"
                  type="text"
                  placeholder={t.modal_list_name_placeholder || 'List name...'}
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
                  autoFocus
                />
                <span className="mbt-list-creator__label">
                  {t.modal_list_icon_label || 'Icon'}
                </span>
                <div className="mbt-list-creator__icons">
                  {LIST_ICON_KEYS.map((key) => {
                    const Icon = LIST_ICONS[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`mbt-list-creator__icon ${newListIcon === key ? "mbt-list-creator__icon--active" : ""}`}
                        onClick={() => setNewListIcon(key)}
                        title={key}
                      >
                        <Icon size={15} />
                      </button>
                    );
                  })}
                </div>
                <button
                  className="mbt-modal__btn mbt-modal__btn--confirm"
                  onClick={handleCreateList}
                  disabled={!newListName.trim()}
                >
                  {t.btn_create || 'Create'}
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

        {/* ── Import/Export Modal ── */}
        {importExportMode !== "hidden" && (
          <div className={`mbt-modal-overlay ${importExportClosing ? "mbt-modal-overlay--closing" : ""}`}>
            <div className="mbt-modal">
              <div className="mbt-modal__header">
                <span className="mbt-modal__title">
                  {importExportMode === "export"
                    ? `↑ ${t.modal_export_title || 'Export Favorites'}`
                    : `↓ ${t.modal_import_title || 'Import Favorites'}`}
                </span>
                <button
                  className="mbt-header__close"
                  onClick={closeImportExport}
                >
                  <X size={14} />
                </button>
              </div>
              <p className="mbt-modal__desc">
                {importExportMode === "export"
                  ? (t.modal_export_desc || 'Copy the JSON below to save your favorites.')
                  : (t.modal_import_desc || 'Paste a previously exported favorites JSON.')}
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
                  importExportMode === "import"
                    ? (t.modal_import_placeholder || 'Paste JSON here...')
                    : ""
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
                  onClick={closeImportExport}
                >
                  {t.btn_cancel || 'Cancel'}
                </button>
                {importExportMode === "import" ? (
                  <button
                    className="mbt-modal__btn mbt-modal__btn--confirm"
                    onClick={handleImportConfirm}
                  >
                    {t.btn_import || 'Import'}
                  </button>
                ) : (
                  <button
                    className="mbt-modal__btn mbt-modal__btn--confirm"
                    onClick={closeImportExport}
                  >
                    {t.btn_done || 'Done'}
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

// Category → RGB triplet for the rail-pill colour dot. Triplets (not hex/var)
// so the CSS can feed them to CEF-safe rgb()/rgba() — FiveM's CEF lacks
// color-mix(). Slug derived the same way EmoteCard builds its
// `mbt-card--cat-*` class, so both stay in sync.
const CATEGORY_COLOR_VAR: Record<string, string> = {
  emotes: "34, 211, 238",
  propemotes: "245, 190, 74",
  props: "245, 190, 74",
  dances: "236, 72, 153",
  shared: "251, 113, 88",
  expressions: "168, 139, 250",
  walks: "94, 234, 212",
  "walk-styles": "94, 234, 212",
  animalemotes: "251, 146, 60",
  animals: "251, 146, 60",
  emojis: "250, 224, 72",
};
function pillCatVar(type: string): string {
  const slug = type.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return CATEGORY_COLOR_VAR[slug] || "154, 160, 166";
}

// The category rail is a tidy 3-column grid; long config labels
// ("Expressions", "Walk Styles") blow out a cell. Show short forms for
// those; every other category uses its config label unchanged.
const CATEGORY_SHORT_LABEL: Record<string, string> = {
  Expressions: "Expr.",
  Walks: "Walks",
};
function categoryShortLabel(type: string, label: string): string {
  return CATEGORY_SHORT_LABEL[type] || label;
}
