import {
  AGENT_ORDER,
  RUNTIME_ENTITY_ORDER,
  SERVICE_ORDER_HINTS,
  SYSTEM_OWNER_ORDER,
} from "../config/pineappleOsOrder";

function orderIndex(order, value, fallback = Number.MAX_SAFE_INTEGER) {
  const index = order.findIndex((item) => item === value || value?.includes?.(item));
  return index === -1 ? fallback : index;
}

export function formatTimestamp(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function healthTone(status = "") {
  const value = status.toLowerCase();
  if (value.includes("healthy") || value === "active" || value === "alive") return "ok";
  if (value.includes("up")) return "up";
  return "warn";
}

export function statusClasses(tone) {
  if (tone === "ok") return "bg-emerald-500/15 text-emerald-300";
  if (tone === "up") return "bg-sky-500/15 text-sky-300";
  return "bg-yellow-500/15 text-yellow-300";
}

export function sortServices(services = []) {
  return [...services].sort((a, b) => {
    const orderDiff = orderIndex(SERVICE_ORDER_HINTS, a.name) - orderIndex(SERVICE_ORDER_HINTS, b.name);
    return orderDiff || a.name.localeCompare(b.name);
  });
}

export function sortAgents(agents = []) {
  return [...agents].sort((a, b) => {
    const orderDiff = orderIndex(AGENT_ORDER, a.name) - orderIndex(AGENT_ORDER, b.name);
    return orderDiff || a.name.localeCompare(b.name);
  });
}

export function orderedOwnershipEntries(ownershipMap = {}) {
  return Object.entries(ownershipMap).sort(([a], [b]) => {
    const orderDiff = orderIndex(SYSTEM_OWNER_ORDER, a) - orderIndex(SYSTEM_OWNER_ORDER, b);
    return orderDiff || a.localeCompare(b);
  });
}

export function orderedContractEntities(contract = {}) {
  const entities = Object.entries(contract.entities || {});
  return entities.sort(([a], [b]) => {
    const orderDiff = orderIndex(RUNTIME_ENTITY_ORDER, a) - orderIndex(RUNTIME_ENTITY_ORDER, b);
    return orderDiff || a.localeCompare(b);
  });
}
