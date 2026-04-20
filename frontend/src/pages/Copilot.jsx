import { useCallback, useEffect, useState } from "react";
import { pineappleApi } from "../lib/api";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function PriorityPill({ priority }) {
  const styles = {
    critical: "bg-red-500/15 text-red-300",
    high: "bg-yellow-500/15 text-yellow-300",
    medium: "bg-blue-500/15 text-blue-300",
    low: "bg-zinc-500/15 text-zinc-300",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[priority] || styles.low}`}>{priority}</span>;
}

export default function Copilot() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await pineappleApi.overview();
      setOverview(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) {
    return <div className="flex items-center gap-2 text-zinc-500 py-20 justify-center"><Loader2 size={18} className="animate-spin" /> Loading copilot...</div>;
  }

  const tasks = overview?.task_lifecycle || [];
  const queue = overview?.pineapple_queue?.items || [];

  const updateTask = async (taskId, status) => {
    try {
      await pineappleApi.updateTask(taskId, { status });
      toast.success(`Task marked ${status}`);
      await load();
    } catch {
      toast.error("Failed to update task");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Pineapple Copilot</h1>
        <p className="text-sm text-zinc-500 mt-1">Visible intelligence surface from runtime truth, ingestion, and approvals.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="module-card">
          <h2 className="text-sm font-medium text-zinc-300 uppercase tracking-wider mb-3">Top generated actions</h2>
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.task_id} className="rounded border border-zinc-800 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-zinc-100">{task.action}</div>
                  <PriorityPill priority={task.priority} />
                </div>
                <div className="text-zinc-500 mt-1">{task.reason}</div>
                <div className="text-zinc-400 mt-2">Impact: {task.expected_outcome} · Confidence: {Math.round((task.confidence || 0) * 100)}% · Status: {task.status}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-700" onClick={() => updateTask(task.task_id, "in_progress")}>Execute</button>
                  <button className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-700" onClick={() => updateTask(task.task_id, "done")}>Done</button>
                  <button className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-700" onClick={() => updateTask(task.task_id, "deferred")}>Snooze</button>
                  <button className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-700" onClick={() => updateTask(task.task_id, "ignored")}>Ignore</button>
                </div>
              </div>
            ))}
            {!tasks.length && <div className="text-zinc-500 text-sm">No generated actions yet.</div>}
          </div>
        </div>

        <div className="module-card">
          <h2 className="text-sm font-medium text-zinc-300 uppercase tracking-wider mb-3">Execution queue</h2>
          <div className="space-y-3">
            {queue.map((item) => (
              <div key={item.id} className="rounded border border-zinc-800 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-zinc-100">{item.title}</div>
                  <PriorityPill priority={item.priority} />
                </div>
                <div className="text-zinc-500 mt-1">{item.reason}</div>
                <div className="text-zinc-400 mt-2">Status: {item.status} · Outcome: {item.expected_outcome}</div>
              </div>
            ))}
            {!queue.length && <div className="text-zinc-500 text-sm">Queue not loaded.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
