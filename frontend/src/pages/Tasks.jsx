/**
 * Tasks Module - Task management for Pineapple OS
 * Supports CRUD, filtering by status/priority, quick add and edit.
 */

import { useState, useEffect, useCallback } from "react";
import { tasksApi } from "../lib/api";
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
import { Checkbox } from "../components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Search, Loader2, Pencil, Trash2, X } from "lucide-react";

const STATUSES = ["todo", "doing", "blocked", "done"];
const PRIORITIES = ["low", "medium", "high", "critical"];

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    due_date: "",
    tags: [],
  });
  const [tagInput, setTagInput] = useState("");

  const loadTasks = useCallback(async () => {
    try {
      const params = {};
      if (filterStatus !== "all") params.status = filterStatus;
      if (filterPriority !== "all") params.priority = filterPriority;
      if (searchQuery) params.search = searchQuery;
      const res = await tasksApi.list(params);
      setTasks(res.data);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority, searchQuery]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const resetForm = () => {
    setForm({ title: "", description: "", status: "todo", priority: "medium", due_date: "", tags: [] });
    setTagInput("");
    setEditingTask(null);
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || "",
      tags: task.tags || [],
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    try {
      const payload = { ...form, due_date: form.due_date || null };
      if (editingTask) {
        await tasksApi.update(editingTask.id, payload);
        toast.success("Task updated");
      } else {
        await tasksApi.create(payload);
        toast.success("Task created");
      }
      setShowForm(false);
      resetForm();
      loadTasks();
    } catch {
      toast.error("Failed to save task");
    }
  };

  const toggleDone = async (task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    try {
      await tasksApi.update(task.id, { status: newStatus });
      loadTasks();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const deleteTask = async (id) => {
    try {
      await tasksApi.remove(id);
      toast.success("Task deleted");
      loadTasks();
    } catch {
      toast.error("Failed to delete task");
    }
  };

  const handleTagKey = (e) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (!form.tags.includes(tag)) {
        setForm({ ...form, tags: [...form.tags, tag] });
      }
      setTagInput("");
    }
  };

  return (
    <div className="animate-fade-in" data-testid="tasks-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight" data-testid="tasks-title">Tasks</h1>
          <p className="text-sm text-zinc-500 mt-1">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</p>
        </div>
        <Button
          data-testid="add-task-btn"
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-xs font-medium h-8"
        >
          <Plus size={14} /> <span className="ml-1">Add Task</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5" data-testid="tasks-filters">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            data-testid="tasks-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="pl-9 h-8 bg-zinc-900 border-zinc-800 text-sm text-zinc-300 placeholder:text-zinc-600"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-28 h-8 bg-zinc-900 border-zinc-800 text-xs text-zinc-300" data-testid="filter-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-28 h-8 bg-zinc-900 border-zinc-800 text-xs text-zinc-300" data-testid="filter-priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all">All Priority</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-8 justify-center" data-testid="tasks-loading">
          <Loader2 size={16} className="animate-spin" /> Loading tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-sm text-zinc-500 py-12 text-center" data-testid="tasks-empty">
          No tasks found. Create one to get started.
        </div>
      ) : (
        <div className="space-y-1.5" data-testid="tasks-list">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="module-card flex items-center gap-3 group"
              data-testid={`task-item-${task.id}`}
            >
              <Checkbox
                data-testid={`task-checkbox-${task.id}`}
                checked={task.status === "done"}
                onCheckedChange={() => toggleDone(task)}
                className="border-zinc-600 data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500"
              />
              <span className={`priority-dot priority-${task.priority}`} title={task.priority} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${task.status === "done" ? "text-zinc-500 line-through" : "text-zinc-200"}`}>
                  {task.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`badge-status badge-${task.status}`}>{task.status}</span>
                  {task.due_date && (
                    <span className="text-[11px] text-zinc-500 font-mono">{task.due_date}</span>
                  )}
                  {task.tags?.map((t) => (
                    <span key={t} className="text-[11px] text-zinc-600">#{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button data-testid={`edit-task-${task.id}`} onClick={() => openEdit(task)} className="p-1 text-zinc-500 hover:text-zinc-300">
                  <Pencil size={13} />
                </button>
                <button data-testid={`delete-task-${task.id}`} onClick={() => deleteTask(task.id)} className="p-1 text-zinc-500 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md" data-testid="task-form-dialog">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">{editingTask ? "Edit Task" : "New Task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input
              data-testid="task-title-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Task title"
              className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
            />
            <Textarea
              data-testid="task-desc-input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description (optional)"
              className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 min-h-[60px]"
              rows={2}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-sm text-zinc-300" data-testid="task-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-sm text-zinc-300" data-testid="task-priority-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input
              data-testid="task-due-date"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="bg-zinc-950 border-zinc-800 text-zinc-300 text-sm"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {form.tags.map((t) => (
                <span key={t} className="text-[11px] bg-zinc-800 text-zinc-300 px-2 py-0.5 cursor-pointer hover:bg-zinc-700" onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== t) })}>
                  #{t} <X size={10} className="inline" />
                </span>
              ))}
              <input
                data-testid="task-tag-input"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKey}
                placeholder="Add tag (Enter)"
                className="bg-transparent text-xs text-zinc-400 outline-none w-24 placeholder:text-zinc-600"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setShowForm(false); resetForm(); }} className="text-zinc-400 text-xs h-8" data-testid="task-cancel-btn">Cancel</Button>
              <Button onClick={handleSubmit} className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-xs font-medium h-8" data-testid="task-save-btn">
                {editingTask ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
