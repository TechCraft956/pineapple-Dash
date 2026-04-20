import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { dashboardApi } from "../lib/api";
import {
  formatTimestamp,
  healthTone,
  orderedOwnershipEntries,
  sortAgents,
  sortServices,
  statusClasses,
} from "../lib/runtimeTruth";

function SectionCard({ title, children, action }) {
  return (
    <div className="module-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatusPill({ label, tone = "warn" }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(tone)}`}>
      {label}
    </span>
  );
}

function useOverview() {
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
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  return { overview, loading };
}

export default function Overview() {
  const { overview, loading } = useOverview();

  if (loading) {
    return <div className="flex items-center gap-2 py-20 justify-center text-zinc-500"><Loader2 size={18} className="animate-spin" /> Loading overview...</div>;
  }

  if (!overview) {
    return <div className="py-20 text-center text-zinc-500">Overview unavailable.</div>;
  }

  const marketplace = overview.marketplace || {};
  const approvals = overview.approvals || [];
  const failures = overview.failures || [];
  const topActions = overview.top_actions || [];
  const activeTasks = overview.active_tasks || [];
  const services = sortServices(overview.service_health?.services || []);
  const agents = sortAgents(overview.agents || []);
  const ownershipEntries = orderedOwnershipEntries(overview.ownership_map || {}).filter(([name]) => name !== "deprecated_parallel_state");
  const blockedItems = [...new Set(overview.blocked_items || [])].slice(0, 4);
  const pendingApprovals = approvals.filter((item) => item.status === "pending").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Overview</h1>
          <p className="mt-1 text-sm text-zinc-500">Truthful command surface backed by canonical runtime state.</p>
        </div>
        <div className="text-xs text-zinc-500">
          <div>Snapshot: <span className="text-zinc-300">{formatTimestamp(overview.generated_at)}</span></div>
          <div>Runtime root: <span className="text-zinc-300">{overview.canonical_runtime_root || "Unknown"}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Canonical Status">
          <div className="space-y-2 text-sm text-zinc-300">
            <div className="flex items-center justify-between"><span>Dispatch</span><StatusPill tone={overview.dispatch?.alive ? "ok" : "warn"} label={overview.dispatch?.alive ? "active" : "down"} /></div>
            <div className="flex items-center justify-between"><span>OpenClaw</span><StatusPill tone={overview.openclaw?.alive ? "ok" : "warn"} label={overview.openclaw?.alive ? "alive" : "down"} /></div>
            <div className="flex items-center justify-between"><span>Services</span><StatusPill tone={services.length && overview.service_health?.healthy_count === overview.service_health?.total_count ? "ok" : "warn"} label={overview.service_health?.summary || "unwired"} /></div>
            <div className="flex items-center justify-between"><span>Marketplace</span><StatusPill tone={marketplace.healthy ? "ok" : marketplace.alive ? "up" : "warn"} label={marketplace.alive ? (marketplace.healthy ? "healthy" : "degraded") : "offline"} /></div>
          </div>
        </SectionCard>

        <SectionCard title="What Is Running Now">
          <div className="space-y-2 text-sm text-zinc-300">
            <div>Active intent: <span className="text-zinc-100">{overview.active_intent}</span></div>
            <div>Active tasks: <span className="text-zinc-100">{activeTasks.length}</span></div>
            <div>Active agents: <span className="text-zinc-100">{agents.filter((agent) => agent.status === "active").length}</span></div>
            <div>Pending approvals: <span className="text-zinc-100">{pendingApprovals}</span></div>
          </div>
        </SectionCard>

        <SectionCard title="Canonical Sources">
          <div className="space-y-2 text-sm text-zinc-300">
            {ownershipEntries.slice(0, 3).map(([owner, data]) => (
              <div key={owner}>
                <div className="text-zinc-100">{owner}</div>
                <div className="text-xs text-zinc-500">{(data?.owns || []).slice(0, 2).join(" • ") || "No ownership notes"}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Latest Alerts">
          <div className="space-y-2 text-sm text-zinc-300">
            {blockedItems.map((item, idx) => <div key={`${item}-${idx}`}>{item}</div>)}
            {!blockedItems.length && failures.slice(0, 2).map((failure, idx) => <div key={idx}>{failure.summary}</div>)}
            {!blockedItems.length && !failures.length && <div className="text-zinc-500">No recent alerts</div>}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="Top 3 Actions">
          <div className="space-y-3">
            {topActions.map((item, idx) => (
              <div key={idx} className="rounded border border-zinc-800 p-3 text-sm">
                <div className="font-medium text-zinc-100">{item.title}</div>
                <div className="text-zinc-500">{item.source} · ${item.price} · {item.signal_label || "unlabeled"}</div>
              </div>
            ))}
            {!topActions.length && <div className="text-sm text-zinc-500">Unwired</div>}
          </div>
        </SectionCard>

        <SectionCard title="Daily Brief">
          <pre className="font-sans whitespace-pre-wrap text-sm text-zinc-300">{overview.daily_brief?.markdown || "Unwired"}</pre>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="Agents">
          <div className="space-y-3">
            {agents.map((agent, idx) => (
              <div key={idx} className="rounded border border-zinc-800 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-zinc-100">{agent.name}</div>
                  <StatusPill tone={healthTone(agent.status)} label={agent.status} />
                </div>
                <div className="text-zinc-500">{agent.system} · {agent.role}</div>
                <div className="mt-1 text-xs text-zinc-600">Last output: {formatTimestamp(agent.last_output_at)}</div>
              </div>
            ))}
            {!agents.length && <div className="text-sm text-zinc-500">Unwired</div>}
          </div>
        </SectionCard>

        <SectionCard title="System Health" action={<Link to="/system-health" className="text-xs text-yellow-500 hover:text-yellow-400">Open detailed view</Link>}>
          <div className="space-y-2">
            {services.slice(0, 6).map((svc) => (
              <div key={svc.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-300">{svc.name}</span>
                <StatusPill tone={healthTone(svc.status)} label={svc.status} />
              </div>
            ))}
            {services.length > 6 && <div className="text-xs text-zinc-500">+{services.length - 6} more services on the detailed health page</div>}
            {!services.length && <div className="text-sm text-zinc-500">Unwired</div>}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
