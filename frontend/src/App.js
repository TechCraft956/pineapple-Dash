/**
 * Pineapple OS - Main App Router
 * Routes map to modular pages. Command Center is the landing page.
 * Layout provides persistent sidebar navigation.
 */

import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Overview from "./pages/Overview";
import Agents from "./pages/Agents";
import Opportunities from "./pages/Opportunities";
import Approvals from "./pages/Approvals";
import Executions from "./pages/Executions";
import SystemHealth from "./pages/SystemHealth";
import Copilot from "./pages/Copilot";
import CommandCenter from "./pages/CommandCenter";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Deals from "./pages/Deals";
import KnowledgeVault from "./pages/KnowledgeVault";
import BuildQueue from "./pages/BuildQueue";
import DailyReview from "./pages/DailyReview";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/executions" element={<Executions />} />
          <Route path="/system-health" element={<SystemHealth />} />
          <Route path="/copilot" element={<Copilot />} />
          <Route path="/command-center" element={<CommandCenter />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/vault" element={<KnowledgeVault />} />
          <Route path="/build-queue" element={<BuildQueue />} />
          <Route path="/daily-review" element={<DailyReview />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
