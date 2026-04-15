/**
 * Command Center - Universal Intake Layer for Pineapple OS
 * Main entry point for all data. Supports creating:
 * task, deal, note, idea, trade, system, build item, infrastructure record.
 * Can optionally route entries to their target modules.
 */

import { useState, useEffect, useCallback } from "react";
import { commandsApi, seedApi } from "../lib/api";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";
import { Send, Trash2, Tag, Loader2, ArrowRight, Zap } from "lucide-react";

const ENTRY_TYPES = [
  { value: "task", label: "Task", routable: true },
  { value: "deal", label: "Deal", routable: true },
  { value: "note", label: "Note", routable: false },
  { value: "idea", label: "Idea", routable: false },
  { value: "trade", label: "Trade", routable: false },
  { value: "system", label: "System", routable: false },
  { value: "build", label: "Build Item", routable: true },
  { value: "infrastructure", label: "Infrastructure", routable: true },
];

const ENTRY_TYPE_COLORS = {
  task: "entry-type-task",
  deal: "entry-type-deal",
  note: "entry-type-note",
  idea: "entry-type-idea",
  trade: "entry-type-trade",
  system: "entry-type-system",
  build: "entry-type-build",
  infrastructure: "entry-type-infra",
};

const PRIORITIES = ["low", "medium", "high", "critical"];

export default function CommandCenter() {
  const [content, setContent] = useState("");
  const [entryType, setEntryType] = useState("note");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState([]);
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [routeToEntity, setRouteToEntity] = useState(false);
  const [entityPriority, setEntityPriority] = useState("medium");

  const currentType = ENTRY_TYPES.find((t) => t.value === entryType);
  const canRoute = currentType?.routable || false;

  const loadCommands = useCallback(async () => {
    try {
      const res = await commandsApi.list({ limit: 30 });
      setCommands(res.data);
    } catch (err) {
      console.error("Failed to load commands:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Seed data on first load if empty
  const checkAndSeed = useCallback(async () => {
    try {
      const res = await commandsApi.list({ limit: 1 });
      if (res.data.length === 0 && !seeded) {
        await seedApi.seed();
        setSeeded(true);
        toast.success("Welcome! Sample data loaded.");
        loadCommands();
      }
    } catch {
      // Silently fail
    }
  }, [seeded, loadCommands]);

  useEffect(() => {
    loadCommands();
    checkAndSeed();
  }, [loadCommands, checkAndSeed]);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        content: content.trim(),
        entry_type: entryType,
        tags,
        route_to_entity: canRoute && routeToEntity,
      };
      if (canRoute && routeToEntity) {
        payload.entity_data = { priority: entityPriority };
      }
      await commandsApi.create(payload);
      setContent("");
      setTags([]);
      setTagInput("");
      const msg = canRoute && routeToEntity
        ? `Entry saved & routed to ${entryType}`
        : "Entry saved";
      toast.success(msg);
      loadCommands();
    } catch (err) {
      toast.error("Failed to save entry");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase().replace(/^#/, "");
      if (tag && !tags.includes(tag)) {
        setTags([...tags, tag]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tag) => setTags(tags.filter((t) => t !== tag));

  const deleteCommand = async (id) => {
    try {
      await commandsApi.remove(id);
      toast.success("Entry deleted");
      loadCommands();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="animate-fade-in" data-testid="command-center-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight" data-testid="command-center-title">
          Command Center
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Universal intake. Capture anything, route to modules.
        </p>
      </div>

      {/* Input area */}
      <div className="command-input-area mb-6" data-testid="command-input-area">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-yellow-500 text-sm font-mono">&gt;</span>
          <Select value={entryType} onValueChange={(v) => { setEntryType(v); if (!ENTRY_TYPES.find(t => t.value === v)?.routable) setRouteToEntity(false); }}>
            <SelectTrigger
              className="w-36 h-8 bg-transparent border-zinc-700 text-xs text-zinc-300"
              data-testid="entry-type-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              {ENTRY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} data-testid={`entry-type-${t.value}`}>
                  <div className="flex items-center gap-2">
                    {t.label}
                    {t.routable && <ArrowRight size={10} className="text-zinc-600" />}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Route toggle */}
          {canRoute && (
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-[11px] text-zinc-500 flex items-center gap-1.5 cursor-pointer">
                <Zap size={12} className={routeToEntity ? "text-yellow-500" : "text-zinc-600"} />
                Route to module
              </label>
              <Switch
                checked={routeToEntity}
                onCheckedChange={setRouteToEntity}
                className="data-[state=checked]:bg-yellow-500"
                data-testid="route-toggle"
              />
            </div>
          )}
        </div>

        <Textarea
          data-testid="command-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's on your mind? (Ctrl+Enter to save)"
          className="bg-transparent border-0 text-zinc-100 text-sm resize-none focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[80px] p-0 placeholder:text-zinc-600"
          rows={3}
        />

        {/* Routing options */}
        {canRoute && routeToEntity && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-zinc-800/30">
            <span className="text-[11px] text-zinc-600">Priority:</span>
            <Select value={entityPriority} onValueChange={setEntityPriority}>
              <SelectTrigger className="w-24 h-7 bg-transparent border-zinc-700 text-[11px] text-zinc-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[10px] text-zinc-600 ml-auto">
              Will create in {entryType === "build" ? "Build Queue" : entryType === "infrastructure" ? "Infrastructure" : entryType === "task" ? "Tasks" : "Deals"}
            </span>
          </div>
        )}

        {/* Tags */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800/50">
          <Tag size={14} className="text-zinc-500" />
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-zinc-800 text-zinc-300 text-[11px] px-2 py-0 cursor-pointer hover:bg-zinc-700"
                onClick={() => removeTag(tag)}
                data-testid={`tag-${tag}`}
              >
                #{tag} ×
              </Badge>
            ))}
            <input
              data-testid="tag-input"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Add tag..."
              className="bg-transparent text-xs text-zinc-400 outline-none w-24 placeholder:text-zinc-600"
            />
          </div>
          <Button
            data-testid="command-submit-btn"
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-xs font-medium px-4 h-8"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            <span className="ml-1.5">{canRoute && routeToEntity ? "Save & Route" : "Save"}</span>
          </Button>
        </div>
      </div>

      {/* Recent entries */}
      <div data-testid="recent-commands">
        <h2 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">
          Recent Entries
        </h2>

        {loading ? (
          <div className="flex items-center gap-2 text-zinc-500 text-sm" data-testid="commands-loading">
            <Loader2 size={16} className="animate-spin" />
            Loading...
          </div>
        ) : commands.length === 0 ? (
          <div className="text-sm text-zinc-500 py-8 text-center" data-testid="commands-empty">
            No entries yet. Start typing above.
          </div>
        ) : (
          <div className="space-y-2">
            {commands.map((cmd) => (
              <div
                key={cmd.id}
                className="module-card flex items-start gap-3 group"
                data-testid={`command-entry-${cmd.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`entry-type-tag ${ENTRY_TYPE_COLORS[cmd.entry_type] || "entry-type-note"}`}>
                      {cmd.entry_type}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {formatTime(cmd.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{cmd.content}</p>
                  {cmd.tags?.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {cmd.tags.map((tag) => (
                        <span key={tag} className="text-[11px] text-zinc-500">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  data-testid={`delete-command-${cmd.id}`}
                  onClick={() => deleteCommand(cmd.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
