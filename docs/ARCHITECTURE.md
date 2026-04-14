# Pineapple OS — Architecture Overview

## System Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────>│   Backend    │────>│   MongoDB    │
│  React SPA   │<────│   FastAPI    │<────│   Database   │
│  Port 3000   │     │  Port 8001   │     │  Port 27017  │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Frontend (React)
- Single Page Application with React Router
- All API calls go through centralized `api.js` client
- UI built with shadcn/ui components + Tailwind CSS
- Pages are modular — each module is a self-contained page component
- Layout component provides persistent sidebar navigation

### Backend (FastAPI)
- Single `server.py` file — all models and routes in one place for V1 simplicity
- Pydantic models for request/response validation
- Async MongoDB operations via motor
- Activity logging on all write operations
- Auto-calculation for deal metrics (profit, ROI)

### Database (MongoDB)
- Collections: `commands`, `tasks`, `deals`, `knowledge`, `build_queue`, `daily_reviews`, `activity_log`
- All documents use UUID strings as `id` (not ObjectId)
- `_id` excluded from all query results
- Timestamps stored as ISO strings

---

## Design Decisions

### Why MongoDB?
MongoDB is the platform default. For V1, it's the path of least resistance. The schema conventions (consistent fields across entities) give us the structured-data benefits. Migration to PostgreSQL is straightforward if needed in V2.

### Why single server.py?
For a V1 with 7 modules, splitting into separate files adds complexity without meaningful benefit. The file is well-organized with clear section headers. When it grows beyond ~800 lines, split into:
```
backend/
├── server.py          # App setup, middleware
├── routes/
│   ├── commands.py
│   ├── tasks.py
│   ├── deals.py
│   ├── knowledge.py
│   ├── build_queue.py
│   ├── daily_review.py
│   └── dashboard.py
└── models/
    └── schemas.py
```

### Why centralized api.js?
Single source of truth for API communication. Adding auth headers, error handling, or retry logic requires changes in one file only.

### Activity Log Pattern
Every write operation (create, update, delete) logs to `activity_log`. This provides:
- Dashboard activity feed
- Daily review timeline
- Audit trail for future features

---

## Data Flow

```
User Input → React Page → api.js → FastAPI Route → MongoDB
                                         │
                                         └→ Activity Log
```

### Command Center Flow
1. User types in command input
2. Selects entry type (task, deal, note, etc.)
3. Optionally adds tags
4. Submits → POST /api/commands
5. Backend creates document + logs activity
6. UI refreshes command list

### Deal Calculation Flow
1. User provides buy_price, sell_price, fees
2. Backend calculates: profit = sell - buy - fees
3. Backend calculates: roi = (profit / buy) * 100
4. Stored with auto-calculated fields
5. Recalculated on any price update

---

## Extension Points

### Adding a New Module
1. Create MongoDB collection (just start using it — MongoDB creates on first write)
2. Add Pydantic models in server.py
3. Add CRUD routes with `/api/your-module` prefix
4. Create `pages/YourModule.jsx` with the page component
5. Add route in `App.js`
6. Add nav item in `Layout.jsx`

### Adding Authentication (Future)
1. Add user collection with hashed passwords
2. Add JWT token generation/validation
3. Add auth middleware to FastAPI
4. Add login page and token management to frontend
5. Add `user_id` field to all entities

### Adding External Integrations (Future)
1. Add API keys to `.env`
2. Create integration module in backend
3. Add webhook endpoints if needed
4. Keep integrations isolated in separate route files

---

## Performance Considerations

- MongoDB queries use projections (`{"_id": 0}`) to reduce payload
- Lists are capped (default 500 items) to prevent memory issues
- Frontend uses React's useCallback for memoized data fetching
- No unnecessary re-renders — state is scoped to page components
- Tailwind CSS is purged in production build
