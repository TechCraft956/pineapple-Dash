/**
 * Infrastructure Registry - Track all services, apps, DBs, agents, proxies
 * Full CRUD with filtering by runtime and environment.
 */

import { useState, useEffect, useCallback } from "react";
import { infrastructureApi } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Loader2, Pencil, Trash2, X, Server, Wifi, WifiOff, AlertTriangle } from "lucide-react";

const CATEGORIES = ["app", "api", "db", "agent", "proxy", "model", "automation"];
const RUNTIMES = ["local", "docker", "emergent", "vps"];
const ENVIRONMENTS = ["dev", "staging", "prod"];
const STATUSES = ["running", "stopped", "unknown", "broken"];

const STATUS_ICON = {
  running: <Wifi size={14} className="text-emerald-400" />,
  stopped: <WifiOff size={14} className="text-zinc-500" />,
  broken: <AlertTriangle size={14} className="text-red-400" />,
  unknown: <Server size={14} className="text-yellow-400" />,
};

const emptyForm = {
  service_name: "", friendly_name: "", category: "app", runtime: "local",
  environment: "dev", host_machine: "", internal_hostname: "",
  internal_port: "", external_port: "", url: "",
  docker_compose_project: "", docker_network: "", repo_path: "",
  healthcheck_url: "", status: "unknown", notes: "", tags: [],
};

