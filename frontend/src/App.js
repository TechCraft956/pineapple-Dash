/**
 * Pineapple OS - Main App Router
 * Routes map to modular pages. Command Center is the landing page.
 * Layout provides persistent sidebar navigation.
 */

import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import CommandCenter from "./pages/CommandCenter";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Deals from "./pages/Deals";
import KnowledgeVault from "./pages/KnowledgeVault";
import BuildQueue from "./pages/BuildQueue";
import InfrastructureRegistry from "./pages/InfrastructureRegistry";
import DailyReview from "./pages/DailyReview";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<CommandCenter />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/vault" element={<KnowledgeVault />} />
          <Route path="/build-queue" element={<BuildQueue />} />
          <Route path="/infrastructure" element={<InfrastructureRegistry />} />
          <Route path="/daily-review" element={<DailyReview />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
