/**
 * EntityLinks - Lightweight linking between entities
 * Shows existing links for an entity and allows creating new ones.
 */

import { useState, useEffect, useCallback } from "react";
import { linksApi, tasksApi, dealsApi, knowledgeApi, buildQueueApi, infrastructureApi } from "../lib/api";
import { Link2, Plus, X, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const ENTITY_TYPES = [
  { value: "tasks", label: "Task", route: "/tasks" },
  { value: "deals", label: "Deal", route: "/deals" },
  { value: "knowledge", label: "Knowledge", route: "/vault" },
  { value: "build_queue", label: "Build Queue", route: "/build-queue" },
  { value: "infrastructure", label: "Infrastructure", route: "/infrastructure" },
];

const fetchEntitiesForType = async (type) => {
  try {
    let res;
    switch (type) {
      case "tasks": res = await tasksApi.list(); break;
      case "deals": res = await dealsApi.list(); break;
      case "knowledge": res = await knowledgeApi.list(); break;
      case "build_queue": res = await buildQueueApi.list(); break;
      case "infrastructure": res = await infrastructureApi.list(); break;
      default: return [];
    }
    return res.data.map((d) => ({
      id: d.id,
      title: d.title || d.service_name || d.content || "Untitled",
    }));
  } catch {
    return [];
  }
};

export default function EntityLinks({ entityType, entityId }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [targetType, setTargetType] = useState("");
  const [targetEntities, setTargetEntities] = useState([]);
  const [targetId, setTargetId] = useState("");
  const [loadingEntities, setLoadingEntities] = useState(false);
  const navigate = useNavigate();

  const loadLinks = useCallback(async () => {
    try {
      const res = await linksApi.list({ entity_type: entityType, entity_id: entityId });
      setLinks(res.data);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  useEffect(() => {
    if (!targetType) { setTargetEntities([]); return; }
    setLoadingEntities(true);
    fetchEntitiesForType(targetType).then((items) => {
      // Filter out self
      setTargetEntities(items.filter((i) => !(targetType === entityType && i.id === entityId)));
      setLoadingEntities(false);
    });
  }, [targetType, entityType, entityId]);

  const handleAdd = async () => {
    if (!targetType || !targetId) return;
    try {
      await linksApi.create({
        source_type: entityType,
        source_id: entityId,
        target_type: targetType,
        target_id: targetId,
      });
      toast.success("Link created");
      setShowAdd(false);
      setTargetType("");
      setTargetId("");
      loadLinks();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create link");
    }
  };

  const handleRemove = async (linkId) => {
    try {
      await linksApi.remove(linkId);
      toast.success("Link removed");
      loadLinks();
    } catch {
      toast.error("Failed to remove link");
    }
  };

  const navigateToEntity = (type, id) => {
    const meta = ENTITY_TYPES.find((e) => e.value === type);
    if (meta) navigate(meta.route);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Loader2 size={12} className="animate-spin" /> Loading links...
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-zinc-800/50" data-testid="entity-links">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Link2 size={12} />
          <span>Linked ({links.length})</span>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs text-zinc-500 hover:text-yellow-500 flex items-center gap-1 transition-colors"
          data-testid="add-link-btn"
        >
          {showAdd ? <X size={12} /> : <Plus size={12} />}
          {showAdd ? "Cancel" : "Link"}
        </button>
      </div>

      {/* Existing links */}
      {links.length > 0 && (
        <div className="space-y-1 mb-2">
          {links.map((link) => {
            const isSource = link.source_type === entityType && link.source_id === entityId;
            const linkedType = isSource ? link.target_type : link.source_type;
            const linkedId = isSource ? link.target_id : link.source_id;
            const linkedTitle = isSource ? link.target_title : link.source_title;
            return (
              <div key={link.id} className="flex items-center gap-2 group" data-testid={`link-${link.id}`}>
                <button
                  onClick={() => navigateToEntity(linkedType, linkedId)}
                  className="flex-1 flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors text-left truncate"
                >
                  <span className="text-[10px] text-zinc-600 min-w-[60px]">{linkedType.replace("_", " ")}</span>
                  <span className="truncate">{linkedTitle}</span>
                </button>
                <button
                  onClick={() => handleRemove(link.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-opacity p-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add link form */}
      {showAdd && (
        <div className="space-y-2 bg-zinc-900/50 p-2 border border-zinc-800" data-testid="add-link-form">
          <Select value={targetType} onValueChange={(v) => { setTargetType(v); setTargetId(""); }}>
            <SelectTrigger className="h-8 bg-zinc-900 border-zinc-800 text-xs">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              {ENTITY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {targetType && (
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="h-8 bg-zinc-900 border-zinc-800 text-xs">
                <SelectValue placeholder={loadingEntities ? "Loading..." : "Select entity..."} />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700 max-h-[200px]">
                {targetEntities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <span className="truncate">{e.title}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            onClick={handleAdd}
            disabled={!targetType || !targetId}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-xs h-7"
            data-testid="confirm-link-btn"
          >
            Create Link
          </Button>
        </div>
      )}
    </div>
  );
}
