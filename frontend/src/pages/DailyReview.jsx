/**
 * Daily Review - Timeline view for today's activity with reflections
 * Shows chronological entries, summary counts, and reflection textarea.
 */

import { useState, useEffect, useCallback } from "react";
import { dailyReviewApi } from "../lib/api";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Save, Clock, CheckSquare, Handshake, BookOpen, Layers, Terminal } from "lucide-react";

const MODULE_ICONS = {
  commands: Terminal,
  tasks: CheckSquare,
  deals: Handshake,
  knowledge: BookOpen,
  build_queue: Layers,
};

const MODULE_COLORS = {
  commands: "text-zinc-400",
  tasks: "text-blue-400",
  deals: "text-emerald-400",
  knowledge: "text-purple-400",
  build_queue: "text-yellow-400",
};

export default function DailyReview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nextActions, setNextActions] = useState("");
  const [reflections, setReflections] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await dailyReviewApi.get();
      setData(res.data);
      setNextActions(res.data.next_actions || "");
      setReflections(res.data.reflections || "");
    } catch (err) {
      console.error("Failed to load daily review:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await dailyReviewApi.save({ next_actions: nextActions, reflections });
      toast.success("Review saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-500 py-20 justify-center" data-testid="review-loading">
        <Loader2 size={18} className="animate-spin" /> Loading review...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-zinc-500 text-center py-20" data-testid="review-error">Failed to load review.</div>
    );
  }

  const totalEntries = Object.values(data.summary).reduce((a, b) => a + b, 0);

  return (
    <div className="animate-fade-in" data-testid="daily-review-page">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight" data-testid="review-title">Daily Review</h1>
        <p className="text-sm text-zinc-500 mt-1">{data.date} &middot; {totalEntries} entries today</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6" data-testid="review-summary">
        {Object.entries(data.summary).map(([module, count]) => {
          const Icon = MODULE_ICONS[module] || Terminal;
          return (
            <div key={module} className="module-card text-center" data-testid={`summary-${module}`}>
              <Icon size={16} className={`mx-auto mb-1 ${MODULE_COLORS[module] || "text-zinc-500"}`} />
              <p className="text-lg font-semibold text-zinc-100">{count}</p>
              <p className="text-[11px] text-zinc-500 capitalize">{module.replace("_", " ")}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline */}
        <div className="module-card" data-testid="review-timeline">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} className="text-zinc-500" />
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Today's Timeline</h2>
          </div>

          {data.activities.length === 0 ? (
            <p className="text-sm text-zinc-500" data-testid="timeline-empty">No activity recorded today.</p>
          ) : (
            <div className="relative" data-testid="timeline-entries">
              {/* Vertical line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-800" />

              <div className="space-y-3">
                {data.activities.map((a, i) => (
                  <div key={a.id || i} className="flex items-start gap-3 relative" data-testid={`timeline-item-${i}`}>
                    <div className="w-[15px] h-[15px] rounded-full bg-zinc-800 border-2 border-zinc-700 shrink-0 mt-0.5 z-10" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300">
                        <span className="text-zinc-500 capitalize">{a.action}</span>{" "}
                        in <span className="text-zinc-400">{a.module}</span>
                      </p>
                      <p className="text-xs text-zinc-500 truncate">{a.title}</p>
                      <p className="text-[11px] text-zinc-600 font-mono mt-0.5">{formatTime(a.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Reflections */}
        <div className="space-y-4">
          <div className="module-card" data-testid="review-next-actions">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Next Actions</h2>
            <Textarea
              data-testid="next-actions-input"
              value={nextActions}
              onChange={(e) => setNextActions(e.target.value)}
              placeholder="What needs to happen next?"
              className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 min-h-[100px]"
              rows={4}
            />
          </div>

          <div className="module-card" data-testid="review-reflections">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Reflections</h2>
            <Textarea
              data-testid="reflections-input"
              value={reflections}
              onChange={(e) => setReflections(e.target.value)}
              placeholder="What went well? What could improve?"
              className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 min-h-[100px]"
              rows={4}
            />
          </div>

          <Button
            data-testid="save-review-btn"
            onClick={handleSave}
            disabled={saving}
            className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-xs font-medium h-8 w-full"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span className="ml-1.5">Save Review</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
