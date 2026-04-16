# Pineapple OS

**A modular operator workspace designed as a long-term foundation.**

Pineapple OS is a command hub that lets you capture inputs, manage deals and tasks, store knowledge, track system upgrades, and review daily activity. This is version 1 — architecture and modularity are prioritized over feature density.

---

## Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

### Run with Docker (recommended)

```bash
# Clone and enter the repo
git clone https://github.com/TechCraft956/pineapple-Dash.git
cd pineapple-Dash

# Start everything (MongoDB + Backend + Frontend)
docker compose up --build
```

That's it. Open **http://localhost:3000** in your browser.

- Frontend: http://localhost:3000
- Backend API: http://localhost:8001/api
- MongoDB: localhost:27017

To stop: `Ctrl+C` then `docker compose down`

To stop and **delete all data**: `docker compose down -v`

### Run without Docker

The app runs on:
- **Frontend**: React + Tailwind CSS + shadcn/ui (port 3000)
- **Backend**: FastAPI + MongoDB (port 8001)

1. Start MongoDB locally on port 27017
2. Backend: `cd backend && cp .env.example .env && pip install -r requirements.txt && uvicorn server:app --host 0.0.0.0 --port 8001`
3. Frontend: `cd frontend && cp .env.example .env && yarn install && yarn start`

### First Launch
On first visit, the app automatically seeds the database with sample data so you can explore all modules immediately.

---

## Modules

| Module | Route | Purpose |
|---|---|---|
| **Command Center** | `/` | Quick capture input hub — save entries as tasks, deals, notes, ideas, trades, or system entries |
| **Dashboard** | `/dashboard` | Overview with summary cards, activity feed, priority items |
| **Tasks** | `/tasks` | Task management with status/priority filters, quick add/edit |
| **Deals** | `/deals` | Deal tracking with auto-calculated profit and ROI |
| **Knowledge Vault** | `/vault` | Store SOPs, prompts, strategies, reference material |
| **Build Queue** | `/build-queue` | Track planned upgrades, automations, and modules |
| **Daily Review** | `/daily-review` | Timeline of today's activity + reflection text area |

---

## Project Structure

```
/
├── docker-compose.yml         # One-command startup
├── backend/
│   ├── Dockerfile             # Backend container
│   ├── server.py              # FastAPI app - all models and API routes
│   ├── .env.example           # Environment template
│   └── requirements.txt       # Python dependencies
├── frontend/
│   ├── Dockerfile             # Frontend container
│   ├── src/
│   │   ├── App.js             # Router setup
│   │   ├── App.css            # App-level styles
│   │   ├── index.css          # Global styles, CSS variables, dark theme
│   │   ├── lib/
│   │   │   └── api.js         # Centralized API client
│   │   ├── components/
│   │   │   ├── Layout.jsx     # Sidebar navigation + main content
│   │   │   └── ui/            # shadcn/ui components
│   │   └── pages/
│   │       ├── CommandCenter.jsx
│   │       ├── Dashboard.jsx
│   │       ├── Tasks.jsx
│   │       ├── Deals.jsx
│   │       ├── KnowledgeVault.jsx
│   │       ├── BuildQueue.jsx
│   │       └── DailyReview.jsx
│   ├── .env.example           # Frontend env template
│   └── package.json           # Node dependencies
├── docs/
│   ├── ARCHITECTURE.md        # Architecture overview
│   └── PSEUDOCODE.md          # Core flow pseudocode
└── README.md                  # This file
```

---

## Data Models

All entities follow shared conventions:

| Field | Type | Present In |
|---|---|---|
| `id` | UUID string | All |
| `title` / `content` | String | All |
| `status` | String | Tasks, Deals, Build Queue |
| `priority` | String | Tasks, Deals, Build Queue |
| `tags` | Array of strings | All |
| `created_at` | ISO datetime | All |
| `updated_at` | ISO datetime | Most |

### Entity-Specific Fields
- **Deals**: `category`, `buy_price`, `sell_price`, `fees`, `estimated_profit` (auto), `roi_percent` (auto), `notes`
- **Tasks**: `description`, `due_date`
- **Knowledge**: `content`, `category`
- **Build Queue**: `description`, `rationale`
- **Commands**: `content`, `entry_type`

---

## API Reference

All routes are prefixed with `/api`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/` | Health check |
| POST | `/api/seed` | Seed sample data |
| GET/POST | `/api/commands` | List/create commands |
| DELETE | `/api/commands/:id` | Delete command |
| GET/POST | `/api/tasks` | List/create tasks |
| GET/PUT/DELETE | `/api/tasks/:id` | Get/update/delete task |
| GET/POST | `/api/deals` | List/create deals |
| GET/PUT/DELETE | `/api/deals/:id` | Get/update/delete deal |
| GET/POST | `/api/knowledge` | List/create knowledge |
| GET/PUT/DELETE | `/api/knowledge/:id` | Get/update/delete knowledge |
| GET/POST | `/api/build-queue` | List/create build queue items |
| PUT/DELETE | `/api/build-queue/:id` | Update/delete build queue item |
| GET/PUT | `/api/daily-review` | Get/save daily review |
| GET | `/api/dashboard` | Dashboard aggregated data |
| GET | `/api/activity` | Activity log |

---

## Design System

- **Theme**: Dark mode only
- **Colors**: Dark zinc backgrounds, yellow-500 primary accent
- **Font**: DM Sans (clean, readable)
- **Components**: shadcn/ui with custom dark styling
- **Icons**: Lucide React

---

## Roadmap (V2+)

1. **Email Integration** — Connect inbox for deal notifications
2. **Auto-tagging** — AI-based tagging for new entries
3. **Search Improvements** — Full-text search across all modules
4. **Data Export** — CSV/JSON export for any module
5. **Keyboard Shortcuts** — Power user navigation
6. **Charts & Analytics** — Visual trends for deals and tasks
7. **External API Connectors** — Webhook support for integrations
8. **Multi-user Support** — Authentication and user management

---

## Constraints (V1)

- No authentication
- No real-time features
- No external integrations
- No heavy AI features
- Single-operator use
