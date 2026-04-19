import { useCallback, useEffect, useState } from "react";
import { dashboardApi } from "../lib/api";
import { Loader2 } from "lucide-react";

function SectionCard({ title, children }) {
  return (
    <div className="module-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function StatusPill({ ok, label }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${ok ? "bg-emerald-500/15 text-emerald-300" : "bg-yellow-500/15 text-yellow-300"}`}>
      {label}
    </span>
  );
}

export default function Overview() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await dashboardApi.overview();
      setOverview(res.data);
    } catch (err) {
      console.error("Failed to load operator overview", err);
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
    return <div className="flex items-center gap-2 text-zinc-500 py-20 justify-center"><Loader2 size={18} className="animate-spin" /> Loading overview...</div>;
  }

  if (!overview) {
    return <div className="text-zinc-500 text-center py-20">Overview unavailable.</div>;
  }

  const marketplace = overview.marketplace || {};
  const approvals = overview.approvals || [];
  const failures = overview.failures || [];
  const topActions = overview.top_actions || [];
  const agents = overview.agents || [];
  const services = overview.service_health?.services || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Overview</h1>
        <p className="text-sm text-zinc-500 mt-1">Truthful command surface backed by host runtime state.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <SectionCard title="System Ownership">
          <div className="space-y-2 text-sm text-zinc-300">
            <div className="flex items-center justify-between"><span>Dispatch</span><StatusPill ok={overview.dispatch?.alive} label={overview.dispatch?.alive ? "active" : "down"} /></div>
            <div className="flex items-center justify-between"><span>OpenClaw</span><StatusPill ok={overview.openclaw?.alive} label={overview.openclaw?.alive ? "alive" : "down"} /></div>
            <div className="flex items-center justify-between"><span>Marketplace</span><StatusPill ok={marketplace.alive} label={marketplace.healthy ? "healthy" : "degraded"} /></div>
          </div>
        </SectionCard>

        <SectionCard title="What Is Running Now">
          <div className="space-y-2 text-sm text-zinc-300">
            <div>Active intent: <span className="text-zinc-100">{overview.active_intent}</span></div>
            <div>Active tasks: <span className="text-zinc-100">{overview.active_tasks?.length || 0}</span></div>
            <div>Services: <span className="text-zinc-100">{overview.service_health?.summary || "unwired"}</span></div>
          </div>
        </SectionCard>

        <SectionCard title="Approvals Pending">
          <div className="text-3xl font-semibold text-zinc-100">{approvals.filter((a) => a.status === "pending").length}</div>
          <p className="mt-2 text-xs text-zinc-500">One approval inbox, canonical at pineapple-ops-runtime/state/approvals.json</p>
        </SectionCard>

        <SectionCard title="Latest Alerts">
          <div className="space-y-2 text-sm text-zinc-300">
            {failures.slice(0, 2).map((failure, idx) => <div key={idx}>{failure.summary}</div>)}
            {!failures.length && <div className="text-zinc-500">No recent alerts</div>}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title="Top 3 Actions">
          <div className="space-y-3">
            {topActions.map((item, idx) => (
              <div key={idx} className="rounded border border-zinc-800 p-3 text-sm">
                <div className="font-medium text-zinc-100">{item.title}</div>
                <div className="text-zinc-500">{item.source} · ${item.price} · {item.signal_label || "unlabeled"}</div>
              </div>
            ))}
            {!topActions.length && <div className="text-zinc-500 text-sm">Unwired</div>}
          </div>
        </SectionCard>

        <SectionCard title="Daily Brief">
          <pre className="whitespace-pre-wrap text-sm text-zinc-300 font-sans">{overview.daily_brief?.markdown || "Unwired"}</pre>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title="Agents">
          <div className="space-y-3">
            {agents.map((agent, idx) => (
              <div key={idx} className="rounded border border-zinc-800 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-zinc-100">{agent.name}</div>
                  <StatusPill ok={agent.status === "active"} label={agent.status} />
                </div>
                <div className="text-zinc-500">{agent.system} · {agent.role}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="System Health">
          <div className="space-y-2">
            {services.map((svc) => (
              <div key={svc.name} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">{svc.name}</span>
                <span className="text-zinc-500">{svc.status}</span>
              </div>
            ))}
            {!services.length && <div className="text-zinc-500 text-sm">Unwired</div>}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
