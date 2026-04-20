/**
 * Pineapple OS - API Client
 * Centralized API wrapper for all backend communication.
 * All endpoints are prefixed with /api on the backend.
 */

import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// --- Commands ---
export const commandsApi = {
  create: (data) => api.post("/commands", data),
  list: (params) => api.get("/commands", { params }),
  remove: (id) => api.delete(`/commands/${id}`),
};

// --- Tasks ---
export const tasksApi = {
  create: (data) => api.post("/tasks", data),
  list: (params) => api.get("/tasks", { params }),
  get: (id) => api.get(`/tasks/${id}`),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  remove: (id) => api.delete(`/tasks/${id}`),
};

// --- Deals ---
export const dealsApi = {
  create: (data) => api.post("/deals", data),
  list: (params) => api.get("/deals", { params }),
  get: (id) => api.get(`/deals/${id}`),
  update: (id, data) => api.put(`/deals/${id}`, data),
  remove: (id) => api.delete(`/deals/${id}`),
};

// --- Knowledge Vault ---
export const knowledgeApi = {
  create: (data) => api.post("/knowledge", data),
  list: (params) => api.get("/knowledge", { params }),
  get: (id) => api.get(`/knowledge/${id}`),
  update: (id, data) => api.put(`/knowledge/${id}`, data),
  remove: (id) => api.delete(`/knowledge/${id}`),
};

// --- Build Queue ---
export const buildQueueApi = {
  create: (data) => api.post("/build-queue", data),
  list: (params) => api.get("/build-queue", { params }),
  update: (id, data) => api.put(`/build-queue/${id}`, data),
  remove: (id) => api.delete(`/build-queue/${id}`),
};

// --- Daily Review ---
export const dailyReviewApi = {
  get: () => api.get("/daily-review"),
  save: (data) => api.put("/daily-review", data),
};

// --- Dashboard ---
export const dashboardApi = {
  get: () => api.get("/dashboard"),
  overview: () => api.get("/operator/overview"),
};

export const pineappleApi = {
  overview: () => api.get("/operator/overview"),
};

// --- Activity ---
export const activityApi = {
  list: (limit = 50) => api.get("/activity", { params: { limit } }),
};

// --- Seed ---
export const seedApi = {
  seed: () => api.post("/seed"),
};

export default api;
