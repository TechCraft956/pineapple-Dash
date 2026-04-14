/**
 * Build Queue - Track future upgrades, automations, modules for Pineapple OS
 * Tabular list with status pipelines and priority sorting.
 */

import { useState, useEffect, useCallback } from "react";
import { buildQueueApi } from "../lib/api";
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
} from "../components/ui/dialog";
import { toast } from "sonner";
import { Plus, Loader2, Pencil, Trash2, X } from "lucide-react";

const STATUSES = ["requested", "planning", "building", "done"];
const PRIORITIES = ["low", "medium", "high", "critical"];

const STATUS_ORDER = { requested: 0, planning: 1, building: 2, done: 3 };

export default function BuildQueue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    title: "", description: "", status: "requested", priority: "medium", rationale: "", tags: [],
  });
  const [tagInput, setTagInput] = useState("");

  const loadItems = useCallback(async () => {
    try {
      const params = {};
      if (filterStatus !== "all") params.status = filterStatus;
      const res = await buildQueueApi.list(params);
      // Sort by priority then status
      const sorted = res.data.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const pDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
        if (pDiff !== 0) return pDiff;
        return (STATUS_ORDER[a.status] || 0) - (STATUS_ORDER[b.status] || 0);
      });
      setItems(sorted);
    } catch (err) {
      console.error("Failed to load build queue:", err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const resetForm = () => {
    setForm({ title: "", description: "", status: "requested", priority: "medium", rationale: "", tags: [] });
    setTagInput("");
    setEditingItem(null);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      title: item.title, description: item.description, status: item.status,
      priority: item.priority, rationale: item.rationale, tags: item.tags || [],
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    try {
      if (editingItem) {
        await buildQueueApi.update(editingItem.id, form);
        toast.success("Updated");
      } else {
        await buildQueueApi.create(form);
        toast.success("Created");
      }
      setShowForm(false);
      resetForm();
      loadItems();
    } catch {
      toast.error("Failed to save");
    }
  };

  const deleteItem = async (id) => {
    try {
      await buildQueueApi.remove(id);
      toast.success("Deleted");
      loadItems();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const quickStatusChange = async (item, newStatus) => {
    try {
      await buildQueueApi.update(item.id, { status: newStatus });
      loadItems();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleTagKey = (e) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (!form.tags.includes(tag)) setForm({ ...form, tags: [...form.tags, tag] });
      setTagInput("");
    }
  };

  const formatDate = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="animate-fade-in" data-testid="build-queue-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight" data-testid="build-queue-title">Build Queue</h1>
          <p className="text-sm text-zinc-500 mt-1">{items.length} item{items.length !== 1 ? "s" : ""} &middot; Track upgrades and planned modules</p>
        </div>
        <Button data-testid="add-build-item-btn" onClick={() => { resetForm(); setShowForm(true); }} className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-xs font-medium h-8">
          <Plus size={14} /> <span className="ml-1">Add Item</span>
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 mb-5" data-testid="build-queue-filters">
        {["all", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 transition-colors ${
              filterStatus === s
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                : "text-zinc-500 hover:text-zinc-300 border border-transparent"
            }`}
            data-testid={`filter-${s}`}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Items list */}
      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-8 justify-center" data-testid="build-queue-loading">
          <Loader2 size={16} className="animate-spin" /> Loading...
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-zinc-500 py-12 text-center" data-testid="build-queue-empty">No items in queue.</div>
      ) : (
        <div className="space-y-2" data-testid="build-queue-list">
          {items.map((item) => (
            <div key={item.id} className="module-card group" data-testid={`build-item-${item.id}`}>
              <div className="flex items-start gap-3">
                <span className={`priority-dot priority-${item.priority} mt-1.5 shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-zinc-200">{item.title}</h3>
                    <span className={`badge-status badge-${item.status}`}>{item.status}</span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-zinc-500 mb-1">{item.description}</p>
                  )}
                  {item.rationale && (
                    <p className="text-xs text-zinc-600 italic">Rationale: {item.rationale}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] text-zinc-600">{formatDate(item.created_at)}</span>
                    {item.tags?.map((t) => (
                      <span key={t} className="text-[11px] text-zinc-600">#{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Quick status progression */}
                  {item.status !== "done" && (
                    <Select value={item.status} onValueChange={(v) => quickStatusChange(item, v)}>
                      <SelectTrigger className="w-24 h-7 bg-transparent border-zinc-700 text-[11px] text-zinc-400" data-testid={`status-select-${item.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <button data-testid={`edit-build-${item.id}`} onClick={() => openEdit(item)} className="p-1 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"><Pencil size={13} /></button>
                  <button data-testid={`delete-build-${item.id}`} onClick={() => deleteItem(item.id)} className="p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg" data-testid="build-form-dialog">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">{editingItem ? "Edit Item" : "New Build Queue Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input data-testid="build-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600" />
            <Textarea data-testid="build-desc-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 min-h-[60px]" rows={2} />
            <Textarea data-testid="build-rationale-input" value={form.rationale} onChange={(e) => setForm({ ...form, rationale: e.target.value })} placeholder="Rationale (why is this needed?)" className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 min-h-[40px]" rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-sm text-zinc-300" data-testid="build-status-select"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-sm text-zinc-300" data-testid="build-priority-select"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {form.tags.map((t) => (
                <span key={t} className="text-[11px] bg-zinc-800 text-zinc-300 px-2 py-0.5 cursor-pointer hover:bg-zinc-700" onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== t) })}>#{t} <X size={10} className="inline" /></span>
              ))}
              <input data-testid="build-tag-input" type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKey} placeholder="Add tag" className="bg-transparent text-xs text-zinc-400 outline-none w-24 placeholder:text-zinc-600" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setShowForm(false); resetForm(); }} className="text-zinc-400 text-xs h-8" data-testid="build-cancel-btn">Cancel</Button>
              <Button onClick={handleSubmit} className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-xs font-medium h-8" data-testid="build-save-btn">{editingItem ? "Update" : "Create"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
