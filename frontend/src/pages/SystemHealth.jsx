import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { dashboardApi } from "../lib/api";
import {
  formatTimestamp,
  healthTone,
  orderedContractEntities,
  orderedOwnershipEntries,
  sortAgents,
  sortServices,
  statusClasses,
} from "../lib/runtimeTruth";

function SectionCard({ title, children }) {
  return (
    <div className="module-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-300">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function StatusPill({ label, tone = "warn" }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(tone)}`}>{label}</span>;
}

export default function SystemHealth() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await dashboardApi.overview();
      setOverview(res.data);
    } catch (err) {
      console.error("Failed to load system health", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center gap-2 py-20 text-zinc-500"><Loader2 size={18} className="animate-spin" /> Loading system health...</div>;
  }

  if (!overview) {
    return <div className="py-20 text-center text-zinc-500">System health unavailable.</div>;
  }

  const services = sortServices(overview.service_health?.services || []);
  const agents = sortAgents(overview.agents || []);
  const contractEntities = orderedContractEntities(overview.state_contract || {});
  const ownershipEntries = orderedOwnershipEntries(overview.ownership_map || {});
  const blockedItems = [...new Set(overview.blocked_items || [])];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">System Health</h1>
          <p className="mt-1 text-sm text-zinc-500">Canonical runtime truth, ordered for fast operator checks.</p>
        </div>
        <div className="text-xs text-zinc-500">
          <div>Snapshot: <span className="text-zinc-300">{formatTimestamp(overview.generated_at)}</span></div>
          <div>Runtime root: <span className="text-zinc-300">{overview.canonical_runtime_root || "Unknown"}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Service Summary">
          <div className="space-y-2 text-sm text-zinc-300">
            <div className="flex items-center justify-between"><span>Summary</span><StatusPill tone={overview.service_health?.healthy_count === overview.service_health?.total_count ? "ok" : "warn"} label={overview.service_health?.summary || "unwired"} /></div>
            <div>Healthy count: <span className="text-zinc-100">{overview.service_health?.healthy_count || 0}</span></div>
            <div>Total count: <span className="text-zinc-100">{overview.service_health?.total_count || 0}</span></div>
          </div>
        </SectionCard>

        <SectionCard title="Runtime Owners">
          <div className="space-y-2 text-sm text-zinc-300">
            {ownershipEntries.slice(0, 3).map(([owner, data]) => (
              <div key={owner}>
                <div className="text-zinc-100">{owner}</div>
                <div className="text-xs text-zinc-500">{Array.isArray(data?.owns) ? `${data.owns.length} owned surfaces` : "Legacy path list"}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Agent Truth">
          <div className="space-y-2 text-sm text-zinc-300">
            {agents.map((agent) => (
              <div key={agent.name} className="flex items-center justify-between gap-3">
                <span>{agent.name}</span>
                <StatusPill tone={healthTone(agent.status)} label={agent.status} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Blocked Items">
          <div className="space-y-2 text-sm text-zinc-300">
            {blockedItems.slice(0, 3).map((item, idx) => <div key={`${item}-${idx}`}>{item}</div>)}
            {!blockedItems.length && <div className="text-zinc-500">No current blockers</div>}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="Services (from docker ps)">
          <div className="space-y-2">
            {services.map((svc) => (
              <div key={svc.name} className="flex items-center justify-between gap-3 border-b border-zinc-800/60 py-2 text-sm last:border-b-0">
                <div className="min-w-0">
                  <div className="truncate text-zinc-100">{svc.name}</div>
                  <div className="text-xs text-zinc-600">Canonical source: /api/operator/overview → service_health</div>
                </div>
                <StatusPill tone={healthTone(svc.status)} label={svc.status} />
              </div>
            ))}
            {!services.length && <div className="text-sm text-zinc-500">No services discovered</div>}
          </div>
        </SectionCard>

        <SectionCard title="Canonical State Contract">
          <div className="space-y-3 text-sm text-zinc-300">
            <div className="text-xs text-zinc-500">Version {overview.state_contract?.version || "unknown"}</div>
            {contractEntities.map(([name, entity]) => (
              <div key={name} className="rounded border border-zinc-800 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-zinc-100">{name}</div>
                  <div className="text-xs text-zinc-500">owner: {entity.owner || "unknown"}</div>
                </div>
                <div className="mt-1 break-all text-xs text-zinc-500">{entity.path || "No path declared"}</div>
                <div className="mt-1 text-xs text-zinc-600">stale rule: {entity.staleness_rule || "not declared"}</div>
              </div>
            ))}
            {!contractEntities.length && <div className="text-sm text-zinc-500">No contract entities published</div>}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Ownership Map">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {ownershipEntries.map(([owner, data]) => (
            <div key={owner} className="rounded border border-zinc-800 p-3 text-sm">
              <div className="font-medium text-zinc-100">{owner}</div>
              {Array.isArray(data) ? (
                <div className="mt-2 space-y-1 text-xs text-zinc-500">
                  {data.map((item) => <div key={item}>{item}</div>)}
                </div>
              ) : (
                <div className="mt-2 space-y-1 text-xs text-zinc-500">
                  {(data?.owns || []).map((item) => <div key={item}>{item}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
