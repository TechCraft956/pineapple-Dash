/**
 * Deals Module - Deal tracking for Pineapple OS
 * Dense data table with auto-calculated profit/ROI, filters, and search.
 */

import { useState, useEffect, useCallback } from "react";
import { dealsApi } from "../lib/api";
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
import { Plus, Search, Loader2, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";

const STATUSES = ["open", "pending", "closed", "archived"];
const PRIORITIES = ["low", "medium", "high", "critical"];

export default function Deals() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [form, setForm] = useState({
    title: "", category: "", buy_price: "", sell_price: "", fees: "",
    status: "open", priority: "medium", notes: "", tags: [],
  });
  const [tagInput, setTagInput] = useState("");

  const loadDeals = useCallback(async () => {
    try {
      const params = {};
      if (filterStatus !== "all") params.status = filterStatus;
      if (filterPriority !== "all") params.priority = filterPriority;
      if (searchQuery) params.search = searchQuery;
      const res = await dealsApi.list(params);
      setDeals(res.data);
    } catch (err) {
      console.error("Failed to load deals:", err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority, searchQuery]);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  const resetForm = () => {
    setForm({ title: "", category: "", buy_price: "", sell_price: "", fees: "", status: "open", priority: "medium", notes: "", tags: [] });
    setTagInput("");
    setEditingDeal(null);
  };

  const openEdit = (deal) => {
    setEditingDeal(deal);
    setForm({
      title: deal.title, category: deal.category, buy_price: String(deal.buy_price),
      sell_price: String(deal.sell_price), fees: String(deal.fees),
      status: deal.status, priority: deal.priority, notes: deal.notes, tags: deal.tags || [],
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    try {
      const payload = {
        ...form,
        buy_price: parseFloat(form.buy_price) || 0,
        sell_price: parseFloat(form.sell_price) || 0,
        fees: parseFloat(form.fees) || 0,
      };
      if (editingDeal) {
        await dealsApi.update(editingDeal.id, payload);
        toast.success("Deal updated");
      } else {
        await dealsApi.create(payload);
        toast.success("Deal created");
      }
      setShowForm(false);
      resetForm();
      loadDeals();
    } catch {
      toast.error("Failed to save deal");
    }
  };

  const deleteDeal = async (id) => {
    try {
      await dealsApi.remove(id);
      toast.success("Deal deleted");
      loadDeals();
    } catch {
      toast.error("Failed to delete deal");
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

  const formatCurrency = (v) => `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  return (
    <div className="animate-fade-in" data-testid="deals-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight" data-testid="deals-title">Deals</h1>
          <p className="text-sm text-zinc-500 mt-1">{deals.length} deal{deals.length !== 1 ? "s" : ""}</p>
        </div>
        <Button data-testid="add-deal-btn" onClick={() => { resetForm(); setShowForm(true); }} className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-xs font-medium h-8">
          <Plus size={14} /> <span className="ml-1">Add Deal</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5" data-testid="deals-filters">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input data-testid="deals-search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search deals..." className="pl-9 h-8 bg-zinc-900 border-zinc-800 text-sm text-zinc-300 placeholder:text-zinc-600" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-28 h-8 bg-zinc-900 border-zinc-800 text-xs text-zinc-300" data-testid="deals-filter-status"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-28 h-8 bg-zinc-900 border-zinc-800 text-xs text-zinc-300" data-testid="deals-filter-priority"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all">All Priority</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-8 justify-center" data-testid="deals-loading">
          <Loader2 size={16} className="animate-spin" /> Loading deals...
        </div>
      ) : deals.length === 0 ? (
        <div className="text-sm text-zinc-500 py-12 text-center" data-testid="deals-empty">No deals found.</div>
      ) : (
        <div className="overflow-x-auto" data-testid="deals-table-container">
          <table className="data-table w-full" data-testid="deals-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th className="text-right">Buy</th>
                <th className="text-right">Sell</th>
                <th className="text-right">Fees</th>
                <th className="text-right">Profit</th>
                <th className="text-right">ROI</th>
                <th>Status</th>
                <th>Priority</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.id} data-testid={`deal-row-${deal.id}`}>
                  <td className="font-medium text-zinc-200">{deal.title}</td>
                  <td className="text-zinc-400">{deal.category || "—"}</td>
                  <td className="text-right font-mono text-zinc-400">{formatCurrency(deal.buy_price)}</td>
                  <td className="text-right font-mono text-zinc-400">{formatCurrency(deal.sell_price)}</td>
                  <td className="text-right font-mono text-zinc-500">{formatCurrency(deal.fees)}</td>
                  <td className="text-right font-mono">
                    <span className={deal.estimated_profit >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {deal.estimated_profit >= 0 ? <TrendingUp size={12} className="inline mr-1" /> : <TrendingDown size={12} className="inline mr-1" />}
                      {formatCurrency(Math.abs(deal.estimated_profit))}
                    </span>
                  </td>
                  <td className="text-right font-mono">
                    <span className={deal.roi_percent >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {deal.roi_percent.toFixed(1)}%
                    </span>
                  </td>
                  <td><span className={`badge-status badge-${deal.status}`}>{deal.status}</span></td>
                  <td><span className={`priority-dot priority-${deal.priority}`} /></td>
                  <td>
                    <div className="flex gap-1">
                      <button data-testid={`edit-deal-${deal.id}`} onClick={() => openEdit(deal)} className="p-1 text-zinc-500 hover:text-zinc-300"><Pencil size={13} /></button>
                      <button data-testid={`delete-deal-${deal.id}`} onClick={() => deleteDeal(deal.id)} className="p-1 text-zinc-500 hover:text-red-400"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg" data-testid="deal-form-dialog">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">{editingDeal ? "Edit Deal" : "New Deal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input data-testid="deal-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Deal title" className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600" />
            <Input data-testid="deal-category-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category" className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600" />
            <div className="grid grid-cols-3 gap-3">
              <Input data-testid="deal-buy-input" type="number" value={form.buy_price} onChange={(e) => setForm({ ...form, buy_price: e.target.value })} placeholder="Buy price" className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600" />
              <Input data-testid="deal-sell-input" type="number" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} placeholder="Sell price" className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600" />
              <Input data-testid="deal-fees-input" type="number" value={form.fees} onChange={(e) => setForm({ ...form, fees: e.target.value })} placeholder="Fees" className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-sm text-zinc-300" data-testid="deal-status-select"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-sm text-zinc-300" data-testid="deal-priority-select"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Textarea data-testid="deal-notes-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 min-h-[50px]" rows={2} />
            <div className="flex flex-wrap items-center gap-1.5">
              {form.tags.map((t) => (
                <span key={t} className="text-[11px] bg-zinc-800 text-zinc-300 px-2 py-0.5 cursor-pointer hover:bg-zinc-700" onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== t) })}>#{t} ×</span>
              ))}
              <input data-testid="deal-tag-input" type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKey} placeholder="Add tag" className="bg-transparent text-xs text-zinc-400 outline-none w-24 placeholder:text-zinc-600" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setShowForm(false); resetForm(); }} className="text-zinc-400 text-xs h-8" data-testid="deal-cancel-btn">Cancel</Button>
              <Button onClick={handleSubmit} className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-xs font-medium h-8" data-testid="deal-save-btn">{editingDeal ? "Update" : "Create"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
