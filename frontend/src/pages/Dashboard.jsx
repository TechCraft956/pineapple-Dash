/**
 * Dashboard - Control room overview for Pineapple OS
 * Shows summary cards, activity feed, priority items, and today snapshot.
 */

import { useState, useEffect, useCallback } from "react";
import { dashboardApi } from "../lib/api";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare,
  Handshake,
  BookOpen,
  Layers,
  AlertTriangle,
  Clock,
  Loader2,
  ArrowRight,
} from "lucide-react";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await dashboardApi.get();
      setData(res.data);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-500 py-20 justify-center" data-testid="dashboard-loading">
        <Loader2 size={18} className="animate-spin" /> Loading dashboard...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-zinc-500 text-center py-20" data-testid="dashboard-error">
        Failed to load dashboard data.
      </div>
    );
  }

  const { task_counts, deal_counts, knowledge_count, build_queue_count, recent_activity, priority_tasks, priority_deals, today_activity_count } = data;

  const summaryCards = [
    {
      label: "Active Tasks",
      value: task_counts.total - task_counts.done,
      detail: `${task_counts.doing} in progress, ${task_counts.blocked} blocked`,
      icon: CheckSquare,
      color: "text-blue-400",
      link: "/tasks",
    },
    {
      label: "Open Deals",
      value: deal_counts.open + deal_counts.pending,
      detail: `${deal_counts.open} open, ${deal_counts.pending} pending`,
      icon: Handshake,
      color: "text-emerald-400",
      link: "/deals",
    },
    {
      label: "Knowledge Items",
      value: knowledge_count,
      detail: "Notes, SOPs, strategies",
      icon: BookOpen,
      color: "text-purple-400",
      link: "/vault",
    },
    {
      label: "Build Queue",
      value: build_queue_count,
      detail: "Pending items",
      icon: Layers,
      color: "text-yellow-400",
      link: "/build-queue",
    },
  ];

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="animate-fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight" data-testid="dashboard-title">
            Dashboard
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            System overview &middot; {today_activity_count} actions today
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="summary-cards">
        {summaryCards.map((card) => (
          <button
            key={card.label}
            onClick={() => navigate(card.link)}
            className="module-card text-left group cursor-pointer"
            data-testid={`summary-card-${card.label.toLowerCase().replace(/\s/g, "-")}`}
          >
            <div className="flex items-center justify-between mb-3">
              <card.icon size={18} className={card.color} />
              <ArrowRight size={14} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-2xl font-semibold text-zinc-100">{card.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{card.label}</p>
            <p className="text-[11px] text-zinc-600 mt-1">{card.detail}</p>
          </button>
        ))}
      </div>

      {/* Two column layout: Activity + Priority */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity Feed */}
        <div className="module-card" data-testid="activity-feed">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} className="text-zinc-500" />
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              Recent Activity
            </h2>
          </div>
          {recent_activity.length === 0 ? (
            <p className="text-sm text-zinc-500" data-testid="activity-empty">No recent activity</p>
          ) : (
            <div className="space-y-2.5">
              {recent_activity.slice(0, 10).map((a, i) => (
                <div key={a.id || i} className="flex items-start gap-3" data-testid={`activity-item-${i}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate">
                      <span className="text-zinc-500 capitalize">{a.action}</span>{" "}
                      <span className="text-zinc-500">{a.module}</span>{" "}
                      &middot; {a.title}
                    </p>
                    <p className="text-[11px] text-zinc-600 font-mono">{formatTime(a.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priority Items */}
        <div className="module-card" data-testid="priority-items">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={15} className="text-yellow-500" />
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              Priority Items
            </h2>
          </div>

          {priority_tasks.length === 0 && priority_deals.length === 0 ? (
            <p className="text-sm text-zinc-500" data-testid="priority-empty">No high priority items</p>
          ) : (
            <div className="space-y-2">
              {priority_tasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate("/tasks")}
                  className="w-full text-left flex items-center gap-3 py-2 px-3 bg-zinc-800/30 hover:bg-zinc-800/60 transition-colors"
                  data-testid={`priority-task-${t.id}`}
                >
                  <span className={`priority-dot priority-${t.priority}`} />
                  <span className="text-sm text-zinc-300 flex-1 truncate">{t.title}</span>
                  <span className={`badge-status badge-${t.status}`}>{t.status}</span>
                </button>
              ))}
              {priority_deals.map((d) => (
                <button
                  key={d.id}
                  onClick={() => navigate("/deals")}
                  className="w-full text-left flex items-center gap-3 py-2 px-3 bg-zinc-800/30 hover:bg-zinc-800/60 transition-colors"
                  data-testid={`priority-deal-${d.id}`}
                >
                  <Handshake size={14} className="text-emerald-400" />
                  <span className="text-sm text-zinc-300 flex-1 truncate">{d.title}</span>
                  <span className={`badge-status badge-${d.status}`}>{d.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
