import { useState, useRef, useEffect, useCallback } from "react";
import { SlidersHorizontal, Check, Shuffle } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";
import { useLocale } from "../utils/locale";

type Filter = "all" | "props" | "shared";
type SortOrder = "az" | "za" | "cat";

interface ResultBarProps {
  resultCount: number;
  sortOrder: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  activeFilter: Filter;
  onFilterChange: (filter: Filter) => void;
  onRandom: () => void;
  randomDisabled: boolean;
}

/**
 * Phase 3 — thin result bar that replaces the old `.mbt-filters` row.
 * Left: live result count (AnimatedNumber) + "emotes". Right: a tools
 * cluster — a standalone Random icon-button + a "Sort & filter" button
 * opening an opaque popover (mockup `.sortpop`) that hosts the
 * single-select Sort-by + Filter rows. State models are unchanged.
 */
export function ResultBar({
  resultCount,
  sortOrder,
  onSortChange,
  activeFilter,
  onFilterChange,
  onRandom,
  randomDisabled,
}: ResultBarProps) {
  const t = useLocale();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Click-outside closes the popover (mockup JS pattern).
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const sortOptions: Array<{ key: SortOrder; label: string }> = [
    { key: "az", label: t.sort_az || "A to Z" },
    { key: "za", label: t.sort_za || "Z to A" },
    { key: "cat", label: t.sort_cat || "Category" },
  ];
  const filterOptions: Array<{ key: Filter; label: string }> = [
    { key: "all", label: t.filter_all || "All" },
    { key: "props", label: t.filter_props || "With props" },
    { key: "shared", label: t.filter_shared || "Shared" },
  ];

  const handleRandom = useCallback(() => {
    if (randomDisabled) return;
    onRandom();
  }, [onRandom, randomDisabled]);

  return (
    <div className="mbt-resultbar" ref={wrapRef}>
      <span className="mbt-resultbar__count">
        <AnimatedNumber value={resultCount} className="mbt-resultbar__num" />{" "}
        {t.resultbar_emotes || "emotes"}
      </span>

      <div className="mbt-resultbar__tools">
        <button
          className="mbt-randbtn"
          onClick={handleRandom}
          disabled={randomDisabled}
          title={t.btn_random || "Random emote"}
          aria-label={t.btn_random || "Random emote"}
        >
          <Shuffle size={14} />
        </button>

        <button
          className={`mbt-sortbtn ${open ? "mbt-sortbtn--open" : ""}`}
          onClick={() => setOpen((v) => !v)}
          title={t.tooltip_sort_filter || "Sort & filter"}
        >
          <SlidersHorizontal size={13} />
          <span>{t.btn_sort_filter || "Sort & filter"}</span>
        </button>
      </div>

      {open && (
        <div className="mbt-sortpop">
          <div className="mbt-sortpop__head">{t.sortpop_sort_by || "Sort by"}</div>
          {sortOptions.map((o) => (
            <button
              key={o.key}
              className={`mbt-sortpop__item ${sortOrder === o.key ? "mbt-sortpop__item--active" : ""}`}
              onClick={() => onSortChange(o.key)}
            >
              <span>{o.label}</span>
              <Check size={14} />
            </button>
          ))}

          <div className="mbt-sortpop__div" />

          <div className="mbt-sortpop__head">{t.sortpop_filter || "Filter"}</div>
          {filterOptions.map((o) => (
            <button
              key={o.key}
              className={`mbt-sortpop__item ${activeFilter === o.key ? "mbt-sortpop__item--active" : ""}`}
              onClick={() => onFilterChange(o.key)}
            >
              <span>{o.label}</span>
              <Check size={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