export default function InfrastructureRegistry() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRuntime, setFilterRuntime] = useState("all");
  const [filterEnv, setFilterEnv] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [tagInput, setTagInput] = useState("");

  const loadItems = useCallback(async () => {
    try {
      const params = {};
      if (filterRuntime !== "all") params.runtime = filterRuntime;
      if (filterEnv !== "all") params.environment = filterEnv;
      if (filterStatus !== "all") params.status = filterStatus;
      if (searchQuery) params.search = searchQuery;
      const res = await infrastructureApi.list(params);
      setItems(res.data);
    } catch (err) {
      console.error("Failed to load infrastructure:", err);
    } finally {
      setLoading(false);
    }
  }, [filterRuntime, filterEnv, filterStatus, searchQuery]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...emptyForm });
    setTagInput("");
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      service_name: item.service_name,
      friendly_name: item.friendly_name,
      category: item.category,
      runtime: item.runtime,
      environment: item.environment,
      host_machine: item.host_machine,
      internal_hostname: item.internal_hostname,
      internal_port: item.internal_port || "",
      external_port: item.external_port || "",
      url: item.url,
      docker_compose_project: item.docker_compose_project,
      docker_network: item.docker_network,
      repo_path: item.repo_path,
      healthcheck_url: item.healthcheck_url,
      status: item.status,
      notes: item.notes,
      tags: item.tags || [],
    });
    setTagInput("");
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.service_name.trim()) return toast.error("Service name is required");
    try {
      const payload = {
        ...form,
        internal_port: form.internal_port ? parseInt(form.internal_port, 10) : null,
        external_port: form.external_port ? parseInt(form.external_port, 10) : null,
      };
      if (editingItem) {
        await infrastructureApi.update(editingItem.id, payload);
        toast.success("Record updated");
      } else {
        await infrastructureApi.create(payload);
        toast.success("Record created");
      }
      setShowForm(false);
      loadItems();
    } catch (err) {
      toast.error("Failed to save record");
    }
  };

  const handleDelete = async (id) => {
    try {
      await infrastructureApi.remove(id);
      toast.success("Record deleted");
      loadItems();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (!form.tags.includes(tag)) {
        setForm({ ...form, tags: [...form.tags, tag] });
      }
      setTagInput("");
    }
  };

  const removeTag = (tag) => setForm({ ...form, tags: form.tags.filter((t) => t !== tag) });

  return (
    <div className="animate-fade-in" data-testid="infrastructure-page">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight" data-testid="infra-title">
            Infrastructure Registry
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Track services, apps, databases, agents &middot; {items.length} records
          </p>
        </div>
        <Button onClick={openCreate} className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-xs font-medium" data-testid="add-infra-btn">
          <Plus size={14} className="mr-1" /> Add Record
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4" data-testid="infra-filters">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            data-testid="infra-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search services..."
            className="pl-9 bg-zinc-900 border-zinc-800 text-sm h-9"
          />
        </div>
        <Select value={filterRuntime} onValueChange={setFilterRuntime}>
          <SelectTrigger className="w-28 h-9 bg-zinc-900 border-zinc-800 text-xs" data-testid="filter-runtime">
            <SelectValue placeholder="Runtime" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all">All Runtimes</SelectItem>
            {RUNTIMES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEnv} onValueChange={setFilterEnv}>
          <SelectTrigger className="w-28 h-9 bg-zinc-900 border-zinc-800 text-xs" data-testid="filter-env">
            <SelectValue placeholder="Env" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all">All Envs</SelectItem>
            {ENVIRONMENTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-28 h-9 bg-zinc-900 border-zinc-800 text-xs" data-testid="filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Items List */}
      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 py-12 justify-center" data-testid="infra-loading">
          <Loader2 size={16} className="animate-spin" /> Loading...
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-zinc-500 py-12 text-center" data-testid="infra-empty">
          No infrastructure records. Add your first service above.
        </div>
      ) : (
        <div className="space-y-2" data-testid="infra-list">
          {items.map((item) => (
            <div key={item.id} className="module-card group" data-testid={`infra-item-${item.id}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{STATUS_ICON[item.status] || STATUS_ICON.unknown}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-zinc-100">{item.service_name}</span>
                    {item.friendly_name && <span className="text-xs text-zinc-500">({item.friendly_name})</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                    <span className="badge-status badge-doing">{item.category}</span>
                    <span className="badge-status badge-planning">{item.runtime}</span>
                    <span className="badge-status badge-requested">{item.environment}</span>
                    {item.url && <span className="text-zinc-400 truncate max-w-[200px]">{item.url}</span>}
                    {item.internal_port && <span>:{item.internal_port}</span>}
                    {item.host_machine && <span className="text-zinc-600">@ {item.host_machine}</span>}
                  </div>
                  {item.notes && <p className="text-xs text-zinc-500 mt-1 truncate">{item.notes}</p>}
                  {item.tags?.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {item.tags.map((tag) => <span key={tag} className="text-[10px] text-zinc-600">#{tag}</span>)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(item)} className="text-zinc-500 hover:text-zinc-300 p-1" data-testid={`edit-infra-${item.id}`}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="text-zinc-500 hover:text-red-400 p-1" data-testid={`delete-infra-${item.id}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {editingItem ? "Edit Record" : "New Infrastructure Record"}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">Track a service, app, or system component.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Service Name *</label>
                <Input value={form.service_name} onChange={(e) => setForm({ ...form, service_name: e.target.value })} className="bg-zinc-900 border-zinc-800 text-sm" placeholder="e.g. my-api" data-testid="form-service-name" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Friendly Name</label>
                <Input value={form.friendly_name} onChange={(e) => setForm({ ...form, friendly_name: e.target.value })} className="bg-zinc-900 border-zinc-800 text-sm" placeholder="e.g. My API Service" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Category</label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs h-9"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Runtime</label>
                <Select value={form.runtime} onValueChange={(v) => setForm({ ...form, runtime: v })}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs h-9"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {RUNTIMES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Environment</label>
                <Select value={form.environment} onValueChange={(v) => setForm({ ...form, environment: v })}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs h-9"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {ENVIRONMENTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Status</label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs h-9"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Host Machine</label>
                <Input value={form.host_machine} onChange={(e) => setForm({ ...form, host_machine: e.target.value })} className="bg-zinc-900 border-zinc-800 text-sm" placeholder="e.g. main-server" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Internal Hostname</label>
                <Input value={form.internal_hostname} onChange={(e) => setForm({ ...form, internal_hostname: e.target.value })} className="bg-zinc-900 border-zinc-800 text-sm" placeholder="e.g. my-api" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">URL</label>
                <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="bg-zinc-900 border-zinc-800 text-sm" placeholder="https://..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Internal Port</label>
                <Input type="number" value={form.internal_port} onChange={(e) => setForm({ ...form, internal_port: e.target.value })} className="bg-zinc-900 border-zinc-800 text-sm" placeholder="8001" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">External Port</label>
                <Input type="number" value={form.external_port} onChange={(e) => setForm({ ...form, external_port: e.target.value })} className="bg-zinc-900 border-zinc-800 text-sm" placeholder="443" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Docker Compose Project</label>
                <Input value={form.docker_compose_project} onChange={(e) => setForm({ ...form, docker_compose_project: e.target.value })} className="bg-zinc-900 border-zinc-800 text-sm" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Docker Network</label>
                <Input value={form.docker_network} onChange={(e) => setForm({ ...form, docker_network: e.target.value })} className="bg-zinc-900 border-zinc-800 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Repo Path</label>
                <Input value={form.repo_path} onChange={(e) => setForm({ ...form, repo_path: e.target.value })} className="bg-zinc-900 border-zinc-800 text-sm" placeholder="/path/to/repo" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Healthcheck URL</label>
                <Input value={form.healthcheck_url} onChange={(e) => setForm({ ...form, healthcheck_url: e.target.value })} className="bg-zinc-900 border-zinc-800 text-sm" placeholder="https://.../health" />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Notes</label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="bg-zinc-900 border-zinc-800 text-sm min-h-[60px]" placeholder="Additional notes..." />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-1">
                {form.tags.map((tag) => (
                  <span key={tag} onClick={() => removeTag(tag)} className="text-[11px] bg-zinc-800 text-zinc-300 px-2 py-0.5 cursor-pointer hover:bg-zinc-700">#{tag} ×</span>
                ))}
              </div>
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} className="bg-zinc-900 border-zinc-800 text-sm" placeholder="Type tag and press Enter" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowForm(false)} className="text-zinc-400 text-xs">Cancel</Button>
              <Button onClick={handleSubmit} className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-xs font-medium" data-testid="save-infra-btn">Save Record</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
