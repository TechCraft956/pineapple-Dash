/**
 * Pineapple OS - Layout Component
 * Persistent sidebar navigation + main content area.
 * Sidebar shows module icons and labels, highlights active route.
 */

import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Terminal,
  Handshake,
  CheckSquare,
  BookOpen,
  Layers,
  CalendarCheck,
  Activity,
  ShieldCheck,
  Workflow,
  Cpu,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Toaster } from "../components/ui/sonner";

const NAV_ITEMS = [
  { path: "/", label: "Overview", icon: LayoutDashboard },
  { path: "/agents", label: "Agents", icon: Cpu },
  { path: "/opportunities", label: "Opportunities", icon: Handshake },
  { path: "/approvals", label: "Approvals", icon: ShieldCheck },
  { path: "/executions", label: "Executions", icon: Workflow },
  { path: "/system-health", label: "System Health", icon: Activity },
  { path: "/copilot", label: "Copilot", icon: Sparkles },
  { path: "/command-center", label: "Command Center", icon: Terminal },
  { path: "/dashboard", label: "Legacy Dashboard", icon: LayoutDashboard },
  { path: "/tasks", label: "Tasks", icon: CheckSquare },
  { path: "/deals", label: "Deals", icon: Handshake },
  { path: "/vault", label: "Knowledge Vault", icon: BookOpen },
  { path: "/build-queue", label: "Build Queue", icon: Layers },
  { path: "/daily-review", label: "Daily Review", icon: CalendarCheck },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden app-grid-bg" data-testid="app-layout">
      {/* Mobile menu button */}
      <button
        data-testid="mobile-menu-toggle"
        className="fixed top-4 left-4 z-50 md:hidden p-2 bg-zinc-900 border border-zinc-800 text-zinc-300"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Sidebar overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className={`
          fixed md:static z-40 h-full w-56 bg-zinc-950 border-r border-zinc-800
          flex flex-col transition-transform duration-200
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="px-4 py-5 border-b border-zinc-800">
          <h1 className="text-base font-semibold text-zinc-100 tracking-tight" data-testid="app-title">
            <span className="text-yellow-500">P</span>ineapple OS
          </h1>
          <p className="text-[11px] text-zinc-500 mt-0.5">Unified operator command surface</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 overflow-y-auto" data-testid="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              data-testid={`nav-${item.path.replace("/", "") || "command-center"}`}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? "active" : ""}`
              }
              onClick={() => setMobileOpen(false)}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-800">
          <p className="text-[10px] text-zinc-600">v1.0.0 / canonical runtime mode</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto" data-testid="main-content">
        <div className="p-6 md:p-8 max-w-7xl">
          <Outlet />
        </div>
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}
