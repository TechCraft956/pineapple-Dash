/**
 * GlobalSearch - Unified search across all entity types
 * Appears in the sidebar, searches across tasks, deals, knowledge, build queue, infrastructure, commands
 */

import { useState, useRef, useEffect } from "react";
import { searchApi } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { Search, X, Loader2, CheckSquare, Handshake, BookOpen, Layers, Server, Terminal } from "lucide-react";

const TYPE_META = {
  tasks: { icon: CheckSquare, color: "text-blue-400", route: "/tasks" },
  deals: { icon: Handshake, color: "text-emerald-400", route: "/deals" },
  knowledge: { icon: BookOpen, color: "text-purple-400", route: "/vault" },
  build_queue: { icon: Layers, color: "text-yellow-400", route: "/build-queue" },
  infrastructure: { icon: Server, color: "text-cyan-400", route: "/infrastructure" },
  commands: { icon: Terminal, color: "text-zinc-400", route: "/" },
};

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await searchApi.search(query);
        setResults(res.data.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [query]);

  const handleSelect = (result) => {
    const meta = TYPE_META[result.type];
    if (meta) navigate(meta.route);
    setOpen(false);
    setQuery("");
  };

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-500 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors"
        data-testid="global-search-trigger"
      >
        <Search size={13} />
        <span className="flex-1 text-left">Search everything...</span>
        <kbd className="text-[10px] bg-zinc-800 px-1.5 py-0.5 text-zinc-600">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" data-testid="global-search-overlay">
      <div className="fixed inset-0 bg-black/70" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 shadow-2xl z-10">
        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
          <Search size={16} className="text-zinc-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, deals, knowledge, infrastructure..."
            className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            data-testid="global-search-input"
          />
          {loading && <Loader2 size={14} className="animate-spin text-zinc-500" />}
          <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto" data-testid="global-search-results">
          {query && !loading && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">No results found</div>
          )}
          {results.map((r) => {
            const meta = TYPE_META[r.type] || TYPE_META.commands;
            const Icon = meta.icon;
            return (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-900/80 transition-colors border-b border-zinc-800/50"
                data-testid={`search-result-${r.id}`}
              >
                <Icon size={15} className={meta.color} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{r.title}</p>
                  <p className="text-[11px] text-zinc-500">{r.type.replace("_", " ")} {r.subtitle && `· ${r.subtitle}`}</p>
                </div>
                {r.priority && <span className={`priority-dot priority-${r.priority}`} />}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-zinc-800 text-[10px] text-zinc-600 flex justify-between">
          <span>↑↓ Navigate · ↵ Open · Esc Close</span>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  );
}
