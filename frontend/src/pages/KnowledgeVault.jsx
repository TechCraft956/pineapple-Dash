/**
 * Knowledge Vault - Notes, SOPs, strategies storage for Pineapple OS
 * Searchable and filterable entries with flexible categories.
 */

import { useState, useEffect, useCallback } from "react";
import { knowledgeApi } from "../lib/api";
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
import { Plus, Search, Loader2, Pencil, Trash2, FileText, Eye, X } from "lucide-react";

const CATEGORIES = ["general", "sop", "prompt", "strategy", "reference"];

export default function KnowledgeVault() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [form, setForm] = useState({
    title: "", content: "", category: "general", tags: [],
  });
  const [tagInput, setTagInput] = useState("");

  const loadItems = useCallback(async () => {
    try {
      const params = {};
      if (filterCategory !== "all") params.category = filterCategory;
      if (searchQuery) params.search = searchQuery;
      const res = await knowledgeApi.list(params);
      setItems(res.data);
    } catch (err) {
      console.error("Failed to load knowledge items:", err);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, searchQuery]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const resetForm = () => {
    setForm({ title: "", content: "", category: "general", tags: [] });
    setTagInput("");
    setEditingItem(null);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({ title: item.title, content: item.content, category: item.category, tags: item.tags || [] });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    try {
      if (editingItem) {
        await knowledgeApi.update(editingItem.id, form);
        toast.success("Updated");
      } else {
        await knowledgeApi.create(form);
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
      await knowledgeApi.remove(id);
      toast.success("Deleted");
      loadItems();
    } catch {
      toast.error("Failed to delete");
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

  const formatDate = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const categoryColors = {
    general: "bg-zinc-700/50 text-zinc-300",
    sop: "bg-blue-500/10 text-blue-400",
    prompt: "bg-purple-500/10 text-purple-400",
    strategy: "bg-emerald-500/10 text-emerald-400",
    reference: "bg-yellow-500/10 text-yellow-400",
  };

  return (
    <div className="animate-fade-in" data-testid="knowledge-vault-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight" data-testid="vault-title">Knowledge Vault</h1>
          <p className="text-sm text-zinc-500 mt-1">{items.length} item{items.length !== 1 ? "s" : ""}</p>
        </div>
        <Button data-testid="add-knowledge-btn" onClick={() => { resetForm(); setShowForm(true); }} className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-xs font-medium h-8">
          <Plus size={14} /> <span className="ml-1">New Entry</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5" data-testid="vault-filters">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input data-testid="vault-search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search knowledge..." className="pl-9 h-8 bg-zinc-900 border-zinc-800 text-sm text-zinc-300 placeholder:text-zinc-600" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-32 h-8 bg-zinc-900 border-zinc-800 text-xs text-zinc-300" data-testid="vault-filter-category"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Items grid */}
      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-8 justify-center" data-testid="vault-loading">
          <Loader2 size={16} className="animate-spin" /> Loading...
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-zinc-500 py-12 text-center" data-testid="vault-empty">No entries found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="vault-items">
          {items.map((item) => (
            <div key={item.id} className="module-card group" data-testid={`vault-item-${item.id}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-zinc-500" />
                  <span className={`badge-status ${categoryColors[item.category] || ""}`}>{item.category}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button data-testid={`view-vault-${item.id}`} onClick={() => setViewingItem(item)} className="p-1 text-zinc-500 hover:text-zinc-300"><Eye size={13} /></button>
                  <button data-testid={`edit-vault-${item.id}`} onClick={() => openEdit(item)} className="p-1 text-zinc-500 hover:text-zinc-300"><Pencil size={13} /></button>
                  <button data-testid={`delete-vault-${item.id}`} onClick={() => deleteItem(item.id)} className="p-1 text-zinc-500 hover:text-red-400"><Trash2 size={13} /></button>
                </div>
              </div>
              <h3 className="text-sm font-medium text-zinc-200 mb-1">{item.title}</h3>
              <p className="text-xs text-zinc-500 line-clamp-3">{item.content || "No content"}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[11px] text-zinc-600">{formatDate(item.created_at)}</span>
                {item.tags?.map((t) => (
                  <span key={t} className="text-[11px] text-zinc-600">#{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View dialog */}
      <Dialog open={!!viewingItem} onOpenChange={(open) => { if (!open) setViewingItem(null); }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="vault-view-dialog">
          {viewingItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-zinc-100">{viewingItem.title}</DialogTitle>
                <DialogDescription className="text-zinc-500 text-sm">Knowledge vault entry</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 mb-4">
                <span className={`badge-status ${categoryColors[viewingItem.category] || ""}`}>{viewingItem.category}</span>
                <span className="text-[11px] text-zinc-500">{formatDate(viewingItem.created_at)}</span>
              </div>
              <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{viewingItem.content || "No content"}</div>
              {viewingItem.tags?.length > 0 && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-800">
                  {viewingItem.tags.map((t) => <span key={t} className="text-xs text-zinc-500">#{t}</span>)}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg" data-testid="vault-form-dialog">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">{editingItem ? "Edit Entry" : "New Entry"}</DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm">Add knowledge to your vault.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input data-testid="vault-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600" />
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="bg-zinc-950 border-zinc-800 text-sm text-zinc-300" data-testid="vault-category-select"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea data-testid="vault-content-input" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Content..." className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 min-h-[150px]" rows={6} />
            <div className="flex flex-wrap items-center gap-1.5">
              {form.tags.map((t) => (
                <span key={t} className="text-[11px] bg-zinc-800 text-zinc-300 px-2 py-0.5 cursor-pointer hover:bg-zinc-700" onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== t) })}>#{t} <X size={10} className="inline" /></span>
              ))}
              <input data-testid="vault-tag-input" type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKey} placeholder="Add tag" className="bg-transparent text-xs text-zinc-400 outline-none w-24 placeholder:text-zinc-600" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setShowForm(false); resetForm(); }} className="text-zinc-400 text-xs h-8" data-testid="vault-cancel-btn">Cancel</Button>
              <Button onClick={handleSubmit} className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-xs font-medium h-8" data-testid="vault-save-btn">{editingItem ? "Update" : "Create"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
